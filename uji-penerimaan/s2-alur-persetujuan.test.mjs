// S2 - Alur persetujuan. Jalankan aplikasi dengan BATAS_PERSETUJUAN=5s untuk uji eskalasi.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as tunggu } from 'node:timers/promises';
import pg from 'pg';

const API = process.env.API_URL ?? 'http://localhost:3000';
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
after(async () => { await db.end(); });

const kirim = (alamat, body) =>
  fetch(`${API}${alamat}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });

async function buatPengajuan() {
  const res = await kirim('/pengajuan', {
    nomor: `UJI-S2-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    pemohon: 'budi', pemasok: 'PEMASOK-001',
    baris: [{ namaBarang: 'Pulpen', jumlah: '2', hargaSatuan: '1500.00' }],
  });
  return (await res.json()).id;
}

// Proses berjalan di latar, jadi uji menunggu sampai status yang diharapkan muncul.
async function tungguStatus(id, harapan, batasMs = 15000) {
  const mulai = Date.now();
  while (Date.now() - mulai < batasMs) {
    const { rows } = await db.query('SELECT status FROM pengajuan WHERE id = $1', [id]);
    if (rows[0]?.status === harapan) return;
    await tunggu(250);
  }
  assert.fail(`Status ${harapan} tidak tercapai dalam ${batasMs} ms`);
}

const jumlahPersetujuan = async (id) =>
  Number((await db.query('SELECT count(*) n FROM persetujuan WHERE pengajuan_id = $1', [id])).rows[0].n);

test('diajukan lalu disetujui', async () => {
  const id = await buatPengajuan();
  assert.equal((await kirim(`/pengajuan/${id}/ajukan`)).status, 202);
  await tungguStatus(id, 'DIAJUKAN');

  assert.equal((await kirim(`/pengajuan/${id}/keputusan`, { keputusan: 'SETUJU', penyetuju: 'sari' })).status, 202);
  await tungguStatus(id, 'DISETUJUI');
  assert.equal(await jumlahPersetujuan(id), 1);
});

test('diajukan lalu ditolak', async () => {
  const id = await buatPengajuan();
  await kirim(`/pengajuan/${id}/ajukan`);
  await tungguStatus(id, 'DIAJUKAN');
  await kirim(`/pengajuan/${id}/keputusan`, { keputusan: 'TOLAK', penyetuju: 'sari' });
  await tungguStatus(id, 'DITOLAK');
});

test('mengajukan dan memutuskan dua kali tidak menggandakan catatan', async () => {
  const id = await buatPengajuan();
  await kirim(`/pengajuan/${id}/ajukan`);
  await kirim(`/pengajuan/${id}/ajukan`);                // klik ganda
  await tungguStatus(id, 'DIAJUKAN');
  await kirim(`/pengajuan/${id}/keputusan`, { keputusan: 'SETUJU', penyetuju: 'sari' });
  await kirim(`/pengajuan/${id}/keputusan`, { keputusan: 'SETUJU', penyetuju: 'sari' });
  await tungguStatus(id, 'DISETUJUI');
  await tunggu(1500);                                    // beri waktu bila ada proses kedua
  assert.equal(await jumlahPersetujuan(id), 1);
});

test('tanpa keputusan sampai batas waktu, pengajuan dieskalasi', async () => {
  const id = await buatPengajuan();
  await kirim(`/pengajuan/${id}/ajukan`);
  await tungguStatus(id, 'ESKALASI', 20000);
  assert.equal(await jumlahPersetujuan(id), 1);
});
