import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

export const ADMIN_TOKEN = 'e2e-admin-token-fictif-0123456789';
export const SALES_TOKEN = 'e2e-sales-token-fictif-0123456789';
export const TOOL_SECRET = 'e2e-tool-secret-fictif-0123456789';

export interface E2EContext {
  app: INestApplication;
  api: request.SuperTest<request.Test>;
  dataSource: DataSource;
}

export async function createE2EApp(): Promise<E2EContext> {
  process.env.NODE_ENV = 'test';
  process.env.OPERATOR_ADMIN_TOKEN = ADMIN_TOKEN;
  process.env.OPERATOR_SALES_TOKEN = SALES_TOKEN;
  process.env.VOICE_TOOL_SECRET = TOOL_SECRET;
  process.env.MOCK_CORE = 'true';
  process.env.ENABLE_CORE_WRITES = 'false';
  process.env.OUTBOUND_CALLS_ENABLED = 'false';
  process.env.SCHEDULER_ENABLED = 'false';
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  const dataSource = app.get(DataSource);
  // Base de test dédiée : purge complète avant chaque suite.
  for (const table of [
    'decision_logs',
    'operator_actions',
    'call_attempts',
    'outreach_tasks',
    'consent_events',
    'voice_consents',
    'material_list_items',
    'material_lists',
    'handoffs',
    'system_activations',
  ]) {
    await dataSource.query(`DELETE FROM "${table}"`);
  }
  return { app, api: request(app.getHttpServer()), dataSource };
}

export const adminAuth = { Authorization: `Bearer ${ADMIN_TOKEN}` };
export const salesAuth = { Authorization: `Bearer ${SALES_TOKEN}` };
export const toolAuth = { 'x-voice-tool-secret': TOOL_SECRET };
