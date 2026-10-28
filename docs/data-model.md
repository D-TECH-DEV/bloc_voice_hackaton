# Modèle de données — BLOK Relance

Migration : `backend/migrations/1760000000000-InitRelance.ts` (9 tables).
`synchronize` est toujours faux : le schéma évolue par migrations relues.
Les références Core (`customer_ref`, `core_ref`, `rfq_number`) sont des
références externes (varchar), jamais de fausses clés étrangères distantes.

## Tables

### `voice_consents` — état opposable courant
- `id` (uuid), `customer_ref` + `channel` (= `voice`, unique ensemble),
  `status` (`granted` | `refused` | `withdrawn`), `source`, `event_at`,
  `proof_ref` (référence de preuve, jamais la transcription), `changed_by`.
- **Absence de ligne = consentement inconnu = appel bloqué.** Jamais d'accord par défaut.

### `consent_events` — historique immuable
- `consent_id` (FK cascade), `from_status` (NULL à la création), `to_status`,
  `source`, `proof_ref`, `changed_by`, `created_at`. Index `(consent_id, created_at)`.

### `outreach_tasks` — file de tâches
- `customer_ref`, `organization_id?`, `kind`
  (`rfq_followup` | `quote_followup` | `project_checkin` | `manual`),
  `motive` (≥ 10 caractères), `core_ref?`, `status` (`pending` | `claimed` |
  `in_progress` | `done` | `cancelled` | `blocked` | `awaiting_human`),
  `priority`, `due_at`, `next_action?`, `attempt_count`, `idempotency_key`
  (unique), `last_evaluation` (jsonb), `claimed_by?`.
- Transitions fermées (voir `OutreachTasksService.TRANSITIONS`) :
  `pending → claimed|cancelled|blocked`, `claimed → in_progress|cancelled|blocked`,
  `in_progress → done|blocked|awaiting_human|cancelled`,
  `blocked → pending|cancelled`, `awaiting_human → done|cancelled`.
- Index `(status, due_at)` (balayage), `(customer_ref)`, unicité idempotence.

### `call_attempts` — tentatives
- `task_id` (FK cascade), `provider_call_id?`, `claim_status`
  (`created` | `started` | `finished` | `unknown`), `started_at?`,
  `finished_at?`, `outcome` (`completed` | `no_answer` | `failed` | `refused` |
  NULL), `summary` (≤ 500), `next_action?`, `technical_error?` (expurgée).
- **Outcome NULL = résultat inconnu, jamais interprété comme un échec.**

### `decision_logs` — journal des décisions
- `task_id?`, `attempt_id?`, `decision` (`allow` | `block`), `evaluated_at`,
  `rule_version`, `reason_codes[]`, `facts` (jsonb minimal, pas de données
  personnelles), `requested_by`. Index `(task_id, evaluated_at)`.

### `material_lists` + `material_list_items` — brouillons
- Liste : `customer_ref`, `project_ref?`, `status` (`draft` | `confirmed`),
  `created_by`. Ligne : `variant_id?` (NULL = non résolue, jamais substituée),
  `free_label`, `qty` (numeric 14,3), `unit`, `resolved`, `unit_price?`
  (NULL = non vérifié, jamais inventé).
- **Confirmée ≠ devis ≠ commande.**

### `handoffs` — transferts
- `task_id?`, `customer_ref`, `motive`, `summary`, `priority`, `status`
  (`pending` | `claimed` | `resolved` | `requalified`), `claimed_by?`
  (accusé de reprise), `claim_report?`, `external_notification_ref?`
  (NULL = enregistrement interne seul tant que le contrat notifications
  n'est pas validé).

### `operator_actions` — actions sensibles
- `actor`, `action`, `target?`, `detail?` (jsonb), `created_at`.

### `system_activations` — verrous explicites
- `key` (unique, ex. `telephony_outbound`), `active`, `activated_by?`,
  `activated_at?`, `note?`. Second verrou avec `OUTBOUND_CALLS_ENABLED`.

## Concurrence et intégrité

- Réservation : `UPDATE … WHERE status='pending'` atomique (un seul gagnant,
  testé en e2e) ; tentative créée + compteur incrémenté en transaction.
- Idempotence : rejouer `idempotency_key` (tâche), outcome ou RFQ renvoie
  l'objet existant sans doublon.
- Rétention : durées à fixer avec le DPO (question ouverte) ; transcriptions
  non conservées par défaut, preuves = références.
