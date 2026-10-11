// S6 - Keamanan. Hanya dijalankan bila AUTH_ISSUER diisi, yaitu saat aplikasi berjalan dengan pemeriksaan token.
// Contoh: AUTH_ISSUER=http://localhost:8081/realms/spike node --test s6-keamanan.test.mjs
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as tunggu } from 'node:timers/promises';
import pg from 'pg';

const API = process.env.API_URL ?? 'http://localhost:3000';
const ERP = process.env.ERP_URL ?? 'http://localhost:4000';
const PENERBIT = process.env.AUTH_ISSUER;
const SEHAT = process.env.SEHAT_URL ?? `${API}/sehat`;
const lewati = PENERBIT ? false : 'AUTH_ISSUER kosong: aplikasi berjalan tanpa pemeriksaan token';
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
after(async () => { await db.end(); });

async function ambilToken(pengguna) {
  const res = await fetch(`${PENERBIT}/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'password', client_id: 'spike-api', username: pengguna, password: `${pengguna}_dev_only`,
    }),
  });
  assert.equal(res.status, 200, `gagal mengambil token ${pengguna}: ${await res.clone().text()}`);
  return (await res.json()).access_token;
}

const panggil = (alamat, { token, body, metode = 'POST', header = {} } = {}) =>
  fetch(`${API}${alamat}`, {
    method: metode,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...header,
    },
    body: metode === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });

const pengajuanBaru = () => ({
  nomor: `UJI-S6-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
  pemohon: 'budi', pemasok: 'PEMASOK-001',
  baris: [{ namaBarang: 'Pulpen', jumlah: '2', hargaSatuan: '1500.00' }],
});

async function tungguStatus(id, harapan, batasMs = 15000) {
  const mulai = Date.now();
  while (Date.now() - mulai < batasMs) {
    const { rows } = await db.query('SELECT status FROM pengajuan WHERE id = $1', [id]);
    if (rows[0]?.status === harapan) return;
    await tunggu(250);
  }
  assert.fail(`Status ${harapan} tidak tercapai dalam ${batasMs} ms`);
}

test('tanpa token ditolak 401', { skip: lewati }, async () => {
  assert.equal((await panggil('/pengajuan', { body: pengajuanBaru() })).status, 401);
  assert.equal((await panggil('/pengajuan/00000000-0000-0000-0000-000000000000', { metode: 'GET' })).status, 401);
  assert.equal((await panggil('/laporan/rekap', { metode: 'GET' })).status, 401);
});

test('token yang diubah atau tanpa tanda tangan ditolak 401', { skip: lewati }, async () => {
  const token = await ambilToken('budi');
  const [kepala, isi, tanda] = token.split('.');

  // 1. Isi diubah menjadi penyetuju, tanda tangan lama dipakai lagi.
  const klaim = JSON.parse(Buffer.from(isi, 'base64url').toString());
  klaim.realm_access = { roles: ['penyetuju'] };
  const isiPalsu = Buffer.from(JSON.stringify(klaim)).toString('base64url');
  assert.equal((await panggil('/pengajuan', { token: `${kepala}.${isiPalsu}.${tanda}`, body: pengajuanBaru() })).status, 401);

  // 2. Algoritma diganti "none" dan tanda tangan dibuang.
  const kepalaNone = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  assert.equal((await panggil('/pengajuan', { token: `${kepalaNone}.${isi}.`, body: pengajuanBaru() })).status, 401);

  // 3. Token asli tetap diterima, sebagai pembanding.
  assert.equal((await panggil('/pengajuan', { token, body: pengajuanBaru() })).status, 201);
});

test('pemohon tidak boleh memutuskan (403); penyetuju boleh, dan namanya diambil dari token', { skip: lewati }, async () => {
  const budi = await ambilToken('budi');
  const sari = await ambilToken('sari');

  const dibuat = await panggil('/pengajuan', { token: budi, body: pengajuanBaru() });
  assert.equal(dibuat.status, 201);
  const { id } = await dibuat.json();
  assert.equal((await panggil(`/pengajuan/${id}/ajukan`, { token: budi })).status, 202);
  await tungguStatus(id, 'DIAJUKAN');

  const ditolak = await panggil(`/pengajuan/${id}/keputusan`, { token: budi, body: { keputusan: 'SETUJU', penyetuju: 'sari' } });
  assert.equal(ditolak.status, 403);
  await tunggu(1000);
  assert.equal((await db.query('SELECT count(*)::int n FROM persetujuan WHERE pengajuan_id = $1', [id])).rows[0].n, 0);

  // Isi permintaan mengaku sebagai orang lain; yang dicatat harus nama pemilik token.
  const diterima = await panggil(`/pengajuan/${id}/keputusan`, { token: sari, body: { keputusan: 'SETUJU', penyetuju: 'orang-lain' } });
  assert.equal(diterima.status, 202);
  await tungguStatus(id, 'DISETUJUI');
  const { rows } = await db.query('SELECT penyetuju FROM persetujuan WHERE pengajuan_id = $1', [id]);
  assert.deepEqual(rows.map((r) => r.penyetuju), ['sari']);
});

test('health check bisa dipanggil tanpa token', { skip: lewati }, async () => {
  assert.equal((await fetch(SEHAT)).status, 200);
});

test('ID korelasi dari permintaan masuk sampai ke panggilan ERP', { skip: lewati }, async (t) => {
  const idKorelasi = `uji-${randomUUID()}`;
  const data = pengajuanBaru();
  const res = await panggil('/pengajuan', { token: await ambilToken('budi'), body: data, header: { 'x-id-korelasi': idKorelasi } });
  assert.equal(res.status, 201);
  assert.equal(res.headers.get('x-id-korelasi'), idKorelasi, 'jawaban harus membawa ID korelasi yang sama');

  let dokumen;
  for (let i = 0; i < 100 && !dokumen; i++) {
    const { data: semua } = await (await fetch(`${ERP}/erp/pengajuan`)).json();
    dokumen = semua.find((d) => d.isi?.nomor === data.nomor);
    if (!dokumen) await tunggu(200);
  }
  assert.ok(dokumen, 'pengajuan harus sampai di ERP tiruan');
  assert.equal(dokumen.idKorelasi, idKorelasi);
  t.diagnostic(`id korelasi ${idKorelasi}`);
});
