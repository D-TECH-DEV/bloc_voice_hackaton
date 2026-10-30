# Outils vocaux — BLOK Relance

## Mécanisme AethexAI (vérifié, source : SDK officiel `docs/agents.md`)

- Déclaration : `add_agent_tool(agent_id, name, description,
  tool_type="function", parameters_schema={…JSON Schema…},
  endpoint_url="https://…", headers={"Authorization": "Bearer …"})`.
- Le runtime appelle l'URL en HTTPS quand le LLM utilise l'outil ;
  `list/update/delete_agent_tool` pour la gestion du cycle de vie.
- Référence complète : `https://docs.aethexai.com/agents` (+ modèles
  `AgentToolCreate`, `CallCreate` du SDK).
- Authentification retenue : en-tête `x-voice-tool-secret` (secret ≥ 16
  caractères, comparé à temps constant, jamais dans le prompt).

## Les 9 outils (`POST /api/v1/relance/tools/*`, garde `VoiceToolGuard`)

| Outil | Entrée stricte | Sortie | Garde spécifique |
|---|---|---|---|
| `catalog-search` | `query`, `categoryId?`, `sessionId?` | `items[]` (+`reference`, `devise`) + fanions `prixVerifie`/`dispoVerifiee` + `correlationId` + `searchId?` | `sessionId` inconnu → 404, rien enregistré |
| `record-recommendations` | `sessionId`, `searchId?`, `items[{label, qty?, unit?, unitPrice?, currency?, variantId?, ref?}]` | `recommandees`, `itemIds` (proposés, pas sélectionnés) | Session terminée → 409 |
| `confirm-selections` | `sessionId`, `itemIds[]`, `confirmationClient: true` | `confirmees`, `itemIds` | 422 sans confirmation ; `itemId` étranger → 404 |
| `end-conversation` | `sessionId` | `statut: ended` + résumé (proposées/sélectionnées/total) | Idempotent |
| `prepare-material-list` | `customerRef`, `items[{variantId?, label, qty, unit}]` | `listId`, `resolues`, `nonResolues` | Ligne inconnue = non résolue |
| `confirm-rfq` | `organizationId`, `items`, `confirmationClient: true`, `idempotenceKey` | `rfqNumber?`, `mock`, `suivi: indisponible` | 422 sans confirmation ; écritures Core requises sinon |
| `record-call-outcome` | `attemptId`, `outcome`, `summary` | `outcome` enregistré | Idempotent ; `refused` ⇒ opposition auto |
| `record-voice-opt-out` | `customerRef`, `proofRef?` | `statut: refused`, `effet: immediat` | Bloque toutes les tâches |
| `request-human-handoff` | `customerRef`, `motive`, `summary` | `handoffId`, `statut: pending` | Annonce seulement après réponse |

Erreurs : 400 (payload), 401 (secret), 422 (confirmation manquante),
409/404 (idempotence/ressource/session figée ou inconnue), 503 (secret serveur
absent = outils désactivés), 404 sur tout chemin hors allowlist — **aucun outil
d'appel sortant n'existe**.

## Contexte de conversation et récapitulatif (nouveau)

Tables `voice_sessions` / `voice_session_searches` / `voice_session_items`
(migration `1760000000001-VoiceSessions.ts`, réversible) : chaque recherche
(même vide), chaque recommandation présentée et chaque sélection confirmée est
rattachée à une session. Prix/devise/quantité NULL = indisponible, jamais
inventé ; totaux calculés à la lecture, jamais persistés.

- Opérateur : `POST /api/v1/relance/voice-sessions`, `GET …/:id/recap`
  (contrat versionné `v1`), `POST …/:id/end` (idempotent).
- Interface : page `/conversation` (création + suivi pendant l'appel par
  HTTP toutes les 3 s, pas de WebSocket — voir § ci-dessous) et relais
  same-origin `/api/session-recap/[id]` (le jeton opérateur reste serveur).
- `GET …/recap` rejouable à tout moment = reconnexion ; isolation par
  `sessionId` (uuid imprévisible) + jeton opérateur côté serveur.

## Temps réel : HTTP, pas de WebSocket

WebRTC transporte uniquement la voix. Aucun mécanisme de notification
préexistant à réutiliser ; WebSocket/SSE ajouteraient auth, reconnexion et
isolation pour un besoin couvert par un `GET` récapitulatif : interrogation
pendant l'appel, re-`GET` à la fin ou après reconnexion. PostgreSQL reste la
source de vérité ; aucun événement ne transite hors backend.

Enregistrement agent : `register_tools.py` (9 outils, dry-run par défaut,
`--apply` exigeant un hôte HTTPS public — toujours bloqué en local).

## Enregistrement sur l'agent (outillé, en attente d'hôte public)

Script : `blok_voice/agent/register_tools.py` (miroir exact des DTO,
`test_register_tools.py` : 6 tests, dry-run par défaut, `--apply`
refusant tout hôte non-HTTPS/local/privé). Contrats validés en réel
le 2026-10-29 : sans secret → 401 ; `catalog-search` → 201 mock ;
`confirm-rfq` sans confirmation → 422 ; liste/RFQ/handoff/opt-out →
201 avec traces (`tool:agent_vocal`, `MOCK-…`, `pending`, `refused`).
État distant vérifié : `GET /agents/{id}/tools` → `items=0`.
**Blocage : `--apply` exige un hôte HTTPS public joignable par
AethexAI (inexistant en local) — enregistrement réel non exécuté.**

## Enregistrement sur l'agent (en attente, procédure initiale)

Avec une clé AethexAI autorisée (jamais en Test sans validation) :

```python
from aethexai import AethexAI
client = AethexAI(api_key="ae_live_…")  # serveur uniquement
client.add_agent_tool(agent_id, name="catalog_search",
    description="Rechercher un matériau dans le catalogue BLOK vérifié.",
    tool_type="function",
    parameters_schema={"type": "object",
        "properties": {"query": {"type": "string"},
                       "categoryId": {"type": "integer"}},
        "required": ["query"]},
    endpoint_url="https://VOTRE-HOTE/api/v1/relance/tools/catalog-search",
    headers={"x-voice-tool-secret": "SECRET-OUTIL"})
# Répéter pour les 5 autres outils (contrats : docs/voice-tools.md + Swagger /api/docs).
```

L'agent existant (`blok_voice/agent/create_agent.py`) est **inchangé** : aucun
outil n'y est déclaré tant que les contrats backend ne sont pas validés en
bac à sable avec une clé de test.

## Règles de l'agent (à reporter dans le prompt système)

Français naturel (contexte ivoirien) ; comprendre avant de proposer ;
résultats catalogue réels uniquement ; prix/stock non vérifiés annoncés
comme tels ; confirmation explicite avant RFQ ; annoncer seulement le
confirmé backend ; enregistrer outcome et opposition ; stop commercial
immédiat sur opposition ; transfert humain quand le dossier dépasse ses
capacités ; jamais de rappel daté non enregistré.
