# syntax=docker/dockerfile:1.7
# Kynetic client portal — production image.
# Build context: the portal/ folder. Build: docker build -f deploy/Dockerfile -t kynetic-portal .
# Alpine (musl) everywhere so the @node-rs/argon2 native binary installed by `npm ci`
# (@node-rs/argon2-linux-x64-musl) matches the runtime libc.

ARG NODE_IMAGE=node:22-alpine

# ---------- deps: full install (dev deps needed for next build / esbuild) ----------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- build ----------
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx next build
# Bundle the operator scripts into self-contained ESM files. Only the native argon2 module
# stays external (resolved from the standalone node_modules at runtime).
RUN mkdir -p dist-scripts && npx esbuild scripts/migrate.mts scripts/seed.mts scripts/create-admin.mts \
      --bundle --platform=node --format=esm --target=node22 --outdir=dist-scripts --out-extension:.js=.mjs \
      --external:@node-rs/argon2 \
      --banner:js="import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);"

# ---------- runtime ----------
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/data/uploads MIGRATIONS_DIR=/app/drizzle
RUN apk add --no-cache libc6-compat tini \
 && addgroup -S -g 1001 portal && adduser -S -u 1001 -G portal -h /app portal \
 && mkdir -p /data/uploads && chown portal:portal /data/uploads && chmod 700 /data/uploads

# Standalone server (traced node_modules only — no dev deps, no embedded-postgres).
COPY --from=build --chown=portal:portal /app/.next/standalone ./
COPY --from=build --chown=portal:portal /app/.next/static ./.next/static
COPY --from=build --chown=portal:portal /app/public ./public
COPY --from=build --chown=portal:portal /app/drizzle ./drizzle
COPY --from=build --chown=portal:portal /app/dist-scripts ./scripts
# Make sure argon2 + its musl binary are present even if output tracing missed the optional dep.
COPY --from=deps --chown=portal:portal /app/node_modules/@node-rs ./node_modules/@node-rs
COPY --chown=portal:portal deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh \
 && rm -rf node_modules/embedded-postgres node_modules/@embedded-postgres

USER portal
VOLUME ["/data/uploads"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health | grep -q '"ok":true' || exit 1
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
