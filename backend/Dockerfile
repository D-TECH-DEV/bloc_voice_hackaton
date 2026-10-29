# backend-api : NestJS (dev = watch, via l'override Compose).
# Les dépendances sont installées dans l'image ; en dev, ./backend est monté
# sur /app et /app/node_modules vit dans un volume nommé (jamais masqué).
FROM node:22-bookworm-slim AS base
WORKDIR /app
# npm ci exige le lockfile (présent) : installation reproductible.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund && npm cache clean --force
COPY . .
RUN chown -R node:node /app
USER node
EXPOSE 3001
# Commande dev (watch) : surchargée/précisée par docker-compose.override.yml.
CMD ["npm", "run", "start:dev"]
