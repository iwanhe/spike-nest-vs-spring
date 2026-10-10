import { Workflow, WorkflowSignal } from '@nestjs/workflows';
import type { Duration, WorkflowContext, WorkflowRunner } from '@nestjs/workflows';
import { DataSource } from 'typeorm';

export interface Keputusan {
  keputusan: 'SETUJU' | 'TOLAK';
  penyetuju: string;
}

// Sinyal yang dikirim saat penyetuju memutuskan. Kuncinya adalah id pengajuan.
export const sinyalKeputusan = new WorkflowSignal<Keputusan>('pengajuan.keputusan');

// Batas waktu keputusan. Uji memakai nilai pendek, misalnya 5s.
const BATAS = (process.env.BATAS_PERSETUJUAN ?? '3d') as Duration;

export const idPersetujuan = (pengajuanId: string) => `persetujuan-${pengajuanId}`;

@Workflow('persetujuan-pengajuan')
export class PersetujuanWorkflow implements WorkflowRunner<{ pengajuanId: string }, { hasil: string }> {
  constructor(private readonly dataSource: DataSource) {}

  async run(ctx: WorkflowContext, input: { pengajuanId: string }) {
    const id = input.pengajuanId;

    await ctx.step('tandai-diajukan', () => this.ubahStatus(id, 'DIAJUKAN'));

    // Tunggu keputusan atau 3 hari, mana yang lebih dulu.
    const hasil = await ctx.waitForAny('tunggu-keputusan', {
      diputuskan: ctx.signalWait(sinyalKeputusan, { key: id }),
      kedaluwarsa: ctx.timer(BATAS),
    });

    if (hasil.key === 'kedaluwarsa') {
      await ctx.step('eskalasi', () => this.catat(id, 'ESKALASI', 'sistem', 'ESKALASI'));
      return { hasil: 'ESKALASI' };
    }

    const { keputusan, penyetuju } = hasil.value;
    const status = keputusan === 'SETUJU' ? 'DISETUJUI' : 'DITOLAK';
    await ctx.step('catat-keputusan', () => this.catat(id, keputusan, penyetuju, status));
    return { hasil: status };
  }

  private async ubahStatus(id: string, status: string) {
    await this.dataSource.query(`UPDATE pengajuan SET status = $2 WHERE id = $1`, [id, status]);
    return { status };
  }

  // Satu transaksi: baris persetujuan dan status pengajuan berubah bersama.
  private async catat(id: string, keputusan: string, penyetuju: string, status: string) {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO persetujuan (pengajuan_id, penyetuju, keputusan) VALUES ($1, $2, $3)`,
        [id, penyetuju, keputusan],
      );
      await manager.query(`UPDATE pengajuan SET status = $2 WHERE id = $1`, [id, status]);
    });
    return { status };
  }
}
