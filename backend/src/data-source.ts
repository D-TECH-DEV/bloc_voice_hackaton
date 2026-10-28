import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as entities from './entities';

/**
 * Source TypeORM pour le CLI (migrations versionnées).
 * `synchronize` reste TOUJOURS faux : le schéma évolue par migrations relues.
 */
const isTest = process.env.NODE_ENV === 'test';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'blok_relance',
  password: process.env.DB_PASSWORD ?? '',
  database: isTest
    ? (process.env.DB_NAME_TEST ?? 'blok_relance_test')
    : (process.env.DB_NAME ?? 'blok_relance'),
  entities: Object.values(entities),
  migrations: ['migrations/*.ts'],
  synchronize: false,
  logging: false,
});

export default AppDataSource;
