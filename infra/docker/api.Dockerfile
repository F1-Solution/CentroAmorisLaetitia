# Immagine dell'API (1F-W2 T4): bundle esbuild eseguito da node (DR-358), con i soli moduli di
# produzione installati da `pnpm deploy`. Si costruisce dalla radice del repository:
#   docker build -f infra/docker/api.Dockerfile -t amoris-api:<commit> .

# Node 26.12.1 come `.nvmrc`, Debian 12 slim (glibc per i binari di sharp e argon2), fissato per digest.
FROM node:26.12.1-bookworm-slim@sha256:88e480776c6149ff1d098cd304f44bf18057fb5d284a3329b78162d29821e28c AS build
ENV CI=true PNPM_HOME=/pnpm PATH=/pnpm:$PATH npm_config_store_dir=/pnpm/store
RUN npm install --global --no-fund --no-audit pnpm@11.6.0
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch
COPY . .
RUN pnpm install --frozen-lockfile --offline
RUN pnpm --filter @amoris/api build \
 && rm apps/api/dist/bundle-meta.json
# Senza `--offline`: il deploy `--legacy` rilegge i metadati del registro e, offline, scarta i binari Linux di sharp e argon2.
RUN pnpm --filter @amoris/api deploy --prod --legacy /out \
 && cd /out && node -e "require('sharp'); require('@node-rs/argon2')"

FROM node:26.12.1-bookworm-slim@sha256:88e480776c6149ff1d098cd304f44bf18057fb5d284a3329b78162d29821e28c AS runtime
# Via npm, corepack e intestazioni di Node: a runtime non servono (DR-392).
RUN groupadd --system --gid 10001 amoris \
 && useradd --system --uid 10001 --gid amoris --no-create-home --home-dir /nonexistent \
    --shell /usr/sbin/nologin amoris \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/include/node
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=3002 TMPDIR=/tmp
WORKDIR /app
# File di root in sola lettura per l'utente: scrive solo in /tmp.
COPY --from=build /out/package.json ./package.json
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./
USER amoris
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.API_PORT || 3002) + '/health/live').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
# Migrazioni e primo account: `node bin/migrate.js`, `node bin/account-create.js` (mai all'avvio).
CMD ["node", "--enable-source-maps", "server.js"]
