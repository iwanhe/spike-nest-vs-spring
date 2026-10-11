import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Terbuka } from '../keamanan/penjaga-token.js';

// S6: health check. Menjawab 200 hanya bila database bisa dihubungi.
@Controller('sehat')
export class SehatController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @Terbuka()
  async periksa() {
    let pengatur: NodeJS.Timeout | undefined;
    const batas = new Promise<never>((_, tolak) => {
      pengatur = setTimeout(() => tolak(new Error('batas waktu')), 3000);
    });
    try {
      await Promise.race([this.dataSource.query('SELECT 1'), batas]);
      return { status: 'UP' };
    } catch {
      throw new ServiceUnavailableException({ status: 'DOWN', database: 'tidak bisa dihubungi' });
    } finally {
      clearTimeout(pengatur);
    }
  }
}
