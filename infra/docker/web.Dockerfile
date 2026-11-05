# Immagine del sito pubblico (1F-W2 T4): `output: 'standalone'` di Next. Gli indirizzi pubblici
# restano vuoti nella build, così la stessa immagine vale per staging e produzione (DR-360).
#   docker build -f infra/docker/web.Dockerfile -t amoris-web:<commit> .

# Node 25.0.0 come `.nvmrc`, Debian 12 slim (glibc per i binari di sharp), fissato per digest.
FROM node:25.0.0-bookworm-slim@sha256:cb4db5ec2a285632fbd8ff2fc2cc3c4cc393245b0e4d8419fc08909bf29c52ea AS build
ENV CI=true PNPM_HOME=/pnpm PATH=/pnpm:$PATH npm_config_store_dir=/pnpm/store NEXT_TELEMETRY_DISABLED=1
RUN npm install --global --no-fund --no-audit pnpm@11.6.0
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch
COPY . .
RUN pnpm install --frozen-lockfile --offline
ENV NODE_ENV=production NEXT_PUBLIC_API_URL= NEXT_PUBLIC_SITE_URL=
RUN pnpm --filter @amoris/web build

FROM node:25.0.0-bookworm-slim@sha256:cb4db5ec2a285632fbd8ff2fc2cc3c4cc393245b0e4d8419fc08909bf29c52ea AS runtime
RUN groupadd --system --gid 10001 amoris \
 && useradd --system --uid 10001 --gid amoris --no-create-home --home-dir /nonexistent \
    --shell /usr/sbin/nologin amoris
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 TMPDIR=/tmp
WORKDIR /app
# File di root in sola lettura per l'utente: scrive solo in /tmp e nella cache di Next.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
RUN mkdir -p apps/web/.next/cache && chown amoris:amoris apps/web/.next/cache
USER amoris
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health/live/').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "apps/web/server.js"]
