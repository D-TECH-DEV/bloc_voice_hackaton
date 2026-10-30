import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration : devis commerciaux issus des conversations vocales.
 * - Un seul devis par session (`session_id` unique : idempotence des
 *   finalisations répétées, aucun doublon).
 * - Numéro unique généré côté serveur, jeton de téléchargement unique.
 * - Lignes et total figés en JSONB (snapshot à la génération).
 * - Réversible : `down` supprime la table.
 */
export class Quotes1760000000002 implements MigrationInterface {
  name = 'Quotes1760000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "quotes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "numero" varchar(32) NOT NULL,
        "session_id" uuid NOT NULL,
        "customer_ref" varchar(128),
        "statut" varchar(16) NOT NULL DEFAULT 'provisoire',
        "source" varchar(8) NOT NULL DEFAULT 'mock',
        "lignes" jsonb NOT NULL,
        "total_montant" numeric(14,2),
        "total_devise" varchar(8),
        "raisons" jsonb NOT NULL DEFAULT '[]',
        "download_token" varchar(64) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_quotes_statut" CHECK ("statut" IN ('provisoire','définitif')),
        CONSTRAINT "chk_quotes_source" CHECK ("source" IN ('mock','core','mixed')),
        CONSTRAINT "uq_quotes_numero" UNIQUE ("numero"),
        CONSTRAINT "uq_quotes_session" UNIQUE ("session_id"),
        CONSTRAINT "uq_quotes_download_token" UNIQUE ("download_token")
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "quotes"`);
  }
}
