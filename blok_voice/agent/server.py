# Run with:
#   AETHEX_API_KEY=ae_live_... AGENT_ID=<agent id> python3 server.py
#
# The browser cannot hold the API key, so the server proxies the
# two WebRTC signaling calls (/connect, /offer) to AethexAI
# on its behalf. The key never leaves this server.

import logging
import os

import requests
from flask import Flask, jsonify, request, send_from_directory

BASE_URL = "https://api.aethexai.com/api/v1"
# NOTE: the repository's existing .env uses API_KEY; accept both names,
# with AETHEX_API_KEY taking precedence.
API_KEY = os.environ.get("AETHEX_API_KEY") or os.environ.get("API_KEY", "")
AGENT_ID = os.environ.get("AGENT_ID", "")

CONNECT_TIMEOUT = 30   # seconds for the /connect call (upstream can take ~10s)
OFFER_TIMEOUT = 30     # seconds for the /offer call (SDP answer)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("blok-voice")

app = Flask(__name__)


def _headers():
    return {"X-API-Key": API_KEY, "Content-Type": "application/json"}


def _safe_upstream_error(resp):
    """Extract a user-facing message from an upstream response without secrets."""
    try:
        data = resp.json()
    except Exception:
        data = None
    if isinstance(data, dict):
        for key in ("error", "message", "detail"):
            val = data.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip()
    text = (resp.text or "").strip()
    if text and len(text) <= 300:
        return text
    return f"AethexAI a répondu avec le statut {resp.status_code}."


def _check_configured(need_agent=True):
    if not API_KEY:
        return jsonify({
            "error": "Clé API manquante. Définissez AETHEX_API_KEY puis redémarrez le serveur.",
        }), 500
    if need_agent and not AGENT_ID:
        return jsonify({
            "error": "Agent non configuré. Exécutez create_agent.py puis définissez AGENT_ID.",
        }), 500
    return None


@app.after_request
def add_cors(response):
    # Same-origin serving: the page is served by this server, so no
    # cross-origin is needed. Keep a narrow allowance for local dev only.
    origin = request.headers.get("Origin", "")
    if origin in ("http://localhost:5000", "http://127.0.0.1:5000"):
        response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


@app.route("/")
def index():
    return send_from_directory(os.path.dirname(os.path.abspath(__file__)), "client.html")


@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "aethex_configured": bool(API_KEY),
        "agent_configured": bool(AGENT_ID),
    })


@app.post("/session")
def start_session():
    missing = _check_configured(need_agent=True)
    if missing:
        return missing
    try:
        r = requests.post(
            f"{BASE_URL}/conversation/connect",
            json={"agent_id": AGENT_ID},
            headers=_headers(),
            timeout=CONNECT_TIMEOUT,
        )
    except requests.Timeout:
        log.warning("POST /conversation/connect timed out")
        return jsonify({"error": "Délai dépassé côté AethexAI. Réessayez."}), 502
    except requests.RequestException as exc:
        log.warning("POST /conversation/connect network error: %s", type(exc).__name__)
        return jsonify({"error": "Impossible de joindre AethexAI. Vérifiez votre connexion."}), 502
    if r.status_code == 404:
        log.warning("POST /conversation/connect -> 404 (agent inconnu ou route inconnue)")
        return jsonify({
            "error": "Agent introuvable côté AethexAI. Vérifiez AGENT_ID ou recréez l'agent.",
        }), 502
    if r.status_code == 401 or r.status_code == 403:
        log.warning("POST /conversation/connect -> %s (auth)", r.status_code)
        return jsonify({"error": "Clé API AethexAI refusée. Vérifiez AETHEX_API_KEY."}), 502
    if r.status_code >= 400:
        log.warning("POST /conversation/connect -> %s", r.status_code)
        return jsonify({"error": _safe_upstream_error(r)}), 502
    try:
        data = r.json()
    except Exception:
        log.warning("POST /conversation/connect returned non-JSON")
        return jsonify({"error": "Réponse inattendue d'AethexAI. Réessayez."}), 502
    if not isinstance(data, dict) or "session_id" not in data:
        log.warning("POST /conversation/connect missing session_id")
        return jsonify({"error": "Réponse inattendue d'AethexAI. Réessayez."}), 502
    log.info("session created sid=%s", str(data.get("session_id"))[:8])
    return jsonify(data)


@app.post("/session/<sid>/offer")
def proxy_offer(sid):
    missing = _check_configured(need_agent=False)
    if missing:
        return missing
    if not sid or len(sid) > 128:
        return jsonify({"error": "Identifiant de session invalide."}), 400
    body = request.get_json(silent=True)
    if not isinstance(body, dict) or not body.get("sdp") or not body.get("type"):
        return jsonify({"error": "Offre SDP invalide (champs 'sdp' et 'type' requis)."}), 400
    if body.get("type") != "offer":
        return jsonify({"error": "Type SDP inattendu : une 'offer' est requise."}), 400
    try:
        r = requests.post(
            f"{BASE_URL}/conversation/{sid}/offer",
            json={"sdp": body["sdp"], "type": body["type"]},
            headers=_headers(),
            timeout=OFFER_TIMEOUT,
        )
    except requests.Timeout:
        log.warning("POST /conversation/%s/offer timed out", sid[:8])
        return jsonify({"error": "Délai dépassé pendant la négociation WebRTC. Réessayez."}), 502
    except requests.RequestException as exc:
        log.warning("POST /conversation/%s/offer network error: %s", sid[:8], type(exc).__name__)
        return jsonify({"error": "Connexion à AethexAI interrompue pendant la négociation."}), 502
    if r.status_code == 404:
        return jsonify({"error": "Session expirée ou inconnue. Recommencez la conversation."}), 410
    if r.status_code >= 400:
        log.warning("POST /conversation/%s/offer -> %s", sid[:8], r.status_code)
        return jsonify({"error": _safe_upstream_error(r)}), 502
    try:
        data = r.json()
    except Exception:
        return jsonify({"error": "Réponse inattendue d'AethexAI pendant la négociation."}), 502
    if not isinstance(data, dict) or "sdp" not in data:
        return jsonify({"error": "Réponse SDP incomplète d'AethexAI. Réessayez."}), 502
    return jsonify(data)


if __name__ == "__main__":
    if not API_KEY:
        log.warning("AETHEX_API_KEY (ou API_KEY) n'est pas définie")
    if not AGENT_ID:
        log.warning("AGENT_ID n'est pas défini — exécutez create_agent.py")
    app.run(host="127.0.0.1", port=5000)
