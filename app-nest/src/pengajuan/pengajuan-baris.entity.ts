import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Pengajuan } from './pengajuan.entity.js';

@Entity({ name: 'pengajuan_baris' })
export class PengajuanBaris {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => Pengajuan, (pengajuan) => pengajuan.baris)
  @JoinColumn({ name: 'pengajuan_id' })
  pengajuan: Relation<Pengajuan>; // Relation<> wajib di proyek ESM agar impor melingkar tidak gagal

  @Column({ name: 'nama_barang', type: 'text' })
  namaBarang: string;

  @Column({ type: 'numeric', precision: 12, scale: 3 })
  jumlah: string;

  @Column({ name: 'harga_satuan', type: 'numeric', precision: 20, scale: 2 })
  hargaSatuan: string;
}
