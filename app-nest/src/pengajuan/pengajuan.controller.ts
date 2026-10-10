import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { PengajuanService } from './pengajuan.service.js';
import type { BuatPengajuanDto } from './pengajuan.service.js';

@Controller('pengajuan')
export class PengajuanController {
  constructor(private readonly pengajuanService: PengajuanService) {}

  @Post()
  buat(@Body() dto: BuatPengajuanDto, @Headers('x-uji-gagal') ujiGagal?: string) {
    return this.pengajuanService.buat(dto, ujiGagal);
  }

  @Get(':id')
  cari(@Param('id', ParseUUIDPipe) id: string) {
    return this.pengajuanService.cari(id);
  }
}
