// S4 - Ekspor besar sebagai pekerjaan latar.
// Yang diuji: permintaan langsung dijawab, file CSV dan Excel utuh, dan permintaan ringan tetap dilayani.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as tunggu } from 'node:timers/promises';
import pg from 'pg';

const API = process.env.API_URL ?? 'http://localhost:3000';
const JUMLAH = Number(process.env.EKSPOR_BARIS ?? 100000);
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
after(async () => { await db.end(); });

const mulaiEkspor = (jumlahBaris) =>
  fetch(`${API}/ekspor`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jumlahBaris }),
  });

// "12345.67" -> 1234567n, supaya penjumlahan tidak memakai bilangan pecahan.
const sen = (teks) => BigInt(teks.replace('.', ''));

test(`ekspor ${JUMLAH} baris: dijawab langsung, file utuh, permintaan ringan tetap dilayani`, async (t) => {
  const t0 = Date.now();
  const res = await mulaiEkspor(JUMLAH);
  assert.equal(res.status, 202);
  assert.ok(Date.now() - t0 < 2000, 'POST /ekspor harus langsung menjawab, tidak menunggu ekspor selesai');
  const { idPekerjaan } = await res.json();

  // Selagi ekspor berjalan, status ditanya berulang. Setiap jawaban dicatat lamanya.
  let status, terlama = 0;
  const batas = Date.now() + 180000;
  do {
    const awal = Date.now();
    status = await (await fetch(`${API}/ekspor/${idPekerjaan}`)).json();
    terlama = Math.max(terlama, Date.now() - awal);
    assert.notEqual(status.status, 'GAGAL', `ekspor gagal: ${status.galat}`);
    if (status.status !== 'SELESAI') await tunggu(100);
  } while (status.status !== 'SELESAI' && Date.now() < batas);
  assert.equal(status.status, 'SELESAI');
  assert.equal(status.barisDitulis, JUMLAH);
  assert.ok(terlama < 2000, `permintaan ringan tertahan ${terlama} ms selagi ekspor berjalan`);
  t.diagnostic(`lama ekspor ${Date.now() - t0} ms; permintaan ringan terlama ${terlama} ms`);

  // CSV: jumlah baris, judul kolom, baris pertama, dan jumlah total dibandingkan dengan database.
  const csv = await (await fetch(`${API}/ekspor/${idPekerjaan}/csv`)).text();
  const baris = csv.trimEnd().split('\n');
  assert.equal(baris.length, JUMLAH + 1, 'jumlah baris CSV termasuk judul kolom');
  assert.equal(baris[0], 'nomor,pemohon,pemasok,status,total,tanggal');
  const { rows: [kontrol] } = await db.query(
    `SELECT count(*)::int AS jumlah, (sum(total) * 100)::bigint::text AS sen, min(nomor) AS pertama
       FROM (SELECT nomor, total FROM pengajuan WHERE nomor LIKE 'HIST-%' ORDER BY nomor LIMIT $1) t`, [JUMLAH]);
  assert.equal(kontrol.jumlah, JUMLAH);
  assert.equal(baris[1].split(',')[0], kontrol.pertama);
  const jumlahSen = baris.slice(1).reduce((a, b) => a + sen(b.split(',')[4]), 0n);
  assert.equal(jumlahSen.toString(), kontrol.sen, 'jumlah kolom total harus sama dengan database, sampai sen terakhir');
  t.diagnostic(`sha256 csv ${createHash('sha256').update(csv).digest('hex')}`);

  // Excel: file dibuka sebagai zip, lalu baris pada lembar pertama dihitung.
  const xlsx = Buffer.from(await (await fetch(`${API}/ekspor/${idPekerjaan}/xlsx`)).arrayBuffer());
  const berkas = join(mkdtempSync(join(tmpdir(), 'ekspor-')), 'hasil.xlsx');
  writeFileSync(berkas, xlsx);
  const lembar = execFileSync('unzip', ['-p', berkas, 'xl/worksheets/sheet1.xml'], { maxBuffer: 1 << 30 }).toString();
  assert.equal((lembar.match(/<row /g) ?? []).length, JUMLAH + 1, 'jumlah baris Excel termasuk judul kolom');
  assert.ok(lembar.includes('HIST-0000001'), 'nomor pertama harus ada di lembar Excel');
  t.diagnostic(`ukuran csv ${csv.length} byte; ukuran xlsx ${xlsx.length} byte`);
});

test('file ekspor belum bisa diambil sebelum selesai, dan id tak dikenal menjawab 404', async () => {
  const { idPekerjaan } = await (await mulaiEkspor(JUMLAH)).json();
  assert.equal((await fetch(`${API}/ekspor/${idPekerjaan}/csv`)).status, 409);
  assert.equal((await fetch(`${API}/ekspor/00000000-0000-0000-0000-000000000000`)).status, 404);
  assert.equal((await mulaiEkspor(0)).status, 400);
});
