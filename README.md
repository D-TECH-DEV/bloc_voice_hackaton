# BLOK Voice Copilot

Assistant vocal en français pour BLOK Africa : le client parle de son projet de
construction dans le navigateur, l'agent AethexAI comprend et répond à l'oral.

## Architecture

- `blok_voice/agent/client.html` — interface web (boutons démarrer/terminer,
  état de connexion, indicateur d'activité vocale, erreurs en français).
- `blok_voice/agent/server.py` — backend Flask. Sert la page et relaie la
  signalisation WebRTC vers AethexAI (`/conversation/connect`, puis
  `/conversation/{sid}/offer`). La clé API ne sort jamais du serveur.
- `blok_voice/agent/create_agent.py` — crée (ou réutilise) l'agent vocal
  « BLOK Voice Copilot » : prompt commercial FR, voix française de Côte
  d'Ivoire (Nadège), message d'accueil FR.
- `blok_voice/requirements.txt` — dépendances Python (`Flask`, `requests`).

Outils métier BLOK (catalogue, stocks, prix, devis) : **non connectés** — il
n'existe pas encore de backend métier dans ce dépôt. L'agent a pour consigne
stricte de ne jamais inventer prix, stocks ou délais et d'expliquer cette
limite au client (voir §16 du prompt dans `create_agent.py`).

## Pré-requis

- Python 3.10+
- Une clé API AethexAI (`AETHEX_API_KEY`)
- Un micro + un navigateur récent (Chrome/Edge/Firefox), page servie en
  `http://localhost` (le navigateur exige un contexte sécurisé pour le micro ;
  `localhost` est accepté).

## Démarrage

```bash
# 1. Environnement (réutilise le .venv déjà présent dans blok_voice/)
python3 -m venv blok_voice/.venv        # seulement s'il n'existe pas encore
source blok_voice/.venv/bin/activate
pip install -r blok_voice/requirements.txt

# 2. Configuration (ne commitez jamais le vrai .env)
cp .env.example .env
# Éditez .env : AETHEX_API_KEY=<votre clé ae_live_...>
# Le fichier historique utilisait API_KEY : les deux noms sont acceptés.

# 3. Créer (ou réutiliser) l'agent vocal — affiche AGENT_ID
set -a; source .env; set +a
python3 blok_voice/agent/create_agent.py
# Ajoutez la ligne AGENT_ID=<id affiché> dans .env

# 4. Lancer le backend (port 5000)
set -a; source .env; set +a
python3 blok_voice/agent/server.py
```

## Utilisation

1. Ouvrez [http://localhost:5000](http://localhost:5000) dans le navigateur.
2. Cliquez **« Démarrer la conversation »** et autorisez le microphone.
3. Parlez en français ; l'agent répond à l'oral (barre verte = activité vocale).
4. Cliquez **« Terminer »** pour raccrocher proprement.

Diagnostic rapide : [http://localhost:5000/health](http://localhost:5000/health)
indique si la clé et l'agent sont configurés.

## Tests

```bash
source blok_voice/.venv/bin/activate
python3 -m unittest discover -s blok_voice/agent -p "test_*.py" -v
```

Couverture : santé, page d'accueil, création de session (succès, clé
manquante, agent introuvable, réponse non-JSON, timeout), négociation
d'offre SDP (succès, corps invalide, session expirée, non-déformation des
champs transmis).

## Dépannage

| Symptôme | Cause probable |
|---|---|
| `Clé API manquante` | `.env` non chargé : relancez avec `set -a; source .env; set +a` |
| `Agent non configuré` | `AGENT_ID` absent : exécutez `create_agent.py` |
| `Clé API AethexAI refusée` | `AETHEX_API_KEY` invalide ou révoquée |
| `Agent introuvable` | `AGENT_ID` d'un autre compte ou agent supprimé |
| `Accès au microphone refusé` | Autorisez le micro dans la barre d'adresse du navigateur |
| `collecte ICE trop longue` | Réseau/UDP bloqué (pare-feu d'entreprise, VPN) |
| Pas de son distant | Volume, sortie audio, ou lecture auto bloquée : cliquez dans la page |
