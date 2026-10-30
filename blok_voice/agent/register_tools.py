# Run with (dry-run par défaut, aucun appel réseau) :
#   python3 register_tools.py
# Enregistrement réel (exige un hôte HTTPS joignable par AethexAI) :
#   VOICE_TOOL_SECRET=... AETHEX_API_KEY=... AGENT_ID=... \
#     python3 register_tools.py --apply --public-base-url https://votre-hote
#
# Déclare (ou met à jour) les 9 outils métier BLOK sur l'agent AethexAI.
# Contrats : miroirs exacts des DTO backend (backend/src/voice-tools/*.ts).
# Référence mécanisme : SDK aethexai 1.0.2, modèle AgentToolCreate
# (name, description, endpoint_url, headers, parameters_schema,
#  tool_type="function") ; routes POST/GET /api/v1/agents/{id}/tools,
# PATCH /api/v1/agents/{id}/tools/{tool_id}.
# Le secret d'outil transite uniquement en en-tête x-voice-tool-secret ;
# il n'est jamais affiché ni placé dans un prompt.

import argparse
import json
import os
import sys
import urllib.parse

import requests

BASE_URL = "https://api.aethexai.com/api/v1"
API_KEY = os.environ.get("AETHEX_API_KEY") or os.environ.get("API_KEY", "")
AGENT_ID = os.environ.get("AGENT_ID", "")
TOOL_SECRET = os.environ.get("VOICE_TOOL_SECRET", "")

TIMEOUT = 20

LIST_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "variantId": {"type": "integer", "minimum": 1},
        "label": {"type": "string", "minLength": 1, "maxLength": 256},
        "qty": {"type": "number", "exclusiveMinimum": 0},
        "unit": {"type": "string", "minLength": 1, "maxLength": 32},
    },
    "required": ["label", "qty", "unit"],
}

# Miroir de ToolRecommendationItemDto : tout est optionnel sauf le libellé
# (prix/devise/quantité restent NULL quand la source ne les fournit pas).
RECOMMENDATION_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "variantId": {"type": "integer", "minimum": 1},
        "ref": {"type": "string", "maxLength": 128},
        "label": {"type": "string", "minLength": 1, "maxLength": 256},
        "qty": {"type": "number", "exclusiveMinimum": 0},
        "unit": {"type": "string", "minLength": 1, "maxLength": 32},
        "unitPrice": {"type": "number", "minimum": 0},
        "currency": {"type": "string", "minLength": 1, "maxLength": 8},
    },
    "required": ["label"],
}

# Miroir exact des DTO backend (voice-tools.dto.ts) : mêmes champs,
# mêmes bornes, mêmes requis. Toute divergence doit faire échouer
# test_register_tools.py avant un --apply.
TOOLS = [
    {
        "name": "catalog_search",
        "description": (
            "Rechercher un matériau dans le catalogue BLOK. "
            "Annoncer prix et disponibilités comme non vérifiés quand "
            "les fanions valent false. Ne jamais inventer un produit. "
            "Passer sessionId pour rattacher la recherche à la conversation."
        ),
        "path": "/api/v1/relance/tools/catalog-search",
        "parameters_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "minLength": 1, "maxLength": 120},
                "categoryId": {"type": "integer", "minimum": 1},
                "sessionId": {"type": "string", "format": "uuid"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "record_recommendations",
        "description": (
            "Enregistrer les produits effectivement présentés au client "
            "dans la conversation (proposés, pas sélectionnés). "
            "Ne jamais y inclure un produit non retourné par catalog_search."
        ),
        "path": "/api/v1/relance/tools/record-recommendations",
        "parameters_schema": {
            "type": "object",
            "properties": {
                "sessionId": {"type": "string", "format": "uuid"},
                "searchId": {"type": "string", "format": "uuid"},
                "items": {"type": "array", "minItems": 1, "items": RECOMMENDATION_ITEM_SCHEMA},
            },
            "required": ["sessionId", "items"],
        },
    },
    {
        "name": "confirm_selections",
        "description": (
            "Confirmer des produits proposés après l'accord explicite du "
            "client (confirmationClient=true exigé). Annoncer uniquement "
            "ce que le backend confirme."
        ),
        "path": "/api/v1/relance/tools/confirm-selections",
        "parameters_schema": {
            "type": "object",
            "properties": {
                "sessionId": {"type": "string", "format": "uuid"},
                "itemIds": {"type": "array", "minItems": 1,
                            "items": {"type": "string", "format": "uuid"}},
                "confirmationClient": {"type": "boolean"},
            },
            "required": ["sessionId", "itemIds", "confirmationClient"],
        },
    },
    {
        "name": "end_conversation",
        "description": (
            "Terminer la conversation et figer son contexte "
            "(récapitulatif rejouable côté interface)."
        ),
        "path": "/api/v1/relance/tools/end-conversation",
        "parameters_schema": {
            "type": "object",
            "properties": {
                "sessionId": {"type": "string", "format": "uuid"},
            },
            "required": ["sessionId"],
        },
    },
    {
        "name": "prepare_material_list",
        "description": (
            "Préparer un brouillon de liste de matériaux pour un client. "
            "Un brouillon n'est ni un devis ni une commande : le rappeler."
        ),
        "path": "/api/v1/relance/tools/prepare-material-list",
        "parameters_schema": {
            "type": "object",
            "properties": {
                "customerRef": {"type": "string", "minLength": 1, "maxLength": 128},
                "projectRef": {"type": "string", "maxLength": 128},
                "items": {"type": "array", "minItems": 1, "items": LIST_ITEM_SCHEMA},
            },
            "required": ["customerRef", "items"],
        },
    },
    {
        "name": "confirm_rfq",
        "description": (
            "Transmettre une demande de devis. Exige la confirmation "
            "explicite du client (confirmationClient=true) et une clé "
            "d'idempotence. Annoncer uniquement le résultat confirmé."
        ),
        "path": "/api/v1/relance/tools/confirm-rfq",
        "parameters_schema": {
            "type": "object",
            "properties": {
                "organizationId": {"type": "integer", "minimum": 1},
                "items": {"type": "array", "minItems": 1, "items": LIST_ITEM_SCHEMA},
                "confirmationClient": {"type": "boolean"},
                "idempotenceKey": {"type": "string", "minLength": 8, "maxLength": 128},
            },
            "required": ["organizationId", "items", "confirmationClient", "idempotenceKey"],
        },
    },
    {
        "name": "record_call_outcome",
        "description": (
            "Enregistrer l'issue d'une tentative d'appel "
            "(completed, no_answer, failed, refused). Un refus enregistre "
            "automatiquement l'opposition au démarchage."
        ),
        "path": "/api/v1/relance/tools/record-call-outcome",
        "parameters_schema": {
            "type": "object",
            "properties": {
                "attemptId": {"type": "string", "format": "uuid"},
                "outcome": {"type": "string", "enum": ["completed", "no_answer", "failed", "refused"]},
                "summary": {"type": "string", "minLength": 1, "maxLength": 500},
            },
            "required": ["attemptId", "outcome", "summary"],
        },
    },
    {
        "name": "record_voice_opt_out",
        "description": (
            "Enregistrer immédiatement l'opposition d'un client au "
            "démarchage vocal. Effet immédiat : stop commercial total."
        ),
        "path": "/api/v1/relance/tools/record-voice-opt-out",
        "parameters_schema": {
            "type": "object",
            "properties": {
                "customerRef": {"type": "string", "minLength": 1, "maxLength": 128},
                "proofRef": {"type": "string", "maxLength": 256},
            },
            "required": ["customerRef"],
        },
    },
    {
        "name": "request_human_handoff",
        "description": (
            "Transmettre un dossier à un conseiller humain. Annoncer la "
            "transmission uniquement après la réponse confirmée."
        ),
        "path": "/api/v1/relance/tools/request-human-handoff",
        "parameters_schema": {
            "type": "object",
            "properties": {
                "taskId": {"type": "string"},
                "customerRef": {"type": "string", "minLength": 1, "maxLength": 128},
                "motive": {"type": "string", "minLength": 10},
                "summary": {"type": "string", "minLength": 1},
            },
            "required": ["customerRef", "motive", "summary"],
        },
    },
]


def _headers():
    return {"X-API-Key": API_KEY, "Content-Type": "application/json"}


def _public_base_url(value):
    """Valide l'hôte public : HTTPS joignable, jamais local. Lève sinon."""
    if not value:
        raise ValueError("--public-base-url est requis en mode --apply.")
    parsed = urllib.parse.urlparse(value)
    host = (parsed.hostname or "").lower()
    local_markers = ("localhost", "127.", "0.0.0.0", "::1", ".local", ".internal")
    private_prefixes = ("10.", "192.168.") + tuple(f"172.{i}." for i in range(16, 32))
    if parsed.scheme != "https":
        raise ValueError("L'hôte public doit être en HTTPS.")
    if not host or host in local_markers or host.startswith(local_markers[1:]):
        raise ValueError("L'hôte public ne doit pas être local.")
    if host.startswith(private_prefixes):
        raise ValueError("L'hôte public ne doit pas être une adresse privée.")
    return value.rstrip("/")


def _payload(tool, base_url):
    return {
        "name": tool["name"],
        "description": tool["description"],
        "tool_type": "function",
        "endpoint_url": base_url + tool["path"],
        "headers": {"x-voice-tool-secret": TOOL_SECRET},
        "parameters_schema": tool["parameters_schema"],
    }


def list_remote_tools():
    r = requests.get(f"{BASE_URL}/agents/{AGENT_ID}/tools", headers=_headers(), timeout=TIMEOUT)
    r.raise_for_status()
    data = r.json()
    return data.get("data", data) if isinstance(data, dict) else data


def register(dry_run, base_url):
    """Déclare ou met à jour les 6 outils. Retourne la liste des actions."""
    actions = []
    remote = [] if dry_run else list_remote_tools()
    by_name = {t.get("name"): t for t in remote if isinstance(t, dict)}
    for tool in TOOLS:
        payload = _payload(tool, base_url)
        existing = by_name.get(tool["name"])
        if dry_run:
            actions.append(("create" if existing is None else "update", tool["name"], payload["endpoint_url"]))
            continue
        if existing is None:
            r = requests.post(
                f"{BASE_URL}/agents/{AGENT_ID}/tools", json=payload,
                headers=_headers(), timeout=TIMEOUT,
            )
            r.raise_for_status()
            actions.append(("created", tool["name"], payload["endpoint_url"]))
        else:
            r = requests.patch(
                f"{BASE_URL}/agents/{AGENT_ID}/tools/{existing['id']}", json=payload,
                headers=_headers(), timeout=TIMEOUT,
            )
            r.raise_for_status()
            actions.append(("updated", tool["name"], payload["endpoint_url"]))
    return actions


def main(argv=None):
    parser = argparse.ArgumentParser(description="Déclare les 6 outils BLOK sur l'agent AethexAI.")
    parser.add_argument("--apply", action="store_true", help="Exécute réellement (défaut : dry-run).")
    parser.add_argument("--public-base-url", default="", help="Hôte HTTPS public du backend.")
    args = parser.parse_args(argv)
    if not API_KEY or not AGENT_ID:
        print("AETHEX_API_KEY et AGENT_ID sont requis.", file=sys.stderr)
        return 2
    if len(TOOL_SECRET) < 16:
        print("VOICE_TOOL_SECRET (16 caractères min) est requis.", file=sys.stderr)
        return 2
    try:
        # En dry-run, une base fictive suffit : rien n'est envoyé.
        base_url = args.public_base_url.rstrip("/") if args.apply else "https://exemple-public.invalid"
        if args.apply:
            base_url = _public_base_url(args.public_base_url)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    try:
        actions = register(dry_run=not args.apply, base_url=base_url)
    except requests.RequestException as exc:
        print(f"Appel AethexAI impossible : {type(exc).__name__}.", file=sys.stderr)
        return 1
    for verb, name, url in actions:
        print(f"{verb:8s} {name:22s} {url}")
    if not args.apply:
        print("(dry-run : rien n'a été envoyé à AethexAI)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
