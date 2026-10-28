# Architecture — BLOK Relance

## Vue d'ensemble

```
┌─────────────┐   X-API-Key (serveur)   ┌──────────────┐
│  Core API   │◄────────────────────────│   Backend    │
│  BLOK       │   lecture + écritures   │   NestJS     │
│  (vérité)   │   autorisées seulement  │   :3001      │
└─────────────┘                         └──────┬───────┘
                                               │ outils HTTPS (secret partagé)
                                               ▼
                                        ┌──────────────┐      ┌──────────────┐
                                        │  AethexAI    │─────►│   Interface  │
                                        │  (exécutant) │      │   Next.js    │
                                        └──────────────┘      │   :3000      │
                                                              └──────────────┘
```

Le proxy Flask existant (`blok_voice/`, port 5000) est inchangé : signalisation
WebRTC navigateur. Le backend NestJS (port 3001) porte le métier ; l'interface
Next.js (port 3000) ne parle qu'au backend via des appels serveur (le jeton
opérateur ne quitte jamais le serveur Next).

## Décisions structurantes

- **NestJS + TypeORM + PostgreSQL.** TypeORM retenu plutôt que Prisma : pas de
  téléchargement de moteurs binaires (réseau contraint), migrations SQL
  versionnées relisibles, un seul ORM.
- **Pas de Redis/BullMQ.** Indisponible dans l'environnement (pas de binaire,
  pas de Docker). La file est en base : réservation atomique
  (`UPDATE … WHERE status='pending'`, un seul gagnant) et balayage périodique
  (`DueTasksScheduler`, réévaluation seule). BullMQ reste l'option documentée
  pour la montée en charge (voir `runbook.md`).
- **PostgreSQL local** initialisé dans `backend/.pgdata` (ignoré par Git),
  socket Unix désactivé (sandbox), TCP `127.0.0.1:5432`.
- **Fuseau métier** `Africa/Abidjan` (UTC toute l'année), configurable via
  `BUSINESS_TIMEZONE`. Valeurs de prudence : 3 tentatives max, 72 h entre
  tentatives, silence 20 h–8 h (à valider métier/juridique).

## Modules

| Module | Rôle |
|---|---|
| `CoreIntegrationModule` | Frontière anti-corruption : seul accès au Core (timeout 8 s, erreurs typées, mode secours `mock`) |
| `VoiceConsentsModule` | Registre opposable des consentements/oppositions + historique |
| `OutreachTasksModule` | File de tâches, transitions fermées, réservation atomique |
| `CallAttemptsModule` | Tentatives, outcomes idempotents, refus ⇒ opposition auto |
| `DecisionEngineModule` | Règles pures v1.0.0, sans I/O (voir `decision-engine.md`) |
| `TelephonyModule` | Double verrou + fournisseur inerte (aucun appel ne peut partir) |
| `MaterialListsModule` | Brouillons de listes (prix vérifié ou NULL) |
| `HandoffsModule` | Transferts + accusés de reprise persistés |
| `VoiceToolsModule` | 6 outils HTTPS pour l'agent (allowlist, secret, corrélation) |
| `AuditModule` | `decision_logs` + actions opérateurs |
| `SchedulerModule` | Balayage : réévalue, journalise, bloque sous opposition. Ne compose rien |
| `AuthModule` | Gardes jeton opérateur (rôles) et secret outils |
| `AdminModule` | Journaux, activations explicites (admin seul) |
| `HealthModule` | `/health` public : mode, état Core, téléphonie |

## Flux d'une relance (mode manuel actuel)

1. Opérateur (ou import ultérieur) crée une tâche avec motif + idempotence.
2. `POST /tasks/:id/evaluate` : le moteur lit consentement, tentatives,
   identité attestée, dispo Core, verrou téléphonie → décision + log.
3. En `manual_only`, toute décision contient `TELEPHONY_DISABLED` : aucun appel.
4. Le résultat (outil vocal ou opérateur) arrive sur `call-outcomes` ;
   `refused` crée une opposition immédiate et bloque la tâche.
5. Dossier complexe → `handoffs` (prise en charge et clôture persistées).
