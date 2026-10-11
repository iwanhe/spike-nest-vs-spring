// S5 - Pengiriman andal ke ERP. Perlu ERP tiruan (ERP_URL) dan aplikasi yang dijalankan dengan ERP_URL yang sama.
// Yang diuji: setiap pengajuan tercatat di ERP tepat satu kali, walau ERP gagal, lambat, atau diam.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as tunggu } from 'node:timers/promises';
import pg from 'pg';

const API = process.env.API_URL ?? 'http://localhost:3000';
const ERP = process.env.ERP_URL ?? 'http://localhost:4000';
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const aturMode = (mode) =>
  fetch(`${ERP}/admin/mode`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode }) });
after(async () => { await aturMode('normal'); await db.end(); });

let urut = 0;
async function buatPengajuan() {
  const nomor = `UJI-S5-${Date.now()}-${process.pid}-${++urut}`;
  const res = await fetch(`${API}/pengajuan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      nomor, pemohon: 'budi', pemasok: 'PEMASOK-001',
      baris: [{ namaBarang: 'Pulpen', jumlah: '2', hargaSatuan: '1500.00' }],
    }),
  });
  assert.equal(res.status, 201);
  return { id: (await res.json()).id, nomor };
}

const outbox = async (daftar) =>
  (await db.query(
    'SELECT pengajuan_id, id, status, percobaan, kirim_setelah > now() AS dijadwalkan FROM outbox WHERE pengajuan_id = ANY($1::uuid[])',
    [daftar.map((p) => p.id)])).rows;

// Pengiriman berjalan di latar, jadi uji menunggu sampai keadaan yang diharapkan muncul.
async function tungguOutbox(daftar, syarat, keterangan, batasMs = 30000) {
  const mulai = Date.now();
  let baris = [];
  while (Date.now() - mulai < batasMs) {
    baris = await outbox(daftar);
    if (baris.length === daftar.length && baris.every(syarat)) return baris;
    await tunggu(200);
  }
  assert.fail(`${keterangan} tidak tercapai dalam ${batasMs} ms: ${JSON.stringify(baris)}`);
}

// Dokumen di ERP dicari lewat nomor pengajuan, bukan lewat kunci.
// Bila aplikasi memakai kunci baru saat kirim ulang, satu nomor akan muncul dua kali di sini.
async function diErp(daftar) {
  const { data } = await (await fetch(`${ERP}/erp/pengajuan`)).json();
  return daftar.map((p) => data.filter((d) => d.isi?.nomor === p.nomor));
}

test('pengajuan baru sampai di ERP tepat satu kali, dengan id outbox sebagai kunci', async () => {
  await aturMode('normal');
  const daftar = [await buatPengajuan(), await buatPengajuan(), await buatPengajuan()];
  const baris = await tungguOutbox(daftar, (b) => b.status === 'TERKIRIM', 'Status TERKIRIM');
  const erp = await diErp(daftar);
  for (const [i, dokumen] of erp.entries()) {
    assert.equal(dokumen.length, 1, `pengajuan ${daftar[i].nomor} harus tercatat satu kali`);
    const b = baris.find((x) => x.pengajuan_id === daftar[i].id);
    assert.equal(dokumen[0].kunci, b.id, 'Idempotency-Key harus id baris outbox');
    assert.equal(dokumen[0].isi.pemasok, 'PEMASOK-001');
  }
});

test('ERP menolak: tidak ada yang hilang, dicoba ulang dengan jeda, lalu terkirim saat ERP pulih', async () => {
  await aturMode('gagal');
  try {
    const daftar = [await buatPengajuan(), await buatPengajuan()];
    const baris = await tungguOutbox(daftar, (b) => b.percobaan >= 2, 'Dua kali percobaan');
    assert.ok(baris.every((b) => b.status === 'MENUNGGU'), 'selama ERP menolak, status tetap MENUNGGU');
    assert.deepEqual((await diErp(daftar)).map((d) => d.length), [0, 0], 'ERP belum boleh mencatat apa pun');

    await aturMode('normal');
    await tungguOutbox(daftar, (b) => b.status === 'TERKIRIM', 'Status TERKIRIM');
    assert.deepEqual((await diErp(daftar)).map((d) => d.length), [1, 1]);
  } finally {
    await aturMode('normal');
  }
});

test('ERP menyimpan tetapi jawabannya gagal: kiriman ulang tidak tercatat ganda', async () => {
  await aturMode('simpan-lalu-gagal');
  try {
    const daftar = [await buatPengajuan(), await buatPengajuan()];
    const baris = await tungguOutbox(daftar, (b) => b.status === 'TERKIRIM', 'Status TERKIRIM');
    assert.ok(baris.every((b) => b.percobaan >= 2), 'harus ada kiriman ulang');
    assert.deepEqual((await diErp(daftar)).map((d) => d.length), [1, 1]);
  } finally {
    await aturMode('normal');
  }
});

test('ERP diam: pekerja tidak menggantung dan pengajuan lain tetap terkirim', async () => {
  await aturMode('diam');
  try {
    const tertahan = [await buatPengajuan()];
    await tungguOutbox(tertahan, (b) => b.percobaan >= 1, 'Percobaan pertama');
    await aturMode('normal');
    const berikut = [await buatPengajuan()];
    await tungguOutbox(berikut, (b) => b.status === 'TERKIRIM', 'Pengajuan berikutnya TERKIRIM');
    await tungguOutbox(tertahan, (b) => b.status === 'TERKIRIM', 'Pengajuan yang tertahan TERKIRIM');
    assert.deepEqual((await diErp([...tertahan, ...berikut])).map((d) => d.length), [1, 1]);
  } finally {
    await aturMode('normal');
  }
});
