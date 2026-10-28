# Runbook — BLOK Relance (développement)

## Prérequis

Node.js ≥ 20 (vérifié 22.15.0), PostgreSQL 18 (binaires locaux),
`VOICE_TOOL_SECRET` ≥ 16 caractères et jetons opérateurs en variables
d'environnement (voir `backend/.env.example` — valeurs fictives).

## Démarrage local

```bash
# 1. Base de données (socket Unix désactivé : sandbox)
export PATH=/usr/lib/postgresql/18/bin:$PATH
cd backend
[ -d .pgdata ] || initdb -D .pgdata -U blok_relance --auth=trust -E UTF8
pg_ctl -D .pgdata -o "-c listen_addresses='127.0.0.1' -c port=5432 -c unix_socket_directories=''" -l /tmp/pg-relance.log start
createdb -h 127.0.0.1 -U blok_relance blok_relance
createdb -h 127.0.0.1 -U blok_relance blok_relance_test

# 2. Dépendances (cache inscriptible si ~/.npm est en lecture seule)
npm install --cache /tmp/npm-cache

# 3. Migration puis backend (port 3001)
DB_HOST=127.0.0.1 DB_PORT=5432 DB_USER=blok_relance DB_PASSWORD= DB_NAME=blok_relance npm run migration:run
set -a; source .env; set +a   # backend/.env copié depuis .env.example
npm run start:dev              # ou npm run build && npm run start:prod

# 4. Interface (port 3000, dans frontend/)
npm install --cache /tmp/npm-cache
BACKEND_URL=http://127.0.0.1:3001 OPERATOR_TOKEN=… OPERATOR_ADMIN_TOKEN=… npm run dev
```

Ouvrez ensuite [http://localhost:3000](http://localhost:3000) dans le
navigateur (tableau de bord), backend sur `127.0.0.1:3001`
(`/health`, `/api/docs`). La voix existante reste sur `:5000` (Flask, intact).

## Commandes utiles

- `npm run typecheck` / `npm test` (unitaires) / `npm run test:e2e`
  (base `blok_relance_test`, `NODE_ENV=test`, PG démarré dans le même appel).
- `npm run migration:generate -- <Nom>` puis **relire le SQL** avant `migration:run`.
- Santé : `GET /health` → `mode: manual_only`, `telephony_activated: false`.

## Particularités sandbox (non-problèmes)

- `~/.npm` en lecture seule → `--cache /tmp/npm-cache`.
- Chaque appel shell isole le réseau : Postgres + serveurs + requêtes doivent
  partir **du même appel** ; `curl`/`urllib` doivent contourner le proxy pour
  le loopback (`no_proxy=127.0.0.1,localhost`).
- `os.networkInterfaces()` bloqué → `next start` nécessite un shim
  (`NODE_OPTIONS=--require /tmp/shim-net.js`) **uniquement dans ce sandbox**.

## Incidents

- Opposition non enregistrée (panne DB au `recordOutcome`) : la tentative
  garde un outcome inconnu + erreur technique ; **aucune nouvelle action**
  n'est lancée ; le dossier apparaît à reprendre (file + journal).
- Core en panne : `CORE_UNAVAILABLE`, tâche conservée et replanifiée, jamais
  effacée ; décisions journalisées `CORE_UNAVAILABLE`.
- Résultat fournisseur inconnu : outcome NULL, pas de « sans réponse » inventé.

## Vers la production (non autorisé à ce stade)

Fournisseur téléphonique validé + numéro émetteur + éligibilité CI,
IdP opérateur, durées de conservation DPO, clé Core + quotas, exposition
projets/devis/commandes, webhooks ou polling contractuel, BullMQ si la file
DB devient un goulot. Activation téléphonie : `OUTBOUND_CALLS_ENABLED=true`
**et** activation `telephony_outbound` tracée **et** procédure signée.
