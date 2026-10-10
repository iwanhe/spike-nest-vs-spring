import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Pengajuan } from './pengajuan.entity.js';
import { PengajuanBaris } from './pengajuan-baris.entity.js';

export interface BuatPengajuanDto {
  nomor: string;
  pemohon: string;
  pemasok: string;
  baris: { namaBarang: string; jumlah: string; hargaSatuan: string }[];
}

@Injectable()
export class PengajuanService {
  constructor(private readonly dataSource: DataSource) {}

  async buat(dto: BuatPengajuanDto, ujiGagal?: string): Promise<Pengajuan> {
    // Semua langkah di dalam callback ini satu transaksi:
    // bila satu langkah melempar error, semuanya dibatalkan.
    const id = await this.dataSource.transaction(async (manager) => {
      const pengajuan = await manager.save(
        manager.create(Pengajuan, {
          nomor: dto.nomor,
          pemohon: dto.pemohon,
          pemasok: dto.pemasok,
          status: 'DRAF',
          total: '0',
        }),
      );

      for (const baris of dto.baris) {
        await manager.save(manager.create(PengajuanBaris, { ...baris, pengajuan }));
      }

      // Hanya untuk uji: sengaja gagal di tengah transaksi.
      if (process.env.MODE_UJI === '1' && ujiGagal === 'setelah-baris') {
        throw new Error('Gagal buatan untuk menguji rollback');
      }

      // Total dihitung PostgreSQL, bukan JavaScript.
      await manager.query(
        `UPDATE pengajuan
            SET total = (SELECT round(sum(jumlah * harga_satuan), 2)
                           FROM pengajuan_baris WHERE pengajuan_id = $1)
          WHERE id = $1`,
        [pengajuan.id],
      );

      await manager.query(
        `INSERT INTO audit_log (entitas, entitas_id, aksi, pelaku) VALUES ('pengajuan', $1, 'BUAT', $2)`,
        [pengajuan.id, dto.pemohon],
      );

      await manager.query(
        `INSERT INTO outbox (pengajuan_id, payload) VALUES ($1, $2)`,
        [pengajuan.id, JSON.stringify({ nomor: dto.nomor, pemasok: dto.pemasok })],
      );

      return pengajuan.id;
    });

    return this.cari(id);
  }

  async cari(id: string): Promise<Pengajuan> {
    const pengajuan = await this.dataSource.getRepository(Pengajuan).findOne({
      where: { id },
      relations: { baris: true },
    });
    if (!pengajuan) throw new NotFoundException(`Pengajuan ${id} tidak ditemukan`);
    return pengajuan;
  }
}
