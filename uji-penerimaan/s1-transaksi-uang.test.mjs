// S1 - Transaksi uang lintas tabel.
// Uji kotak-hitam: hanya memanggil API lewat HTTP, lalu memeriksa isi database.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const API = process.env.API_URL ?? 'http://localhost:3000';
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Nomor unik per kali uji, supaya uji bisa diulang tanpa membersihkan data.
const nomorBaru = () => `UJI-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

async function buat(body, headers = {}) {
  return fetch(`${API}/pengajuan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const hitung = async (sql, nilai) => Number((await db.query(sql, nilai)).rows[0].n);

before(async () => { await db.query('SELECT 1'); });
after(async () => { await db.end(); });

test('0,10 + 0,20 harus tepat 0,30', async () => {
  const res = await buat({
    nomor: nomorBaru(), pemohon: 'budi', pemasok: 'PEMASOK-001',
    baris: [
      { namaBarang: 'Pulpen', jumlah: '1', hargaSatuan: '0.10' },
      { namaBarang: 'Pensil', jumlah: '1', hargaSatuan: '0.20' },
    ],
  });
  assert.equal(res.status, 201);
  const hasil = await res.json();
  assert.equal(hasil.total, '0.30');            // string, bukan angka
  assert.equal(typeof hasil.total, 'string');
});

test('nilai besar tidak berubah satu sen pun', async () => {
  const res = await buat({
    nomor: nomorBaru(), pemohon: 'budi', pemasok: 'PEMASOK-001',
    baris: [{ namaBarang: 'Mesin', jumlah: '1', hargaSatuan: '12345678901234.56' }],
  });
  assert.equal(res.status, 201);
  const hasil = await res.json();
  assert.equal(hasil.total, '12345678901234.56');
  assert.equal(hasil.baris[0].hargaSatuan, '12345678901234.56');

  // Baca ulang lewat API: nilainya harus tetap sama.
  const ulang = await (await fetch(`${API}/pengajuan/${hasil.id}`)).json();
  assert.equal(ulang.total, '12345678901234.56');
});

test('total header sama dengan jumlah baris menurut database', async () => {
  const res = await buat({
    nomor: nomorBaru(), pemohon: 'sari', pemasok: 'PEMASOK-002',
    baris: [
      { namaBarang: 'Kertas', jumlah: '3', hargaSatuan: '33333.33' },
      { namaBarang: 'Tinta', jumlah: '2.5', hargaSatuan: '19999.99' },
    ],
  });
  const hasil = await res.json();
  const { rows } = await db.query(
    `SELECT p.total::text AS total,
            (SELECT round(sum(jumlah * harga_satuan), 2)::text
               FROM pengajuan_baris WHERE pengajuan_id = p.id) AS jumlah_baris
       FROM pengajuan p WHERE p.id = $1`, [hasil.id]);
  assert.equal(rows[0].total, rows[0].jumlah_baris);
  assert.equal(hasil.total, rows[0].total);
});

test('satu pengajuan menulis ke empat tabel sekaligus', async () => {
  const hasil = await (await buat({
    nomor: nomorBaru(), pemohon: 'sari', pemasok: 'PEMASOK-002',
    baris: [{ namaBarang: 'Kertas', jumlah: '1', hargaSatuan: '1000.00' }],
  })).json();
  assert.equal(await hitung('SELECT count(*) n FROM pengajuan_baris WHERE pengajuan_id = $1', [hasil.id]), 1);
  assert.equal(await hitung(`SELECT count(*) n FROM audit_log WHERE entitas_id = $1`, [hasil.id]), 1);
  assert.equal(await hitung('SELECT count(*) n FROM outbox WHERE pengajuan_id = $1', [hasil.id]), 1);
});

test('bila gagal di tengah, tidak ada yang tersimpan (rollback)', async () => {
  const nomor = nomorBaru();
  const body = {
    nomor, pemohon: 'budi', pemasok: 'PEMASOK-001',
    baris: [{ namaBarang: 'Pulpen', jumlah: '1', hargaSatuan: '5000.00' }],
  };
  const sebelum = await hitung('SELECT count(*) n FROM pengajuan_baris');

  const gagal = await buat(body, { 'x-uji-gagal': 'setelah-baris' });
  assert.equal(gagal.status, 500);

  assert.equal(await hitung('SELECT count(*) n FROM pengajuan WHERE nomor = $1', [nomor]), 0);
  assert.equal(await hitung('SELECT count(*) n FROM pengajuan_baris'), sebelum);

  // Nomor yang sama bisa dipakai lagi: bukti header tidak tertinggal.
  const ulang = await buat(body);
  assert.equal(ulang.status, 201);
});
