# Déploiement BLOK Relance sur VPS (GitHub & Docker Compose)

Ce guide décrit la procédure de référence pour déployer et maintenir **BLOK Relance** sur un serveur privé virtuel (VPS) Linux vierge à l'aide de Docker Compose.

---

## 1. Architecture des Services

Le projet est composé de 5 services orchestrés dans un réseau interne sécurisé (`bloknet`) :

| Service | Rôle | Port Interne | Port Publié par Défaut |
|---|---|---|---|
| `postgres` | Base de données PostgreSQL 18 (volume persistant `pgdata`) | `5432` | *Non exposé* (sécurité) |
| `migrate` | Exécute les migrations TypeORM au démarrage | — | *Tâche unique* (exit 0) |
| `backend-api` | API métier NestJS (gestion des tâches, devis, sessions) | `3001` | `127.0.0.1:3001` |
| `frontend-commercial` | Interface Next.js (Dashboard, `/vocale` ESTHER, devis) | `3000` | `127.0.0.1:3000` |
| `voice-agent` | Proxy WebRTC Flask (relais vers AethexAI) | `5000` | `127.0.0.1:5000` |

---

## 2. Prérequis sur le VPS

Sur le VPS (Ubuntu 22.04 / 24.04 ou Debian 12 recommandé) :
- **Git** installé (`sudo apt update && sudo apt install -y git`)
- **Docker Engine** (version 24+ recommandée)
- **Docker Compose** (plugin v2+, vérifier avec `docker compose version`)

---

## 3. Déploiement Initial (Premier Démarrage)

### Étape 1 : Cloner le dépôt

```bash
git clone https://github.com/D-TECH-DEV/bloc_voice_hackaton.git blok-relance
cd blok-relance
git checkout feature/moteur-relance
```

### Étape 2 : Créer le fichier d'environnement `.env.docker`

Le fichier `.env.docker` contient les secrets réels et est expressément ignoré par Git. Il doit être créé sur le VPS :

```bash
cp .env.docker.example .env.docker
chmod 600 .env.docker
nano .env.docker
```

#### Variables indispensables à renseigner pour le VPS :

1. **`POSTGRES_PASSWORD`** : Définissez un mot de passe robuste et unique.
2. **`VOICE_TOOL_SECRET`** : Secret de communication interne (au moins 16 caractères aléatoires).
3. **`OPERATOR_ADMIN_TOKEN`** & **`OPERATOR_SALES_TOKEN`** : Jetons d'authentification des opérateurs.
4. **`AETHEX_API_KEY`** & **`AGENT_ID`** : Vos identifiants AethexAI pour activer l'agent vocal ESTHER.
5. **`VOICE_URL` (CRITIQUE SUR VPS)** :
   - Par défaut, `VOICE_URL=http://127.0.0.1:5000` convient uniquement au poste local.
   - **Sur un VPS**, le navigateur de l'utilisateur doit pouvoir joindre le service vocal :
     - Si vous utilisez une IP directe : `VOICE_URL=http://<IP_PUBLIQUE_VPS>:5000`
     - Si vous utilisez un nom de domaine avec SSL : `VOICE_URL=https://vocal.votre-domaine.com`
6. **`FRONTEND_BIND` & `VOICE_BIND`** :
   - Si vous utilisez un reverse proxy local (Nginx / Caddy), laissez `127.0.0.1`.
   - Si vous voulez accéder directement aux ports sans reverse proxy :
     ```env
     FRONTEND_BIND=0.0.0.0
     VOICE_BIND=0.0.0.0
     ```

### Étape 3 : Valider la configuration Compose

```bash
docker compose --env-file .env.docker config --quiet
```
Si la commande ne retourne aucune erreur, la syntaxe et les variables obligatoires sont valides.

### Étape 4 : Lancer le build et démarrer les conteneurs

```bash
docker compose --env-file .env.docker up -d --build
```

### Étape 5 : Vérifier l'état des conteneurs

```bash
docker compose --env-file .env.docker ps
```

Tous les services doivent afficher le statut `Up (healthy)` :
- `blok-relance-postgres-1` : `Up (healthy)`
- `blok-relance-migrate-1` : `Exited (0)`
- `blok-relance-backend-api-1` : `Up (healthy)`
- `blok-relance-frontend-commercial-1` : `Up (healthy)`
- `blok-relance-voice-agent-1` : `Up (healthy)`

---

## 4. Procédure de Mise à Jour (Nouveau Push sur GitHub)

Lors d'un nouveau déploiement après mise à jour du code :

```bash
cd blok-relance

# 1. Récupérer le code sans merge conflictuel
git pull --ff-only origin feature/moteur-relance

# 2. Reconstruire et redémarrer les conteneurs
docker compose --env-file .env.docker up -d --build

# 3. Vérifier le bon état d'exécution
docker compose --env-file .env.docker ps
```

> [!WARNING]
> **Ne jamais exécuter `docker compose down -v` !**
> L'option `-v` détruirait le volume Docker persistant `pgdata` contenant les données de la base PostgreSQL. Pour un redémarrage standard, utilisez simplement `docker compose restart` ou `docker compose --env-file .env.docker up -d --build`.

---

## 5. Consultation des Logs

Pour inspecter les logs en temps réel :

```bash
# Logs de l'ensemble de la stack
docker compose --env-file .env.docker logs --tail=100 -f

# Logs ciblés d'un service spécifique
docker compose --env-file .env.docker logs --tail=100 -f frontend-commercial
docker compose --env-file .env.docker logs --tail=100 -f backend-api
docker compose --env-file .env.docker logs --tail=100 -f voice-agent
```

---

## 6. Sauvegarde et Restauration de la Base de Données

Les données vivent dans le volume nommé Docker `pgdata` (monté sur `/var/lib/postgresql`).

### Sauvegarde à chaud (Dump SQL)

```bash
docker exec -t blok-relance-postgres-1 pg_dump -U blok_relance blok_relance > backup_blok_$(date +%Y%m%d_%H%M%S).sql
```

### Restauration depuis un fichier SQL

```bash
# 1. Vérifier la présence du fichier de dump
cat backup_blok_YYYYMMDD_HHMMSS.sql | docker exec -i blok-relance-postgres-1 psql -U blok_relance -d blok_relance
```

---

## 7. Sécurité et Bonnes Pratiques en Production

1. **PostgreSQL Isolé :** Le port `5432` n'est pas publié sur l'hôte. Seuls les conteneurs du réseau `bloknet` peuvent interagir avec la base.
2. **Reverse Proxy HTTPS (Recommandé) :**
   WebRTC et l'accès au microphone nécessitent un contexte sécurisé (`https://` ou `http://localhost`). Sur une IP distante publique, configurez Nginx ou Caddy avec un certificat Let's Encrypt devant les ports 3000 et 5000 :
   ```
   https://relance.votre-domaine.com -> http://127.0.0.1:3000
   https://vocal.votre-domaine.com   -> http://127.0.0.1:5000
   ```
3. **Protection des Secrets :**
   `chmod 600 .env.docker` pour empêcher la lecture par d'autres utilisateurs du système.

---

## 8. Procédure de Retour Arrière (Rollback)

Si un commit introduit une régression :

```bash
# 1. Revenir au commit stable précédent
git checkout <COMMIT_SHA_PRECEDENT>

# 2. Reconstruire les images Docker
docker compose --env-file .env.docker up -d --build

# 3. Vérifier
docker compose --env-file .env.docker ps
```

