# syntax=docker/dockerfile:1
# Base images should be pinned by digest before production (SECURITY 6.3).
ARG NODE_VERSION=22-slim

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN npm install -g bun
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM node:${NODE_VERSION} AS build
WORKDIR /app
RUN npm install -g bun
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 BUILD_STANDALONE=true
RUN bun run build \
 && bun build src/server/worker.ts --target=node --outfile=dist/worker.js

FROM node:${NODE_VERSION} AS app
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN useradd --system --uid 1001 app
COPY --from=build --chown=app /app/.next/standalone ./
COPY --from=build --chown=app /app/.next/static ./.next/static
COPY --from=build --chown=app /app/public ./public
USER app
EXPOSE 3000
CMD ["node", "server.js"]

FROM node:${NODE_VERSION} AS worker
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -qq && apt-get install -y -qq postgresql-client >/dev/null && rm -rf /var/lib/apt/lists/*
RUN npm install --prefix /app --no-save --include=optional sharp@0.35.5
RUN useradd --system --uid 1001 app
COPY --from=build --chown=app /app/dist/worker.js ./worker.js
USER app
CMD ["node", "worker.js"]

# One-shot tools for preview environments: migrate, seed, and the synthetic-only check.
FROM node:${NODE_VERSION} AS tools
WORKDIR /app
RUN npm install -g bun
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY drizzle ./drizzle
COPY src ./src
CMD ["bun", "run", "db:migrate"]
