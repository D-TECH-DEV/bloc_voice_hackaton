import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration : contexte de conversation vocale (BLOK Relance).
 * Relie une session vocale à ses recherches catalogue, aux produits
 * récupérés/recommandés et aux sélections explicitement confirmées.
 * - Aucune transcription ni donnée personnelle supplémentaire stockée.
 * - Totaux calculés à la lecture, jamais persistés (pas de prix obsolète).
 * - Réversible : `down` supprime les 3 tables dans l'ordre inverse.
 */
export class VoiceSessions1760000000001 implements MigrationInterface {
  name = 'VoiceSessions1760000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "voice_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "customer_ref" varchar(128),
        "status" varchar(16) NOT NULL DEFAULT 'active',
        "source" varchar(8) NOT NULL DEFAULT 'mock',
        "rfq_number" varchar(128),
        "rfq_mock" boolean,
        "created_by" varchar(128) NOT NULL,
        "started_at" timestamptz NOT NULL DEFAULT now(),
        "ended_at" timestamptz,
        CONSTRAINT "chk_voice_session_status" CHECK ("status" IN ('active','ended')),
        CONSTRAINT "chk_voice_session_source" CHECK ("source" IN ('mock','core','mixed'))
      )`);
    await queryRunner.query(`
      CREATE INDEX "idx_voice_sessions_customer" ON "voice_sessions" ("customer_ref")`);
    await queryRunner.query(`
      CREATE TABLE "voice_session_searches" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "session_id" uuid NOT NULL REFERENCES "voice_sessions"("id") ON DELETE CASCADE,
        "query" varchar(120) NOT NULL,
        "result_count" integer NOT NULL DEFAULT 0,
        "source" varchar(8) NOT NULL DEFAULT 'mock',
        "searched_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_voice_search_source" CHECK ("source" IN ('mock','core'))
      )`);
    await queryRunner.query(`
      CREATE INDEX "idx_voice_searches_session" ON "voice_session_searches" ("session_id")`);
    await queryRunner.query(`
      CREATE TABLE "voice_session_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "session_id" uuid NOT NULL REFERENCES "voice_sessions"("id") ON DELETE CASCADE,
        "search_id" uuid REFERENCES "voice_session_searches"("id") ON DELETE SET NULL,
        "variant_id" integer,
        "ref" varchar(128),
        "label" varchar(256) NOT NULL,
        "qty" numeric(14,3),
        "unit" varchar(32),
        "unit_price" numeric(14,2),
        "currency" varchar(8),
        "resolved" boolean NOT NULL DEFAULT false,
        "selected" boolean NOT NULL DEFAULT false,
        "source" varchar(8) NOT NULL DEFAULT 'mock',
        "fetched_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_voice_item_source" CHECK ("source" IN ('mock','core'))
      )`);
    await queryRunner.query(`
      CREATE INDEX "idx_voice_items_session" ON "voice_session_items" ("session_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "voice_session_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "voice_session_searches"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "voice_sessions"`);
  }
}
