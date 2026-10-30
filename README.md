# BLOK Relance — Plateforme Commerciale & Copilote Vocal ESTHER

BLOK Relance est une solution complète de suivi commercial, de relance et d'assistance vocale interactive pour l'achat de matériaux de construction en Afrique de l'Ouest.

Le projet intègre :
- **ESTHER** : Agente commerciale vocale immersive en français (voix ivoirienne, WebRTC basse latence via AethexAI, orb visuel réactif, moteur vocal `useVoiceEngine`, machine à états `esther-machine`).
- **Interface commerciale Next.js** : Tableau de bord des relances, gestion des tâches, transferts humains, consentements, panier dynamique et génération de devis certifiés avec téléchargement PDF.
- **Backend NestJS** : API REST sécurisée, moteur de décision, intégration catalogue Core BLOK, génération PDF de devis, outils vocaux sécurisés (`x-voice-tool-secret`).
- **PostgreSQL 18** : Persistance transactionnelle complète avec migrations versionnées TypeORM.

---

## 1. Démarrage Rapide avec Docker Compose (Recommandé)

Le projet s'exécute avec l'ensemble de ses services via une commande unique :

```bash
# 1. Préparer le fichier d'environnement Docker
cp .env.docker.example .env.docker

# 2. Renseigner vos variables (mots de passe, clés d'API, tokens)
nano .env.docker

# 3. Construire et démarrer tous les conteneurs
docker compose --env-file .env.docker up -d --build

# 4. Vérifier l'état de la stack
docker compose --env-file .env.docker ps
```

### Points d'accès :
- **Interface commerciale & ESTHER :** [http://127.0.0.1:3000](http://127.0.0.1:3000)
- **Expérience vocale immersive :** [http://127.0.0.1:3000/vocale](http://127.0.0.1:3000/vocale)
- **API Backend :** [http://127.0.0.1:3001/health](http://127.0.0.1:3001/health) (Documentation Swagger : `/api/docs`)
- **Proxy vocal WebRTC :** [http://127.0.0.1:5000/health](http://127.0.0.1:5000/health)

> [!WARNING]
> Ne lancez jamais `docker compose down -v` : cela supprimerait le volume persistant `pgdata` contenant vos données PostgreSQL.

Pour les instructions complètes de mise en production sur un serveur distant, consultez le guide dédié :
📖 **[Guide de Déploiement GitHub & VPS](docs/DEPLOIEMENT_GITHUB_VPS.md)**.

---

## 2. Développement Local (Hors Docker)

### Frontend Next.js
```bash
cd frontend
npm ci
npm run dev # Accessible sur http://127.0.0.1:3000
```

### Backend NestJS
```bash
cd backend
npm ci
npm run start:dev # Accessible sur http://127.0.0.1:3001
```

### Service Vocal Python
```bash
cd blok_voice
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 agent/server.py # Accessible sur http://127.0.0.1:5000
```

---

## 3. Tests Automatisés

Le projet dispose d'une couverture de tests rigoureuse sur chaque couche :

```bash
# 1. Tests unitaires du Backend NestJS (55 tests)
cd backend && npm test

# 2. Tests e2e du Backend NestJS (30 tests)
cd backend && npm run test:e2e

# 3. Tests de la machine à états de l'orb ESTHER (8 tests)
cd frontend && npm test

# 4. Tests unitaires du Proxy Vocal Python (34 tests)
cd blok_voice && .venv/bin/python -m unittest discover -s agent -p "test_*.py"
```

---

## 4. Architecture et Documentation Détaillée

- [Déploiement GitHub & VPS](docs/DEPLOIEMENT_GITHUB_VPS.md)
- [Architecture Docker](docs/docker.md)
- [Outils vocaux ESTHER](docs/voice-tools.md)
- [Modèle de données et devis](docs/devis.md)
- [Démonstration WebRTC](docs/demo-webrtc.md)
