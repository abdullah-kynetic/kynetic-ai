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
# The commit shown by /api/health. CI passes BUILD_COMMIT_SHA; portal-new-deploy writes .commit into the
# build context. Either way it lands in build-commit, and src/server/build-info.ts reads it at runtime.
ARG BUILD_COMMIT_SHA=
RUN { printf '%s' "${BUILD_COMMIT_SHA}" | grep -E '^[0-9a-f]{7,40}$' \
      || { [ -f .commit ] && grep -E '^[0-9a-f]{7,40}$' .commit; } \
      || echo unknown; } | head -1 > build-commit \
 && bun run build \
 && bun build src/server/worker.ts --target=node --outfile=dist/worker.js

FROM node:${NODE_VERSION} AS app
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN useradd --system --uid 1001 app
COPY --from=build --chown=app /app/.next/standalone ./
COPY --from=build --chown=app /app/.next/static ./.next/static
COPY --from=build --chown=app /app/public ./public
COPY --from=build --chown=app /app/build-commit ./build-commit
USER app
EXPOSE 3000
CMD ["node", "server.js"]

FROM node:${NODE_VERSION} AS worker
WORKDIR /app
ENV NODE_ENV=production
# pg_dump must be the same major version as the server (Postgres 16). The Debian default client is
# older and every backup run failed with "server version mismatch" (2026-11-10 to 2026-11-12), so the
# 16 client comes from the PostgreSQL apt repository and the build fails if it is not 16.
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends ca-certificates curl gnupg >/dev/null \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  && . /etc/os-release \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update -qq && apt-get install -y -qq --no-install-recommends postgresql-client-16 >/dev/null \
  && pg_dump --version | grep -q ' 16\.' \
  && rm -rf /var/lib/apt/lists/*
RUN npm install --prefix /app --no-save --include=optional sharp@0.35.5
RUN useradd --system --uid 1001 app
COPY --from=build --chown=app /app/dist/worker.js ./worker.js
COPY --from=build --chown=app /app/build-commit ./build-commit
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
