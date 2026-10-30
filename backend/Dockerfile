# backend-api : image de PRODUCTION par défaut (même mécanique que le frontend).
# - `npm run build` sur le code source copié (dist/ hôte exclu par .dockerignore).
# - Démarrage : `node dist/src/main` (identique à `start:prod`).
# - Dev local (watch) : docker-compose.override.yml surcharge command + volumes.
# - Le service `migrate` réutilise cette image (`migration:run` via ts-node).
FROM node:22-bookworm-slim AS base
WORKDIR /app
# npm ci exige le lockfile (présent) : installation reproductible.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund && npm cache clean --force
COPY . .
RUN npm run build && chown -R node:node /app
USER node
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/src/main"]
