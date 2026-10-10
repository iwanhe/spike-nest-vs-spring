import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowsModule, WorkflowStorage } from '@nestjs/workflows';
import { fromTypeOrm, PostgresWorkflowStore } from '@nestjs/workflows/postgres';
import { DataSource } from 'typeorm';
import { LaporanController } from './laporan/laporan.controller.js';
import { PengajuanModule } from './pengajuan/pengajuan.module.js';
import { PersetujuanController } from './persetujuan/persetujuan.controller.js';
import { PersetujuanWorkflow } from './persetujuan/persetujuan.workflow.js';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: false, // skema dikelola Flyway, bukan aplikasi
    }),
    WorkflowsModule.forRoot(),
    PengajuanModule,
  ],
  controllers: [LaporanController, PersetujuanController],
  providers: [
    {
      // Proses persetujuan disimpan di PostgreSQL, di skema nest_workflows.
      provide: PostgresWorkflowStore,
      inject: [DataSource, WorkflowStorage],
      useFactory: (dataSource: DataSource, storage: WorkflowStorage) =>
        new PostgresWorkflowStore({ executor: fromTypeOrm(dataSource) }, storage),
    },
    PersetujuanWorkflow,
  ],
})
export class AppModule {}
