import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { PengajuanBaris } from './pengajuan-baris.entity.js';

@Entity({ name: 'pengajuan' })
export class Pengajuan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  nomor: string;

  @Column({ type: 'text' })
  pemohon: string;

  @Column({ type: 'text' })
  pemasok: string;

  @Column({ type: 'text' })
  status: string;

  // Uang selalu string di aplikasi. Jangan pernah diubah menjadi number.
  @Column({ type: 'numeric', precision: 20, scale: 2 })
  total: string;

  @OneToMany(() => PengajuanBaris, (baris) => baris.pengajuan)
  baris: Relation<PengajuanBaris[]>;
}
