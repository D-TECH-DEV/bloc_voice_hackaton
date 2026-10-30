# BLOK Relance sous Docker — procédure de référence

## Commande unique

```bash
docker compose --env-file .env.docker up -d --build
```

(Cette commande construit les images de production et démarre l'ensemble des services avec les ports publiés sur `127.0.0.1`. Ne jamais `down -v` : cela détruirait la base `pgdata`.)

## Adresses (poste développeur)

- Interface : http://127.0.0.1:3000 (nouvelle expérience vocale : `/vocale`)
- API backend : http://127.0.0.1:3001 (`/health`)
- Proxy vocal : http://127.0.0.1:5000 (`/health`)

## Référence de production (`docker-compose.yml`)

Les images construisent le code source actuel à chaque `--build` :
- `frontend/Dockerfile` : `npm run build` dans l'image puis `npm run start`
  sur `0.0.0.0:3000`. Le `.next` hôte est exclu du contexte (`.dockerignore`)
  et aucun volume de dev ne masque le dossier `/app`.
- `backend/Dockerfile` : `npm run build` puis `node dist/src/main` sur `0.0.0.0:3001`.
- `migrate` applique les migrations avant le démarrage de l'API.
- `voice-agent` exécute le proxy Flask WebRTC sur `0.0.0.0:5000`.

## Développement local (hot reload optionnel)

- Soit en direct sur la machine : `npm run dev` dans `frontend/`.
- Soit via Docker Compose avec bind mounts :
  ```bash
  docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.dev.yml up -d
  ```

## Si une modification n'apparaît pas

1. Vérifier que le conteneur tourne sur le bon code :
   `docker compose ps` puis recharger la page sans cache (`Ctrl+Maj+R`).
2. En dev (override), le watcher utilise le polling (`WATCHPACK_POLLING`,
   `CHOKIDAR_USEPOLLING`) : si un changement semble ignoré, redémarrer le
   service concerné (`docker compose restart frontend-commercial`) — jamais
   `down -v`.
3. En base seule, tout changement exige `--build` (le build rejoue
   `npm run build` sur le source copié).

## Réseau et voix

- Inter-services : noms DNS Compose (`http://backend-api:3001`).
- Navigateur → proxy vocal : `VOICE_URL` (défaut `http://127.0.0.1:5000`,
  port publié par l'override). WebRTC + micro exigent un contexte sécurisé :
  `http://127.0.0.1` et `http://localhost` sont acceptés par les navigateurs.
