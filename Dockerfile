# Funny Stories — self-hosted container image (spec §16 step 14).
# Single-stage node:20-alpine: install, build, drop dev tooling, run.
# The same Node process serves the built client bundle (spec §14) — no nginx
# sidecar. The Cloudflare Worker is NOT dockerised (see §15).
FROM node:20-alpine

WORKDIR /app

# Install dependencies first for layer caching. npm ci needs every
# workspace's package.json present before it runs. --include=dev forces the
# build tooling in regardless of any inherited NODE_ENV.
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
COPY shared/package.json ./shared/package.json
RUN npm ci --include=dev

# Build client + server (the server build also copies i18n JSON into dist),
# then prune dev-only dependencies to slim the image.
COPY . .
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server/dist/index.js"]
