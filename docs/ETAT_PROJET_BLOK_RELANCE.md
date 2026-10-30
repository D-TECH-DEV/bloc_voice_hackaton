# BLOK Relance — Rapport d'état technique

- **Date et heure de l'audit :** 2026-10-29 10:56 GMT
- **Branche Git :** `feature/moteur-relance`
- **Commit HEAD :** `b8b6ec4`
- **État du dépôt :** 1 fichier modifié non commité : `M backend/src/main.ts` (écoute `0.0.0.0`, fix Docker appliqué et vérifié — voir §J). Rien d'autre en `git status --short`.
- **Dernier audit :** aucun rapport précédent trouvé dans `docs/` — ceci est le premier audit `ETAT_PROJET_BLOK_RELANCE.md`.
- **Phase 1 (validation du socle) :** exécutée le 2026-10-29 vers 12:30-13:00 GMT, même branche/commit (`feature/moteur-relance`, `b8b6ec4`), `M backend/src/main.ts` préservé. Détails en §§C, G, I, J.
- **Phases démo WebRTC (hackathon) :** exécutées le 2026-10-29 vers 13:00-13:30 GMT, mêmes branche/commit et garde-fous (`MOCK_CORE=true`, écritures verrouillées, `OUTBOUND_CALLS_ENABLED=false`, aucun appel réel, aucun commit). Détail en §N (nouveau).
- **Méthode :** audit multi-agents en lecture seule (4 chercheurs : backend, frontend, vocal+BDD, docker/sécurité) + synthèse, complété par vérifications Docker directes de l'auditeur (voir §C/I). Aucun secret n'est reproduit : présence/absence uniquement.

## A. Résumé exécutif

- **État général :** socle applicatif complet et cohérent (backend NestJS, frontend Next.js, proxy vocal Flask, Postgres 18, Compose 5 services). Le code métier central (tâches, consentements, décisions, transferts, garde-fous) est implémenté et lu en intégralité. L'infrastructure Docker locale **fonctionne à l'heure de l'audit** (tous services `healthy`, migration `exited 0`, connectivité frontend→backend 200).
- **Principaux composants opérationnels :** backend `/health` 200 `manual_only` ; frontend 200 avec 6 routes réelles ; proxy vocal `/health` ok (`aethex_configured:true`, `agent_configured:true`) ; Postgres healthy ; appels authentifiés frontend→backend 200 (tasks, decisions admin).
- **Blocages majeurs :** (1) agent vocal AethexAI sans outils enregistrés → conversation générique, aucune opération métier via la voix ; (2) intégration Core réelle non vérifiée (`MOCK_CORE=true`, écritures verrouillées, contrat `/notifications` non vérifié). Le point (3) de l'audit initial (suites jamais ré-exécutées) est **levé par la Phase 1** : 41/41 backend + 15/15 vocal, voir §I.
- **Prochaine étape recommandée :** Phase P1 — enregistrer les 6 outils backend sur l'agent AethexAI (procédure `docs/voice-tools.md`), puis test réseau réel `/conversation/connect` + `/offer` (toujours sans appel téléphonique réel).
- **Niveau de confiance :** élevé sur le code, le runtime Docker, le schéma SQL (vérifié en direct §G) et les suites de tests (exécutées §I) ; moyen sur le vocal de bout en bout et le Core réel (non rejoués).

## B. État des composants

| Composant | État | Preuve | Blocage | Prochaine action |
|---|---|---|---|---|
| Backend NestJS | TERMINÉ ET VÉRIFIÉ | `backend/src/app.module.ts:27-59` ; `/health` 200 ; tasks/decisions 200 via frontend | Aucun (runtime ok) | Ré-exécuter suites unit/e2e |
| Frontend commercial | TERMINÉ ET VÉRIFIÉ | 6 routes présentes ; `http://127.0.0.1:3000/` 200 ; zéro `use client` | Aucun | Fumées 5 pages à rejouer |
| Stack Docker Compose | TERMINÉ ET VÉRIFIÉ | `config --quiet` OK ; `ps -a` 4 Up healthy + migrate exited 0 | Aucun | Surveiller persistance `pgdata` |
| Base PostgreSQL + migrations | TERMINÉ ET VÉRIFIÉ | 11 tables (`\dt`), 1 migration, index/CHECK/FK conformes (Phase 1 §G) | Écart 9-vs-10 à documenter (K5) | ADR : commentaire migration + FK `decision_logs` |
| Service vocal Flask (proxy) | PARTIELLEMENT IMPLÉMENTÉ | Signalisation validée de bout en bout (session 200, answer SDP, `connected` + 988 frames audio, §N) ; agent sans outils (`GET …/tools` → 0) ; script `register_tools.py` prêt, `--apply` bloqué (pas d'hôte HTTPS public) | Enregistrement distant impossible en local | Obtenir hôte public puis `--apply`, rejouer `docs/demo-webrtc.md` A+B |
| Intégration Core BLOK | PARTIELLEMENT IMPLÉMENTÉ | `blok-core.client.ts:13-86` + adapters ; `MOCK_CORE=true`, écritures 409 | Clé réelle + contrats non vérifiés | Valider routes/quotas/webhooks |
| Appels sortants téléphonie | NON IMPLÉMENTÉ | `placeCall` jette toujours 403/501 ; `OUTBOUND_CALLS_ENABLED=false` en dur (`docker-compose.yml:71`) | Volontaire (sécurité) | Procédure signée `docs/runbook.md` avant tout câble |
| Suites de tests (41 + 21) | TERMINÉ ET VÉRIFIÉ | unit 28/28, e2e 13/13, vocal 21/21 (dont 6 `register_tools`), typechecks + builds OK (§I, §N) | Incident build/dev résolu (§C) | Surveiller : warning teardown jest, `/_not-found` transitoire |

## C. État Docker

`docker compose --env-file .env.docker config --quiet` → `CONFIG_OK` (exit 0). Sans env : échec attendu (variables requises `POSTGRES_PASSWORD`, `VOICE_TOOL_SECRET`, `OPERATOR_*`).

| Service | État observé (`ps -a`) | Healthcheck | Dépendances | Erreurs | Preuve |
|---|---|---|---|---|---|
| `postgres` (18-alpine) | Up healthy | `pg_isready` (start 20s) | — | Aucune | `ps` + log migrate `SELECT version()` ok |
| `migrate` | Exited 0 | `service_completed_successfully` | postgres healthy | Aucune | log : `No migrations are pending` |
| `backend-api` | Up healthy | `GET /health` (start 40s) | postgres + migrate | Aucune (après fix §J) | `/health` 200 `manual_only`, `mock_core:true` |
| `frontend-commercial` | Up healthy | `GET /` (start 60s) | backend-api healthy | Aucune | host `:3000` → 200 |
| `voice-agent` | Up healthy | `urllib /health` (start 30s) | — | Aucune | `:5000/health` → `aethex_configured:true, agent_configured:true` |

- Réseau : `bloknet` unique (bridge) ; inter-conteneurs vérifié : `F2B-HEALTH 200`, `F2B-TASKS 200`, `F2B-DECISIONS 200` exécutés depuis le conteneur frontend vers `http://backend-api:3001`.
- `.env.docker` : PRÉSENT (clés alignées sur `.env.docker.example` + reliquat historique `API_KEY`) ; `.gitignore` couvre `.env` et `.env.docker`. Valeurs jamais affichées.
- Note : les chercheurs sandbox avaient marqué le runtime NON VÉRIFIÉ (socket daemon refusé dans leur namespace) ; l'auditeur a levé ce point par vérification directe avec droits escaladés le 2026-10-29 10:56 GMT.
- **Phase 1 — incident build/dev (résolu) :** le `npm run build` exécuté dans le conteneur `frontend-commercial-1` (qui fait tourner `next dev` sur le même volume) a corrompu le `.next` partagé : `Cannot find module './611.js'`, `/_app` undefined → HTTP 500 sur toutes les pages, conteneur passé `unhealthy`. Preuves conservées (logs `docker logs`, sorties build). Cause : build prod et serveur dev concurrents sur un seul `.next`. Correction ciblée (sans toucher au code ni aux données) : `rm -rf /app/.next` + `docker restart` → 200 sur les 5 pages, `healthy` de nouveau. Leçon : à l'avenir, builder dans un conteneur/étape dédié (ex. `docker build` multi-stage), jamais dans le conteneur dev. Le premier `build` avait aussi échoué une fois sur `[Error: Invariant: no direct app page entry found for /_not-found]` (état transitoire du même cache) ; le rebuild affiche les 7 routes et exit 0.

## D. État du backend

Modules (`backend/src/app.module.ts:27-59`) : ConfigModule + TypeOrmModule (`synchronize:false`) + Auth, Audit, CoreIntegration, DecisionEngine, Telephony, VoiceConsents, OutreachTasks, CallAttempts, MaterialLists, Handoffs, VoiceTools, Scheduler, Admin.

| Méthode | Chemin | Objectif | Vérification |
|---|---|---|---|
| GET | `/health` (public) | Statut, mode, flags (`telephony_activated:false`) | VÉRIFIÉ 200 en direct |
| GET/POST | `/api/v1/relance/tasks` (+ `/:id`, `/cancel`, `/evaluate`, `/attempts`, `/decisions`, `PATCH :priority` admin) | CRUD + cycle de vie + réévaluation journalisée | VÉRIFIÉ (list 200 via frontend ; code lu `tasks.controller.ts:31-145`) |
| GET/POST | `/api/v1/relance/consents/:ref`, `/history`, `/record`, `/opt-out` | Consentement/opposition (levée = admin seul) | IMPLÉMENTÉ, lecture seule |
| POST | `/api/v1/relance/call-outcomes` | Enregistre issue (`completed/no_answer/failed/refused`) | IMPLÉMENTÉ, lecture seule |
| POST/GET | `/api/v1/relance/material-lists` (+ `:id/confirm`) | Brouillon ≠ devis, variante non résolue possible | IMPLÉMENTÉ, lecture seule |
| GET/POST | `/api/v1/relance/handoffs` (+ `:id/claim`, `:id/resolve`) | File de reprise humaine | VÉRIFIÉ (claim/resolve lus ; list 200 indirect via dashboard) |
| POST ×6 | `/api/v1/relance/tools/*` (`catalog-search`, `prepare-material-list`, `confirm-rfq`, `record-call-outcome`, `record-voice-opt-out`, `request-human-handoff`) | Outils agent vocal (garde `x-voice-tool-secret`) ; aucun `place-call` (e2e attend 404) | IMPLÉMENTÉ, NON VÉRIFIÉ en exécution |
| GET/POST | `/api/v1/admin/decisions`, `/activations`, `/activations/:key` (admin) | Journal + interrupteurs (`telephony_outbound`) | VÉRIFIÉ (decisions 200 via frontend) |

- Auth : `OperatorTokenGuard` (`operator-token.guard.ts:28-67`, schéma Bearer (comparaison `sha256`/`timingSafeEqual`), 401 fermé par défaut, rôles admin/sales, non global → `/health` et `/api/docs` publics) ; `VoiceToolGuard` (`voice-tool.guard.ts:17-31`, secret ≥ 16 chars sinon 503 `TOOLS_DISABLED`).
- Validation : `ValidationPipe` global (`main.ts:11-17`, whitelist + forbid + transform) ; DTO stricts (`tasks.dto.ts:13-71`, consents, `voice-tools.dto.ts:18-130`) ; config `zod` avec échec rapide (`configuration.ts:16-47`).
- Core externe : client unique `blok-core.client.ts:13-86` (`X-API-Key` confinée, timeout 8s, `isMockMode = MOCK_CORE || clé vide`, `assertWritesEnabled` sinon 409) ; adapters catalogue/RFQ/clients avec mocks (`DEMO`, `MOCK_CUSTOMERS`, prix/téléphone non vérifiés) et écritures verrouillées ; `POST /notifications` volontairement non appelé (409 `Contrat non vérifié`) ; erreurs mappées 502 (`core-errors.ts:20-45`).
- Moteur décision : pur sans I/O v1.0.0, 11 codes (`decision-engine.service.ts:55-98`), `allowed = zéro code`, doute = bloque ;Scheduler `due-tasks.scheduler.ts:33-87` réévalue/journalise/bloque, ne compose jamais.
- Scripts (`backend/package.json:7-18`) : `build/start/start:dev/start:prod/test/test:e2e/typeorm/migration:*/typecheck`.

## E. État du frontend

- Routes réelles (6) : `/` dashboard (`app/page.tsx:25`), `/taches` (`app/taches/page.tsx:32`), `/taches/[id]` (`app/taches/[id]/page.tsx:50`), `/transferts` (`app/transferts/page.tsx:31`), `/decisions` (`app/decisions/page.tsx:13`), `/consents` (`app/consents/page.tsx:13`) + layout/nav (`app/layout.tsx:20-30`).
- Parcours fonctionnels (lus, non cliqués dans cet audit) : dashboard compteurs + tâches échues liées ; `/taches` filtre `?status` + création manuelle via Server Action (`createTask` POST, note « ne déclenche aucun appel ») ; fiche tâche (réévaluer éligibilité `identityVerified`, annuler, tentatives/décisions, consentement vocal) ; `/transferts` claim (pending) puis resolve ; `/consents` consultation `?ref` + opt-out effet immédiat ; `/decisions` journal lecture seule.
- Appels API : aucun `fetch` navigateur, aucun `use client`, aucun `app/api` (vérifié `ls` + `grep` vides). Tout passe par `callBackend()` serveur (`lib/backend.ts`) : `BACKEND_URL ?? http://127.0.0.1:3001`, Bearer `OPERATOR_TOKEN` / `OPERATOR_ADMIN_TOKEN`, `cache: no-store`. Sans jeton → 503 ; `catch` → 502 « Backend injoignable » (`lib/backend.ts:34-35`) ; la mention « routes same-origin `/api/backend/*` » n'existe qu'en commentaire, sans route implémentée.
- Données : aucun mock en dur (seul « fixtures » affiché vient de `health.mock_core` réel) ; mentions « données réellement présentes, aucun score/taux » ; états vides/erreurs explicites par page. Bannière : `GET /health` → « backend injoignable » si ko, sinon mode + « Core en mode secours (fixtures) » si mock ; texte statique « aucun appel commercial automatique / Fournisseur vocal : non validé ».
- Config : Next `^15.1.6`, React `^19` (`package.json:1-9`) ; `Dockerfile` node:22 + `dev --hostname 0.0.0.0:3000`.

## F. État du service vocal

- Serveur (`blok_voice/agent/server.py`) : proxy WebRTC AethexAI — `GET /` (client), `GET /health` (`{status, aethex_configured, agent_configured}` → ok/true/true en direct), `POST /session` (proxy `/conversation/connect {agent_id}`), `POST /session/<sid>/offer` (proxy `/offer {sdp,type}`) ; clé via `X-API-Key`, CORS limité, zéro appel au backend NestJS, zéro persistance.
- Agent (`blok_voice/agent/create_agent.py`) : crée/réutilise « BLOK Voice Copilot » (prompt FR ~377 lignes, voix Nadège CI, `language: french`) mais **aucun `add_agent_tool`** → agent sans outils côté AethexAI.
- Les 6 outils backend existent et sont gardés (`voice-tools.controller.ts`, `VoiceToolGuard`) : `record-call-outcome` (`refused` ⇒ opt-out auto, `CallAttemptsService l.71-72`), `confirm-rfq` (`confirmationClient===true` exigée sinon 422), etc. Procédure d'enregistrement en attente (`docs/voice-tools.md`).
- Verdict : conversation WebRTC navigateur↔AethexAI **possible sur le papier si clés valides** (présence confirmée, validité réseau NON rejouée — aucun appel sortant effectué pendant l'audit) ; **l'agent ne peut pas réellement mener un scénario métier** (recherche produit, RFQ, transfert) tant que les outils ne sont pas enregistrés ; **aucun appel téléphonique sortant possible** (triple verrou §H).

## G. Base de données

- Migration `1760000000000-InitRelance.ts:11-166` lue : **10 `CREATE TABLE` réellement** alors que le commentaire annonce « 9 tables » (incohérence mineure reprise dans `docs/data-model.md` et `implementation-status.md`) : `voice_consents` (UNIQUE customer+channel, CHECK 3 statuts), `consent_events` (FK cascade, immuable, `from` NULL à création), `outreach_tasks` (CHECK statuts/priorités, UNIQUE `idempotency_key`, index status/due + customer), `call_attempts` (FK cascade, claim/outcome contraints, outcome NULL jamais interprété comme échec), `decision_logs` (allow/block, `reason_codes[]`, `facts jsonb`, `task_id/attempt_id` **sans FK** → orphelins possibles), `material_lists` + `material_list_items` (draft/confirmed, `variant_id`/`unit_price` NULL = non résolu/vérifié), `handoffs`, `operator_actions`, `system_activations` (key UNIQUE).
- Entités TypeORM (9 fichiers `backend/src/entities/`) fidèles à la migration ; `synchronize:false` (`data-source.ts:23-24`) ; oppositions = `status='refused'` (pas de table dédiée), absence de ligne = `unknown` = bloqué (`VoiceConsentsService.getStatus`).
- Données de test : aucun seed SQL/TS ; seules fixtures mock `MOCK_CATALOG` (3 items DEMO) + `MOCK_CUSTOMERS` (2 clients fictifs) sous `MOCK_CORE=true`.
- Runtime (Phase 1, lecture seule : `\dt`, `pg_indexes`, `pg_constraint`, `count`, aucune écriture) : **11 tables** (`call_attempts`, `consent_events`, `decision_logs`, `handoffs`, `material_list_items`, `material_lists`, `migrations`, `operator_actions`, `outreach_tasks`, `system_activations`, `voice_consents`) ; **1 migration** appliquée (`InitRelance1760000000000`) ; base `blok_relance_test` créée vide puis migrée avec succès pour les e2e (11 tables aussi) ; `outreach_tasks` = 0 ligne (base applicative vierge, cohérent avec le dashboard vide).
- Index : 23 index (pkey + 1-2 secondaires par table : `idx_tasks_status_due`, `idx_tasks_customer`, `idx_tasks_idempotency` UNIQUE, `idx_voice_consents_customer` UNIQUE `(customer_ref, channel)`, `idx_attempts_task`, `idx_decisions_task`, `idx_handoffs_status`, etc.).
- Contraintes : CHECK statuts présents sur les 6 tables métier (`chk_task_status` 7 valeurs, `chk_attempt_outcome` NULL autorisé, etc.) ; UNIQUE `system_activations(key)` en contrainte + `idempotency_key` et `(customer_ref, channel)` en index uniques ; **FK : `consent_events→voice_consents`, `call_attempts→outreach_tasks`, `material_list_items→material_lists` (toutes ON DELETE CASCADE) ; `decision_logs.task_id/attempt_id` SANS FK — confirmé au runtime, conforme au code (choix projet à documenter, K5)**.
- Écart 9/10 **confirmé au runtime** : 10 CREATE TABLE métier pour un commentaire qui annonce « 9 tables ».
- Entités : 9 fichiers `backend/src/entities/` (+ `index.ts`) couvrent les 10 tables car `material_list_items` est mappée dans `material-list.entity.ts` — pas d'incohérence entités/tables.

## H. Sécurité et conformité

| Protection | Statut | Preuve |
|---|---|---|
| Appels sortants désactivés par défaut | Présente, vérifiée (lecture + runtime) | `OUTBOUND_CALLS_ENABLED=false` en dur + `placeCall` jette toujours + `telephony_outbound` inactive ; `/health` `telephony_activated:false` |
| Blocage sans consentement | Présente (lecture) | Absence = `unknown` = bloqué ; 11 codes doute=bloque |
| Refus ⇒ plus d'appels | Présente (lecture) | `refused` ⇒ opt-out auto + opposition effet immédiat |
| Re-vérification avant déclenchement | Présente (lecture) | `evaluate` + sweep scheduler avec `identityVerified=false` par défaut |
| Traçabilité anti-doublons | Présente (lecture) | `idempotency_key` unique, transitions fermées, réservation atomique, `decision_logs`/`operator_actions`/`consent_events` |
| Tokens comparés temps constant | Présente (lecture) | `timingSafeEqual` des 2 guards ; secrets jamais loggés ni exposés navigateur |
| Secrets / .env | Présente (hygiène) | `.env.docker` présent requis, ignoré par git, valeurs non exposées |
| IdP opérateur / rotation secrets / durées DPO | Absente (documentée comme ouverte) | Points ouverts `docs/security.md`, doctrine conservation à fixer |
| Validité clés AethexAI / Core réelle | Non vérifiée | Présence seule ; aucun appel réseau d'audit |

## I. Tests et résultats

| Test | Commande / procédure | Résultat observé | Statut |
|---|---|---|---|
| Santé backend | `curl :3001/health` | 200 `manual_only`, `mock_core:true` | RÉUSSI (2026-10-29 10:56 GMT) |
| Accès frontend | `curl :3000/` | 200 | RÉUSSI |
| Santé vocale | `curl :5000/health` | ok, `aethex_configured:true` | RÉUSSI (proxy seul, pas la conversation) |
| Connectivité F→B | `fetch backend-api:3001/health|tasks|decisions` depuis conteneur frontend | 200 / 200 / 200 | RÉUSSI |
| Compose config | `docker compose config --quiet` (env chargé POSIX) | exit 0 | RÉUSSI |
| `migrate` | logs `--tail=15` | `No migrations are pending`, exit 0 | RÉUSSI |
| Backend unit | `docker exec backend-api-1 npm test` (jest-unit, conteneur) | 4 suites, **28/28 RÉUSSI** (96 s) ; warning bénin « worker failed to exit » (teardown, sans échec) | RÉUSSI (Phase 1) |
| Backend e2e | `docker exec -e NODE_ENV=test backend-api-1 npm run test:e2e` sur `blok_relance_test` (créée + migrée pour l'occasion) | 1 suite, **13/13 RÉUSSI** (51 s) : health, 401, idempotence, consentement, opposition, levée admin, refus auto, concurrence, scheduler inerte, 6 outils, transferts, listes, RBAC | RÉUSSI (Phase 1) |
| Comptage 41 | 28 unit + 13 e2e = **41/41** | Conflit de comptage de l'audit initial élucidé et confirmé | RÉUSSI |
| Backend typecheck/build | `npm run typecheck` (`tsc --noEmit`), `npm run build` (`nest build`) | exit 0 / exit 0, zéro erreur | RÉUSSI |
| Vocal `unittest` | `docker exec voice-agent-1 python -m unittest discover -s agent -p "test_*.py"` (venv image, mocks réseau) | **15/15 RÉUSSI** (0,15 s) ; 1 `ResourceWarning` bénin (`client.html` non fermé dans un test) ; zéro dépendance manquante | RÉUSSI |
| Frontend typecheck | `npm run typecheck` | exit 0 | RÉUSSI |
| Frontend build | `npm run build` (Next 15.5.28) | 1er essai : échec transitoire `/_not-found` (cache partagé, voir §C) ; rebuild : **exit 0, 7 routes** (`/`, `/taches`, `/taches/[id]`, `/transferts`, `/decisions`, `/consents`, `/_not-found`), warning CSS `flex-end` bénin | RÉUSSI (après incident résolu) |
| 5 pages prioritaires | `curl` + marqueurs de contenu (post-recovery) | 200 partout, 0 « indisponible/injoignable » ; dashboard compteurs, `/taches` formulaire + filtre `?status=pending` 200, `/consents` « Référence client », titres transferts/décisions | RÉUSSI |

Limites Phase 1 : suites exécutées dans les conteneurs (volumes nommés image), pas sur l'hôte ; e2e sur base test dédiée purgée par les helpers (aucune donnée applicative touchée : `outreach_tasks` toujours 0 ligne) ; aucun appel réseau externe (mocks/Core fictif) ; validité des clés AethexAI/Core toujours non rejouée.

## J. Historique et décisions techniques

- **Décisions confirmées (code) :** tokens opérateurs auth maison de schéma Bearer (pas d'IdP) ; secrets outillage `x-voice-tool-secret` ≥ 16 chars ; `MOCK_CORE=true` + écritures Core verrouillées par défaut ; décision v1.0.0 « doute = bloque » + silence 20h-8h `Africa/Abidjan` ; `synchronize:false` + migrations versionnées ; jetons jamais côté navigateur (Server Components uniquement) ; `OUTBOUND_CALLS_ENABLED=false` forcé en dur dans `docker-compose.yml:71`.
- **Git pertinent :** branche `feature/moteur-relance`, HEAD `b8b6ec4` ; historique récent = 3 commits Docker (montage PG18 au parent, réparation YAML, archi locale) ; **seul diff non commité : `backend/src/main.ts`** — écoute passée de `127.0.0.1` à `0.0.0.0` (+ log). **Fait :** sans ce fix, le healthcheck local passait mais `http://backend-api:3001` était injoignable depuis le frontend (`fetch failed` des 2 côtés, prouvé avant/après : `FRONTEND->BACKEND OK 200` après redémarrage). **Hypothèse :** aucun autre diff caché (vérifié `git status --short`).
- **Docs (10 fichiers `docs/`) :** architecture, core-api-contracts, data-model, decision-engine, docker, implementation-status, runbook, security, voice-tools + le présent rapport — dont runbook d'activation téléphonie (double verrou + procédure signée) et doctrine de conservation à fixer avec le DPO. Zéro `TODO/FIXME` dans le code.
- **Phase 1 (2026-10-29) :** scripts inspectés avant exécution (`package.json`, `jest-unit/e2e.json`, `helpers.ts`, `requirements.txt`) ; base `blok_relance_test` inexistante → créée vide (`CREATE DATABASE`, non destructif) puis migrée (`InitRelance… OK`) ; suites 28/28 + 13/13 + 15/15 ; incident build/dev frontend (cause identifiée, correction `rm .next` + restart, environnement rendu sain) ; inspection SQL 100 % lecture seule. Aucune correction métier, aucun commit, aucun volume supprimé. `git status` final : toujours `M backend/src/main.ts` + `?? docs/ETAT_PROJET_BLOK_RELANCE.md`.
- **Contexte fonctionnel :** base Core `https://core-api-dev.blok.africa/api/external` (clé `X-API-Key`) et documentation `/api/documentation/external#/` citées en config par défaut ; **fait :** routes produits/variantes/clients/RFQ décrites dans les adapters mais **non rejouées contre le réel** (mocks actifs) → ne pas les considérer opérationnelles.

## K. Liste des tâches restantes

| # | Priorité | Tâche | Dépendance | Critère d'acceptation | Vérification |
|---|---|---|---|---|---|
| 1 | P0 | ~~Rejouer suites backend + vocal + fumées frontend~~ **TERMINÉE Phase 1** | — | 28/28 + 13/13 + 15/15, typechecks/builds OK, 5 pages 200 avec contenu | §I |
| 2 | P0 | ~~Interroger le schéma Postgres réel~~ **TERMINÉE Phase 1** | — | 11 tables, 23 index, CHECK/UNIQUE/FK relevés, 0 ligne applicative | §G |
| 3 | P1 | Enregistrer les 6 outils sur l'agent AethexAI | **Partiellement faite** : script + dry-run + contrats validés (§N) ; `--apply` bloqué (hôte HTTPS public requis) | `GET …/tools` → 6 outils listés | `register_tools.py --apply --public-base-url https://…` |
| 4 | P1 | Test vocal de bout en bout (sans appel réel) | **Partiellement faite** : signalisation + média validés par probe, outils simulés à l'identique (§N, `docs/demo-webrtc.md`) ; reste : partie A manuelle (micro humain) + déclenchement réel par l'agent (dépend K3) | Conversation FR + outil déclenché par Nadège + traces | Procédure `docs/demo-webrtc.md` après K3 |
| 5 | P1 | Documenter 9-vs-10 tables + absence FK `decision_logs` (constat Phase 1 : conforme au code, pas un bug) | Tâche 2 (faite) | Commentaire migration corrigé ; ADR « logs sans FK » actée | Migration cosmétique ou ADR |
| 6 | P2 | Valider contrats Core réels + webhooks | Tâches 1-2 | `products/customers/notifications/smart-rfqs` rejoués, quotas connus | Appels réels tracés, `MOCK_CORE=false` en sandbox |
| 7 | P2 | IdP opérateur, rotation secrets, durées DPO | — | Décisions signées + implémentation | Revue `docs/security.md` |
| 8 | P3 | BullMQ si goulot, éligibilité CI, builds/healthchecks machine réelle | P0-P2 | Seuils mesurés, procédure runbook | Charge + `docker.md` mis à jour |

## L. Plan d'exécution

1. **Stabiliser la preuve** (fait pour le runtime) : rejouer §I après tout changement ; garder `git status` propre sauf fix ciblés.
2. **Base puis tests** : ~~`migrate` + inspection SQL (K2) → suites (K1)~~ **FAIT Phase 1**. Ne rien câbler d'externe avant le vert (vert obtenu).
3. **Corriger le modèle** : 9/10 tables + FK/orphans (K5) via migration documentée.
4. **Câbler la voix** : enregistrement 6 outils + session WebRTC + scénario mock complet (K3-K4). Toujours sans appel réel.
5. **Ouvrir le Core** : contrats réels + webhooks en sandbox `MOCK_CORE=false` (K6).
6. **Trancher la sécurité** : IdP/rotation/DPO (K7), puis P3 (K8).
7. Règle d'ordre : jamais d'étape N+1 utilisante avant le vert de l'étape N ; chaque étape produit sa preuve (log, curl, capture SQL).

## M. Informations nécessaires à ChatGPT

- **Contexte minimal :** BLOK Relance = backend NestJS (tâches/consents/décisions/transferts/outils vocaux, `manual_only`, sortants verrouillés) + Next.js 15 serveur-seul (6 routes, `callBackend`) + proxy Flask AethexAI **sans outils enregistrés** + Postgres 18 (10 tables métier + `migrations`, `synchronize:false`) + Compose 5 services sains le 2026-10-29. `MOCK_CORE=true`, écritures Core bloquées, agent vocal générique, **41/41 backend + 15/15 vocal vérifiés Phase 1**.
- **Fichiers importants :** `backend/src/app.module.ts`, `backend/src/main.ts` (fix `0.0.0.0` non commité), `backend/src/*/ *.controller.ts`, `backend/src/auth/*.guard.ts`, `backend/src/config/configuration.ts`, `backend/src/core-integration/*`, `backend/src/decision-engine/*`, `backend/src/scheduler/*`, `backend/migrations/1760000000000-InitRelance.ts`, `frontend/app/**/page.tsx`, `frontend/lib/backend.ts`, `docker-compose.yml`, `docker-compose.override.yml`, `blok_voice/agent/server.py`, `blok_voice/agent/create_agent.py`, `docs/*.md`, `.env.docker.example` (+ présence `.env.docker`).
- **Commandes de vérification :** `. ./.env.docker && docker compose config --quiet` ; `docker compose ps -a` ; `docker compose logs --tail=15 migrate` ; `curl :3001/health :3000/ :5000/health` ; `fetch backend-api:3001` depuis le frontend ; `npm test`, `npm run test:e2e`, `python -m unittest`, `tsc --noEmit` des deux apps.
- **Problèmes non résolus :** validité réseau des clés AethexAI/Core ; comptage 41 verts ; 9-vs-10 tables ; FK `decision_logs` ; webhooks/quotas Core ; IdP/rotation/DPO.
- **Décisions en attente :** IdP opérateur, rotation des secrets, durées de conservation DPO, clé Core réelle, fournisseur téléphonie/émetteur/éligibilité CI, webhooks, BullMQ.
- **Prochaine action concrète :** K1-K2 **terminées en Phase 1** (preuves §§G, I). K3-K4 partiellement faites (§N) : obtenir un hôte HTTPS public, jouer `--apply`, rejouer `docs/demo-webrtc.md` A+B.

## N. Démo WebRTC hackathon (2026-10-29, Phases 1-5)

Garde-fous tenus : `MOCK_CORE=true`, écritures Core verrouillées,
`OUTBOUND_CALLS_ENABLED=false`, aucun appel téléphonique, aucune donnée
réelle (préfixe `DEMO-`), aucun commit/push, `M backend/src/main.ts`
préservé. Fichiers créés : `blok_voice/agent/register_tools.py`,
`blok_voice/agent/test_register_tools.py`, `docs/demo-webrtc.md`.

### Phase 1 — WebRTC validé (réel, sans navigateur)

- `POST /session` réel → 200 `{session_id (36), ice_config (4 serveurs)}`.
- `POST /offer` SDP invalide → 502 `Validation failed` (mapping OK) ;
  SDP valide (aiortc) → 200 `answer` (SDP 1488).
- Connexion complète (probe `/tmp`, hors repo) : `connected` + piste
  `audio` + **988 frames reçues** (message d'accueil Nadège émis).
- Reste manuel : micro/navigateur + conversation en français
  (procédure `docs/demo-webrtc.md` partie A ; `client.html` gère
  micro refusé/absent, ICE lent, 410, le tout en français).

### Phase 2 — Six outils (contrats réels, enregistrement préparé)

- Mécanisme prouvé par le SDK 1.0.2 (pas d'invention) : modèle
  `AgentToolCreate` (`name`, `description`, `endpoint_url`, `headers`,
  `parameters_schema`, `tool_type`), routes `POST/GET
  /api/v1/agents/{id}/tools`, `PATCH/DELETE …/tools/{tool_id}` ;
  état distant lu : `items=0`.
- `register_tools.py` : 6 schémas miroirs exacts des DTO, idempotent
  (create/update), dry-run par défaut, `--apply` refusant tout hôte
  non-HTTPS/local/privé ; secret uniquement en en-tête, jamais affiché
  (test dédié). Dry-run réel : 6 `create`, exit 0.
- Endpoints vérifiés en réel : sans secret → 401 ; `catalog-search` →
  201 mock (`prixVerifie:false`) ; `confirm-rfq` sans confirmation →
  422 ; liste/RFQ/handoff/opt-out → 201 + traces (§G complété).
- **Bloqué : `--apply` exige un hôte HTTPS public (inexistant en
  local) — aucun outil enregistré côté agent.**

### Phase 3 — Scénario (`docs/demo-webrtc.md`)

- A (voix, manuelle) : non exécutée ici (exige un humain au micro).
- B (outils, scriptée à l'identique des appels agent) : exécutée —
  `PREPARE 201 draft`, `RFQ_MOCK 201 MOCK-…`, `HANDOFF 201 pending`,
  `OPTOUT 201 refused/effet immediat` ; traces SQL : 1 liste outil,
  1 handoff pending, `DEMO-NADGE-02=refused` + 1 event.

### Phase 4 — Architecture téléphonique (proposition, rien activé)

Ancrage : `TelephonySafetyService.placeCall` (double verrou, 403/501),
`CallAttemptsService.reserve` (transaction atomique),
`call_attempts`/`decision_logs`/`system_activations`, scheduler inerte ;
côté AethexAI : `trigger_call` (`CallCreate{agent_id, to_number,
from_number?, metadata?}`), `get_call_status`, `outbound_trunk_id`,
`transfer_*`, `webhook_url`, comptes Twilio/SIP.

```
[WebRTC navigateur] ←→ [proxy Flask :5000] ←→ [AethexAI conversation]
                                                        │ outils HTTPS
[Scheduler] → [éligibilité : consentement+DPO+quiet] → [réservation atomique
  call_attempts] → [Orchestrateur sortant (NOUVEAU, inerte par défaut)]
  → [double verrou telephony_outbound] → [Fournisseur (Twilio ou SIP,
  non choisi)] → [trigger_call + statuts + webhook] → [audit/decision_logs]
Opposition/opt-out et handoff humain : chemins existants réutilisés.
```

Étapes le moment venu (autorisation requise) : 1. choisir fournisseur
sans engagement (comparer Twilio vs SIP, justifier) ; 2. implémenter
l'orchestrateur derrière le double verrou + file d'appels idempotente ;
3. câbler statuts via `get_call_status`/webhook vers `call_attempts` ;
4. activer `telephony_outbound` en bac à sable avec numéros de test ;
5. DPO/consentement/transferts rejoués avant toute prod.

### Phase 5 — Distinctions et tests

- **Fonctionne et testé :** signalisation + média WebRTC (réel),
  6 endpoints d'outils + erreurs (réel), traces SQL (réel),
  `unittest` vocal 21/21, journaux des 5 services sans erreur.
- **Mock uniquement :** catalogue/RFQ/clients Core (`mock:true`,
  fanions false), conversation sans outils (générique).
- **Bloqué :** enregistrement distant des outils (hôte public),
  partie A manuelle, téléphonie réelle (fournisseur + activation).
- **Non exécuté :** re-run suites backend/frontend (inchangées depuis
  Phase 1, re-run inutile), conversation FR à l'oreille.
- Prochaine action : hôte HTTPS public → `--apply` → démo A+B.

## O. Seed de démonstration jury (2026-10-29)

Script : `backend/scripts/seed-demo.mjs`, exécuté via
`docker exec blok-relance-backend-api-1 node scripts/seed-demo.mjs`
(5 runs : 1 partiel avant fix SQL, puis idempotence prouvée —
dernier run : **0 créés, 24 déjà présents**). Données 100 % fictives
(refs `DEMO-JURY-*`, entreprise et clients inventés de Côte d'Ivoire),
`MOCK_CORE=true`, sortants verrouillés, résidus `DEMO-NADGE-*` préservés.

### Tables peuplées (ajouts seed)

| Table | +lignes | Détail |
|---|---|---|
| `outreach_tasks` | 7 | `demo-jury-t01..t07` : pending×2, in_progress, blocked, done, awaiting_human, cancelled |
| `call_attempts` | 6 | UUID stables : no_answer, started×2, refused, completed, failed |
| `decision_logs` | 7 | 6 `evaluate` réels (block variés) + 1 `allow` exemple seedé (`ELIGIBLE`, `seed:demo-jury`) |
| `voice_consents` | 6 | granted×4, withdrawn×1, refused×1 (opt-out API) + 6 events |
| `material_lists` / items | 2 / 5 | C01 draft (1 résolue + 2 libres), C02 confirmed (1 + 1) |
| `handoffs` | 2 | h05 pending lié tâche, h06 resolved (claim+resolve) |
| `operator_actions` | ~17 | Traçabilité auto des appels API (create, evaluate, consent, handoff…) |

### Scénario

C01 Awa Koné (villa Cocody, échue, high) · C02 Yao Kouassi (toiture,
en cours) · C03 Fatou Diallo (opposition, bloquée) · C04 Ibrahim Touré
(dossier clôturé, RFQ `MOCK-c92521cf`, `coreRef` lié) · C05 Mariam Diarra
(transfert pending, awaiting_human) · C06 Sekou Camara (withdrawn,
transfert résolu) + T07 doublon annulé. Dashboard vérifié : attente 2,
bloquées 1, humaine 1, reprises 1, blocages 7, 1 tâche échue listée ;
détail tâche 200 (tentatives/décisions/consentement) ; 0 orphelin ;
`operator:sales=6`, `scheduler` vivant (`seed:demo-jury=1`). **Comportement
observé : le scheduler ajoute ~1 décision/minute** (35 → 36 en 70 s) en
réévaluant les tâches échues à chaque sweep, sans déduplication — le
compteur « Blocages journalisés » gonfle donc en continu pendant la démo
(calcul réel, non modifié ; à annoncer au jury comme preuve que le
moteur tourne). La commande reset couvre aussi ces décisions
(`task_id` démo), qui se régénèrent ensuite d'elles-mêmes.

### Vérifications et limites

- Suites backend/frontend non relancées (aucun code métier modifié ;
  vert Phase 1 intact) ; `node --check` OK à chaque édition.
- Écrans restant sans rubrique : **listes de matériaux** (aucune page
  frontend ; vérifiables via `GET /api/v1/relance/material-lists/:id`)
  et consentements (visibles par `?ref=` et fiche tâche, pas de liste).
- `catalog-search` répond **201** (défaut Nest POST), pas 200 : normal.

### Reset / réinsertion (données démo uniquement)

```bash
# Réinitialiser : supprime SEULEMENT les lignes demo-jury (ordre FK)
docker exec blok-relance-postgres-1 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
DELETE FROM call_attempts WHERE task_id IN (SELECT id FROM outreach_tasks WHERE idempotency_key LIKE '"'"'demo-jury-%'"'"');
DELETE FROM decision_logs WHERE task_id IN (SELECT id FROM outreach_tasks WHERE idempotency_key LIKE '"'"'demo-jury-%'"'"') OR requested_by = '"'"'seed:demo-jury'"'"';
DELETE FROM consent_events WHERE consent_id IN (SELECT id FROM voice_consents WHERE customer_ref LIKE '"'"'DEMO-JURY-%'"'"');
DELETE FROM voice_consents WHERE customer_ref LIKE '"'"'DEMO-JURY-%'"'"';
DELETE FROM material_list_items WHERE list_id IN (SELECT id FROM material_lists WHERE customer_ref LIKE '"'"'DEMO-JURY-%'"'"');
DELETE FROM material_lists WHERE customer_ref LIKE '"'"'DEMO-JURY-%'"'"';
DELETE FROM handoffs WHERE customer_ref LIKE '"'"'DEMO-JURY-%'"'"';
DELETE FROM operator_actions WHERE target IN (SELECT id::varchar FROM outreach_tasks WHERE idempotency_key LIKE '"'"'demo-jury-%'"'"') OR target LIKE '"'"'DEMO-JURY-%'"'"';
DELETE FROM outreach_tasks WHERE idempotency_key LIKE '"'"'demo-jury-%'"'"';"'
# Réinsérer :
docker exec blok-relance-backend-api-1 node scripts/seed-demo.mjs
```
