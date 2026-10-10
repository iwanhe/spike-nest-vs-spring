import { Body, Controller, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { WorkflowClient } from '@nestjs/workflows';
import { idPersetujuan, PersetujuanWorkflow, sinyalKeputusan } from './persetujuan.workflow.js';
import type { Keputusan } from './persetujuan.workflow.js';

@Controller('pengajuan/:id')
export class PersetujuanController {
  constructor(private readonly workflowClient: WorkflowClient) {}

  @Post('ajukan')
  @HttpCode(202)
  ajukan(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflowClient.start(PersetujuanWorkflow, { pengajuanId: id }, { id: idPersetujuan(id) });
  }

  @Post('keputusan')
  @HttpCode(202)
  async putuskan(@Param('id', ParseUUIDPipe) id: string, @Body() body: Keputusan) {
    await this.workflowClient.signal(sinyalKeputusan, body, { key: id });
    return { diterima: true };
  }

  @Get('persetujuan')
  async status(@Param('id', ParseUUIDPipe) id: string) {
    const proses = await this.workflowClient.getStatus(idPersetujuan(id), { journal: true });
    if (!proses) throw new NotFoundException(`Pengajuan ${id} belum diajukan`);
    return {
      status: proses.status,
      menunggu: proses.waits.map((w) => w.signal),
      bangunPada: proses.wakeAt === null ? null : new Date(proses.wakeAt).toISOString(),
      langkah: Object.fromEntries(proses.journal.map((j) => [j.name, j.status])),
      keluaran: proses.output ?? null,
    };
  }
}
