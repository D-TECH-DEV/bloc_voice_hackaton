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

## Les 6 outils (`POST /api/v1/relance/tools/*`, garde `VoiceToolGuard`)

| Outil | Entrée stricte | Sortie | Garde spécifique |
|---|---|---|---|
| `catalog-search` | `query`, `categoryId?` | `items[]` + fanions `prixVerifie`/`dispoVerifiee` + `correlationId` | — |
| `prepare-material-list` | `customerRef`, `items[{variantId?, label, qty, unit}]` | `listId`, `resolues`, `nonResolues` | Ligne inconnue = non résolue |
| `confirm-rfq` | `organizationId`, `items`, `confirmationClient: true`, `idempotenceKey` | `rfqNumber?`, `mock`, `suivi: indisponible` | 422 sans confirmation ; écritures Core requises sinon |
| `record-call-outcome` | `attemptId`, `outcome`, `summary` | `outcome` enregistré | Idempotent ; `refused` ⇒ opposition auto |
| `record-voice-opt-out` | `customerRef`, `proofRef?` | `statut: refused`, `effet: immediat` | Bloque toutes les tâches |
| `request-human-handoff` | `customerRef`, `motive`, `summary` | `handoffId`, `statut: pending` | Annonce seulement après réponse |

Erreurs : 400 (payload), 401 (secret), 422 (confirmation manquante),
409/404 (idempotence/ressource), 503 (secret serveur absent = outils
désactivés), 404 sur tout chemin hors allowlist — **aucun outil d'appel
sortant n'existe**.

## Enregistrement sur l'agent (en attente, procédure)

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
