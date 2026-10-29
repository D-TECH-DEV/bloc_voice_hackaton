# voice-agent : proxy Flask existant (signalisation WebRTC AethexAI).
# Le venv vit dans l'image (/opt/venv) : le bind de dev ne monte que
# ./blok_voice/agent (sources), l'environnement n'est jamais masqué ni
# réinstallé au démarrage. Le .venv hôte existant reste réservé à l'usage local.
FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH"
WORKDIR /app
COPY requirements.txt ./
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt
COPY agent/ ./agent/
EXPOSE 5000
# Rechargement dev (--reload) via l'override. Le reloader ne redémarre que le
# serveur HTTP : aucune session vocale n'est créée au (re)démarrage.
CMD ["flask", "--app", "agent.server", "run", "--host", "0.0.0.0", "--port", "5000"]
