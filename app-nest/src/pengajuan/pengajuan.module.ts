import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pengajuan } from './pengajuan.entity.js';
import { PengajuanBaris } from './pengajuan-baris.entity.js';
import { PengajuanController } from './pengajuan.controller.js';
import { PengajuanService } from './pengajuan.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Pengajuan, PengajuanBaris])],
  controllers: [PengajuanController],
  providers: [PengajuanService],
})
export class PengajuanModule {}
