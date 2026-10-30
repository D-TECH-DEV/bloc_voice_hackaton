# frontend-commercial : image de PRODUCTION par défaut.
# - Stage `builder` : `npm run build` sur le code source copié (le .next hôte
#   est exclu par .dockerignore : aucun ancien build ne masque le source).
# - Stage `runner` : `npm run start` sur 0.0.0.0:3000 (même code, mêmes deps).
# - Dev local (hot reload) : docker-compose.override.yml surcharge command +
#   volumes ; la base reste la référence de production.
FROM node:22-bookworm-slim AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund && npm cache clean --force
COPY . .
RUN npm run build && chown -R node:node /app
USER node
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
EXPOSE 3000
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
