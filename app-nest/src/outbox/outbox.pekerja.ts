import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { DataSource } from 'typeorm';

// S5: pekerja latar yang mengirim baris outbox ke ERP.
// Aturannya sama dengan versi Spring Boot:
// 1. Baris diklaim dan jadwal kirim ulangnya dipasang dalam SATU perintah SQL,
//    sebelum ERP dipanggil. Bila aplikasi mati di tengah pengiriman, baris itu
//    otomatis dicoba lagi setelah jedanya lewat.
// 2. Idempotency-Key selalu id baris outbox, jadi kiriman ulang tidak tercatat ganda.
// 3. Panggilan HTTP punya batas waktu, supaya ERP yang diam tidak menggantung pekerja.

const KLAIM = `
  WITH klaim AS (
    UPDATE outbox o
       SET percobaan = o.percobaan + 1,
           kirim_setelah = now() + make_interval(secs => least($1 * power(2, o.percobaan), 60000) / 1000.0)
     WHERE o.id IN (SELECT id FROM outbox
                     WHERE status = 'MENUNGGU' AND kirim_setelah <= now()
                     ORDER BY kirim_setelah
                     LIMIT $2
                       FOR UPDATE SKIP LOCKED)
    RETURNING o.id, o.payload, o.percobaan)
  SELECT id::text AS id, payload::text AS payload, percobaan FROM klaim`;

@Injectable()
export class OutboxPekerja implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(OutboxPekerja.name);
  private readonly erpUrl = process.env.ERP_URL;
  private readonly jedaMs = Number(process.env.OUTBOX_JEDA_MS ?? 1000);
  private readonly mundurMs = Number(process.env.OUTBOX_MUNDUR_MS ?? 1000);
  private readonly batasMs = Number(process.env.ERP_BATAS_MS ?? 2000);
  private readonly maksPercobaan = Number(process.env.OUTBOX_MAKS_PERCOBAAN ?? 20);
  private berhenti = false;
  private pengatur?: NodeJS.Timeout;

  constructor(private readonly dataSource: DataSource) {}

  onApplicationBootstrap() {
    if (!this.erpUrl) {
      this.log.warn('ERP_URL kosong: pekerja outbox tidak dijalankan');
      return;
    }
    this.jadwalkan();
  }

  onApplicationShutdown() {
    this.berhenti = true;
    clearTimeout(this.pengatur);
  }

  private jadwalkan() {
    if (this.berhenti) return;
    this.pengatur = setTimeout(async () => {
      try {
        await this.putaran();
      } catch (e) {
        this.log.error(`Putaran outbox gagal: ${(e as Error).message}`);
      }
      this.jadwalkan();
    }, this.jedaMs);
  }

  private async putaran() {
    const baris: { id: string; payload: string; percobaan: number }[] =
      await this.dataSource.query(KLAIM, [this.mundurMs, 10]);
    for (const b of baris) {
      if (await this.kirim(b.id, b.payload)) {
        await this.dataSource.query(
          `UPDATE outbox SET status = 'TERKIRIM', terkirim_pada = now() WHERE id = $1`, [b.id]);
      } else if (b.percobaan >= this.maksPercobaan) {
        await this.dataSource.query(`UPDATE outbox SET status = 'GAGAL' WHERE id = $1`, [b.id]);
      }
    }
  }

  private async kirim(id: string, payload: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.erpUrl}/erp/pengajuan`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': id },
        body: payload,
        signal: AbortSignal.timeout(this.batasMs),
      });
      await res.arrayBuffer(); // habiskan jawaban supaya koneksi dilepas
      return res.ok;
    } catch {
      return false; // batas waktu atau koneksi putus: dicoba lagi nanti
    }
  }
}
