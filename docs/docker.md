# Environnement local Docker — BLOK Relance

## Services

| Service | Rôle réel | Port hôte | Santé |
|---|---|---|---|
| `postgres` | Base persistante (volume `pgdata`) | — (interne au réseau `bloknet`) | `pg_isready` |
| `backend-api` | NestJS : métier, règles, outils vocaux | `127.0.0.1:3001` | `GET /health` |
| `frontend-commercial` | Next.js : suivi interne | `127.0.0.1:3000` | `GET /` |
| `voice-agent` | Proxy Flask existant (WebRTC, inchangé) | `127.0.0.1:5000` | `GET /health` |
| `migrate` | Tâche unique : `migration:run` | — | — (exit 0) |

**Non retenus (décision argumentée) :** `redis` (la file est en base :
réservation atomique + balayage ; BullMQ reste une option future), `worker`
séparé (le planificateur vit dans `backend-api` et ne compose jamais d'appel),
`reverse-proxy` (ports localhost directs suffisent en local).

## Premier démarrage

```bash
cp .env.docker.example .env.docker   # valeurs fictives à adapter, jamais versionné
set -a; source .env.docker; set +a   # requis pour l'interpolation ${…} du Compose
docker compose up -d --build         # constructions initiales, une seule fois
docker compose up migrate            # applique les migrations (idempotent)
docker compose ps                    # tous les services : healthy
```

Ouvrir [http://localhost:3000](http://localhost:3000) (suivi),
santé sur `http://127.0.0.1:3001/health`, Swagger sur
`http://127.0.0.1:3001/api/docs`, voix existante sur `:5000`.

## Routine (sans jamais `down -v`)

```bash
docker compose up -d                 # démarrer
docker compose logs -f backend-api   # journaux suivis
docker compose restart backend-api   # redémarrer un service (après changement d'env)
docker compose up -d --build backend-api   # reconstruire UN service (Dockerfile, deps système)
docker compose down                  # arrêter (les volumes survivent)
```

## Quand reconstruire ? (règle en 5 cas)

- **Code source modifié** (`.ts`, `.py`, `.tsx`, CSS) : **aucun rebuild**.
  Watch NestJS, hot reload Next, `--reload` Flask détectent le bind mount.
  Si les événements ne traversent pas : `CHOKIDAR_USEPOLLING=true` (voir
  `docker-compose.override.yml`).
- **Dépendance npm/Python ajoutée** : `docker compose exec backend-api npm install <pkg>`
  (persistée dans le volume `backend_node_modules`), ou rebuild si elle doit
  entrer dans l'image ; **toujours** reporter la dépendance dans
  `package.json` / `requirements.txt`.
- **Dockerfile ou paquet système modifié** : `docker compose up -d --build <service>`.
- **Schéma de base modifié** : nouvelle migration versionnée +
  `docker compose up migrate`. **Ne jamais effacer `pgdata`.**
- **Variable d'environnement modifiée** : `docker compose restart <service>`
  (ou `up -d` pour recharger `env_file`).

## Données : persistance, sauvegarde, restauration

- `pgdata` est un volume nommé : il survit à `down`, `up --build` et aux
  recréations. Ne lancez jamais `docker compose down -v` en routine.
- Sauvegarde : `docker compose exec postgres pg_dump -U blok_relance blok_relance > sauvegarde_$(date +%F).sql`
- Restauration : `cat sauvegarde_XXXX.sql | docker compose exec -T postgres psql -U blok_relance blok_relance`
- Les migrations sont rejouables (`migrations` table) et ne détruisent pas
  de données (que des `CREATE`, relus avant application).

## Tests via Compose

```bash
docker compose run --rm backend-api npm test        # unitaires
docker compose run --rm backend-api npm run test:e2e # e2e (base de test dédiée)
```

## Sécurité

- Ports publiés sur `127.0.0.1` uniquement ; Postgres non exposé à l'hôte.
- Secrets hors images (`.dockerignore` exclut tout `.env`) et hors dépôt
  (`.env.docker` ignoré par Git). `OUTBOUND_CALLS_ENABLED` reste `"false"`
  en dur dans le Compose : passer à `true` exige une modification relue.
- Environnements séparés : le `.venv` hôte de `blok_voice/` reste local ;
  le conteneur utilise `/opt/venv` dans l'image (jamais réinstallé au démarrage).

## Limites actuelles

- Vérifié sans daemon (socket bloqué dans cet environnement) :
  `docker compose config` uniquement. Builds, démarrages, healthchecks,
  hot-reload et persistance **à valider sur une machine avec daemon**
  (commandes ci-dessus, dans l'ordre).
- Fournisseur téléphonie, clé Core réelle, schémas clients/produits :
  toujours bloquants (voir `docs/implementation-status.md`).
