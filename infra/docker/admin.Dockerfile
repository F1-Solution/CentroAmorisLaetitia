# Immagine dell'area amministrativa (1F-W2 T4): `output: 'standalone'` di Next con `basePath`
# `/admin`. Gli indirizzi pubblici restano vuoti nella build: l'area chiama `/api` sulla stessa
# origine (DR-360).
#   docker build -f infra/docker/admin.Dockerfile -t amoris-admin:<commit> .

# Node 26.12.1 come `.nvmrc`, Debian 12 slim, fissato per digest.
FROM node:26.12.1-bookworm-slim@sha256:88e480776c6149ff1d098cd304f44bf18057fb5d284a3329b78162d29821e28c AS build
ENV CI=true PNPM_HOME=/pnpm PATH=/pnpm:$PATH npm_config_store_dir=/pnpm/store NEXT_TELEMETRY_DISABLED=1
RUN npm install --global --no-fund --no-audit pnpm@11.6.0
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch
COPY . .
RUN pnpm install --frozen-lockfile --offline
ENV NODE_ENV=production NEXT_PUBLIC_API_URL= NEXT_PUBLIC_SITE_URL=
RUN pnpm --filter @amoris/admin build

FROM node:26.12.1-bookworm-slim@sha256:88e480776c6149ff1d098cd304f44bf18057fb5d284a3329b78162d29821e28c AS runtime
# Via npm, corepack e intestazioni di Node: a runtime non servono (DR-392).
RUN groupadd --system --gid 10001 amoris \
 && useradd --system --uid 10001 --gid amoris --no-create-home --home-dir /nonexistent \
    --shell /usr/sbin/nologin amoris \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/include/node
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3001 TMPDIR=/tmp
WORKDIR /app
# File di root in sola lettura per l'utente: scrive solo in /tmp e nella cache di Next.
COPY --from=build /repo/apps/admin/.next/standalone ./
COPY --from=build /repo/apps/admin/.next/static ./apps/admin/.next/static
RUN mkdir -p apps/admin/.next/cache && chown amoris:amoris apps/admin/.next/cache
USER amoris
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/admin/health/live').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "apps/admin/server.js"]
