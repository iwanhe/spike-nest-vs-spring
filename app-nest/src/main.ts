import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { pasangIdKorelasi } from './umum/konteks.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // LOG_JSON=1: satu baris log = satu objek JSON, siap dibaca alat pengumpul log.
    logger: process.env.LOG_JSON === '1' ? new ConsoleLogger({ json: true, flattenParams: true }) : undefined,
  });
  app.use(pasangIdKorelasi);
  app.enableShutdownHooks(); // saat dihentikan, pekerjaan dikembalikan ke antrian
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
