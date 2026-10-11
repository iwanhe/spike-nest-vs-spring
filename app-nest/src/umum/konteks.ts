import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

// S6: ID korelasi mengikuti satu permintaan dari awal sampai akhir,
// supaya semua baris log milik permintaan itu bisa dikumpulkan.
export const konteks = new AsyncLocalStorage<{ idKorelasi: string }>();
export const idKorelasiSekarang = () => konteks.getStore()?.idKorelasi ?? null;

const log = new Logger('Permintaan');

export function pasangIdKorelasi(req: Request, res: Response, next: NextFunction) {
  const kiriman = req.headers['x-id-korelasi'];
  const idKorelasi = typeof kiriman === 'string' && kiriman.length <= 100 ? kiriman : randomUUID();
  res.setHeader('x-id-korelasi', idKorelasi);
  konteks.run({ idKorelasi }, () => {
    if (req.path !== '/sehat') log.log('permintaan masuk', { idKorelasi, metode: req.method, alamat: req.path });
    next();
  });
}
