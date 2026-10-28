import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration initiale : socle du moteur de relance (9 tables).
 * Relue avant application : aucune donnée personnelle, aucune valeur par défaut
 * n'autorise un appel ; l'absence de consentement signifie « inconnu ».
 */
export class InitRelance1760000000000 implements MigrationInterface {
  name = 'InitRelance1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`
      CREATE TABLE "voice_consents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "customer_ref" varchar(128) NOT NULL,
        "channel" varchar(32) NOT NULL DEFAULT 'voice',
        "status" varchar(16) NOT NULL,
        "source" varchar(32) NOT NULL,
        "event_at" timestamptz NOT NULL,
        "proof_ref" varchar(256),
        "changed_by" varchar(128) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_consent_status" CHECK ("status" IN ('granted','refused','withdrawn'))
      )`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_voice_consents_customer" ON "voice_consents" ("customer_ref","channel")`);
    await queryRunner.query(`
      CREATE TABLE "consent_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "consent_id" uuid NOT NULL REFERENCES "voice_consents"("id") ON DELETE CASCADE,
        "from_status" varchar(16),
        "to_status" varchar(16) NOT NULL,
        "source" varchar(32) NOT NULL,
        "proof_ref" varchar(256),
        "changed_by" varchar(128) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`
      CREATE INDEX "idx_consent_events_consent" ON "consent_events" ("consent_id","created_at")`);
    await queryRunner.query(`
      CREATE TABLE "outreach_tasks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "customer_ref" varchar(128) NOT NULL,
        "organization_id" integer,
        "kind" varchar(32) NOT NULL,
        "motive" text NOT NULL,
        "core_ref" varchar(128),
        "status" varchar(16) NOT NULL DEFAULT 'pending',
        "priority" varchar(8) NOT NULL DEFAULT 'normal',
        "due_at" timestamptz NOT NULL,
        "next_action" text,
        "attempt_count" integer NOT NULL DEFAULT 0,
        "idempotency_key" varchar(128) NOT NULL,
        "last_evaluation" jsonb,
        "claimed_by" varchar(128),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_task_status" CHECK ("status" IN ('pending','claimed','in_progress','done','cancelled','blocked','awaiting_human')),
        CONSTRAINT "chk_task_priority" CHECK ("priority" IN ('low','normal','high'))
      )`);
    await queryRunner.query(`
      CREATE INDEX "idx_tasks_status_due" ON "outreach_tasks" ("status","due_at");
      CREATE INDEX "idx_tasks_customer" ON "outreach_tasks" ("customer_ref");
      CREATE UNIQUE INDEX "idx_tasks_idempotency" ON "outreach_tasks" ("idempotency_key")`);
    await queryRunner.query(`
      CREATE TABLE "call_attempts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "task_id" uuid NOT NULL REFERENCES "outreach_tasks"("id") ON DELETE CASCADE,
        "provider_call_id" varchar(128),
        "claim_status" varchar(16) NOT NULL DEFAULT 'created',
        "started_at" timestamptz,
        "finished_at" timestamptz,
        "outcome" varchar(16),
        "summary" varchar(500),
        "next_action" text,
        "technical_error" varchar(500),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_attempt_claim" CHECK ("claim_status" IN ('created','started','finished','unknown')),
        CONSTRAINT "chk_attempt_outcome" CHECK ("outcome" IS NULL OR "outcome" IN ('completed','no_answer','failed','refused'))
      )`);
    await queryRunner.query(`
      CREATE INDEX "idx_attempts_task" ON "call_attempts" ("task_id","created_at")`);
    await queryRunner.query(`
      CREATE TABLE "decision_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "task_id" uuid,
        "attempt_id" uuid,
        "decision" varchar(8) NOT NULL,
        "evaluated_at" timestamptz NOT NULL,
        "rule_version" varchar(16) NOT NULL,
        "reason_codes" text[] NOT NULL,
        "facts" jsonb,
        "requested_by" varchar(128) NOT NULL,
        CONSTRAINT "chk_decision" CHECK ("decision" IN ('allow','block'))
      )`);
    await queryRunner.query(`
      CREATE INDEX "idx_decisions_task" ON "decision_logs" ("task_id","evaluated_at")`);
    await queryRunner.query(`
      CREATE TABLE "material_lists" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "customer_ref" varchar(128) NOT NULL,
        "project_ref" varchar(128),
        "status" varchar(16) NOT NULL DEFAULT 'draft',
        "created_by" varchar(128) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_list_status" CHECK ("status" IN ('draft','confirmed'))
      )`);
    await queryRunner.query(`
      CREATE INDEX "idx_material_lists_customer" ON "material_lists" ("customer_ref")`);
    await queryRunner.query(`
      CREATE TABLE "material_list_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "list_id" uuid NOT NULL REFERENCES "material_lists"("id") ON DELETE CASCADE,
        "variant_id" integer,
        "free_label" varchar(256) NOT NULL,
        "qty" numeric(14,3) NOT NULL,
        "unit" varchar(32) NOT NULL,
        "resolved" boolean NOT NULL DEFAULT false,
        "unit_price" numeric(14,2),
        "created_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`
      CREATE INDEX "idx_material_items_list" ON "material_list_items" ("list_id")`);
    await queryRunner.query(`
      CREATE TABLE "handoffs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "task_id" uuid,
        "customer_ref" varchar(128) NOT NULL,
        "motive" text NOT NULL,
        "summary" text NOT NULL,
        "priority" varchar(8) NOT NULL DEFAULT 'normal',
        "status" varchar(16) NOT NULL DEFAULT 'pending',
        "claimed_by" varchar(128),
        "claim_report" text,
        "external_notification_ref" varchar(128),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_handoff_status" CHECK ("status" IN ('pending','claimed','resolved','requalified'))
      )`);
    await queryRunner.query(`
      CREATE INDEX "idx_handoffs_status" ON "handoffs" ("status","created_at")`);
    await queryRunner.query(`
      CREATE TABLE "operator_actions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "actor" varchar(128) NOT NULL,
        "action" varchar(64) NOT NULL,
        "target" varchar(128),
        "detail" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`
      CREATE INDEX "idx_operator_actions_actor" ON "operator_actions" ("actor","created_at")`);
    await queryRunner.query(`
      CREATE TABLE "system_activations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "key" varchar(64) NOT NULL UNIQUE,
        "active" boolean NOT NULL DEFAULT false,
        "activated_by" varchar(128),
        "activated_at" timestamptz,
        "note" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "system_activations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "operator_actions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "handoffs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "material_list_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "material_lists"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "decision_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "call_attempts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "outreach_tasks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consent_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "voice_consents"`);
  }
}
