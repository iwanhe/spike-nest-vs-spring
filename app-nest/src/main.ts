import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks(); // saat dihentikan, pekerjaan dikembalikan ke antrian
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
