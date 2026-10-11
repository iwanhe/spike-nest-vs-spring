import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { DataSource } from 'typeorm';

// S4: ekspor besar sebagai pekerjaan latar.
// Baris dibaca dari PostgreSQL lewat kursor (stream) dan langsung ditulis ke file,
// jadi memori tidak tumbuh sebanding jumlah baris.

// Hanya data historis, supaya isi file selalu sama dan bisa dibandingkan antar-kandidat.
export const SQL_EKSPOR = `
  SELECT nomor, pemohon, pemasok, status, total::text AS total,
         to_char(dibuat_pada AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS tanggal
    FROM pengajuan
   WHERE nomor LIKE 'HIST-%'
   ORDER BY nomor
   LIMIT $1`;
const KOLOM = ['nomor', 'pemohon', 'pemasok', 'status', 'total', 'tanggal'] as const;
type Baris = Record<(typeof KOLOM)[number], string>;

const csv = (nilai: string) => (/[",\n]/.test(nilai) ? `"${nilai.replaceAll('"', '""')}"` : nilai);

@Injectable()
export class EksporService {
  private readonly log = new Logger(EksporService.name);
  private readonly folder = resolve(process.env.EKSPOR_DIR ?? 'ekspor-keluar');
  private readonly kemajuan = new Map<string, number>();

  constructor(private readonly dataSource: DataSource) {}

  berkas(id: string, jenis: 'csv' | 'xlsx') {
    return join(this.folder, `${id}.${jenis}`);
  }

  async mulai(jumlahBaris: number) {
    const [{ id }] = await this.dataSource.query(
      `INSERT INTO ekspor (jumlah_baris) VALUES ($1) RETURNING id`, [jumlahBaris]);
    // Sengaja tidak ditunggu: permintaan langsung dijawab 202, pekerjaan berjalan di latar.
    void this.jalankan(id, jumlahBaris);
    return { idPekerjaan: id as string };
  }

  async status(id: string) {
    const [p] = await this.dataSource.query(
      `SELECT id, status, jumlah_baris, baris_ditulis, galat FROM ekspor WHERE id = $1`, [id]);
    if (!p) throw new NotFoundException(`Pekerjaan ekspor ${id} tidak ditemukan`);
    return {
      idPekerjaan: p.id, status: p.status, jumlahBaris: p.jumlah_baris,
      barisDitulis: this.kemajuan.get(id) ?? p.baris_ditulis, galat: p.galat,
    };
  }

  async pastikanSelesai(id: string) {
    if ((await this.status(id)).status !== 'SELESAI') throw new ConflictException('Ekspor belum selesai');
  }

  private async jalankan(id: string, jumlahBaris: number) {
    const runner = this.dataSource.createQueryRunner();
    let ditulis = 0;
    try {
      await mkdir(this.folder, { recursive: true });
      await runner.connect();
      const arus = await runner.stream(SQL_EKSPOR, [jumlahBaris]);

      const berkasCsv = createWriteStream(this.berkas(id, 'csv'));
      const buku = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: this.berkas(id, 'xlsx') });
      const lembar = buku.addWorksheet('Pengajuan');

      berkasCsv.write(KOLOM.join(',') + '\n');
      lembar.addRow([...KOLOM]).commit();

      for await (const baris of arus as AsyncIterable<Baris>) {
        const baik = berkasCsv.write(KOLOM.map((k) => csv(baris[k])).join(',') + '\n');
        if (!baik) await once(berkasCsv, 'drain'); // tunggu disk, jangan menumpuk di memori
        lembar.addRow([baris.nomor, baris.pemohon, baris.pemasok, baris.status, Number(baris.total), baris.tanggal]).commit();
        ditulis += 1;
        if (ditulis % 1000 === 0) this.kemajuan.set(id, ditulis);
      }

      berkasCsv.end();
      await once(berkasCsv, 'finish');
      await buku.commit();
      await this.dataSource.query(
        `UPDATE ekspor SET status = 'SELESAI', baris_ditulis = $2, selesai_pada = now() WHERE id = $1`, [id, ditulis]);
    } catch (e) {
      this.log.error(`Ekspor ${id} gagal: ${(e as Error).message}`);
      await this.dataSource.query(
        `UPDATE ekspor SET status = 'GAGAL', baris_ditulis = $2, galat = $3, selesai_pada = now() WHERE id = $1`,
        [id, ditulis, (e as Error).message]).catch(() => undefined);
    } finally {
      this.kemajuan.delete(id);
      await runner.release().catch(() => undefined);
    }
  }
}
