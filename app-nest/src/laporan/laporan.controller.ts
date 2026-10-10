import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('laporan')
export class LaporanController {
  constructor(private readonly dataSource: DataSource) {}

  // Yang berat dikerjakan PostgreSQL; aplikasi hanya menunggu hasilnya.
  @Get('rekap')
  rekap() {
    return this.dataSource.query(
      `SELECT to_char(date_trunc('month', dibuat_pada AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM') AS bulan,
              pemasok, count(*)::int AS jumlah_pengajuan, sum(total)::text AS total
         FROM pengajuan
        WHERE status = 'DISETUJUI'
        GROUP BY 1, 2
        ORDER BY 1, 2`,
    );
  }
}
