import { createReadStream } from 'node:fs';
import {
  BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, StreamableFile,
} from '@nestjs/common';
import { EksporService } from './ekspor.service.js';

@Controller('ekspor')
export class EksporController {
  constructor(private readonly ekspor: EksporService) {}

  @Post()
  @HttpCode(202)
  mulai(@Body() body?: { jumlahBaris?: number }) {
    const jumlah = Number(body?.jumlahBaris ?? 100000);
    if (!Number.isInteger(jumlah) || jumlah < 1 || jumlah > 1000000) {
      throw new BadRequestException('jumlahBaris harus bilangan bulat antara 1 dan 1.000.000');
    }
    return this.ekspor.mulai(jumlah);
  }

  @Get(':id')
  status(@Param('id', ParseUUIDPipe) id: string) {
    return this.ekspor.status(id);
  }

  @Get(':id/csv')
  async csv(@Param('id', ParseUUIDPipe) id: string) {
    await this.ekspor.pastikanSelesai(id);
    return new StreamableFile(createReadStream(this.ekspor.berkas(id, 'csv')), { type: 'text/csv; charset=utf-8' });
  }

  @Get(':id/xlsx')
  async xlsx(@Param('id', ParseUUIDPipe) id: string) {
    await this.ekspor.pastikanSelesai(id);
    return new StreamableFile(createReadStream(this.ekspor.berkas(id, 'xlsx')), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }
}
