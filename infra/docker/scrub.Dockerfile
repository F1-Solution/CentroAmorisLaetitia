# syntax=docker/dockerfile:1.7
# Immagine del servizio di pulizia (1F-W2 T5, DR-359, DR-361): ingresso `bin/scrub-server.js` del
# bundle dell'API, con qpdf e ffmpeg/ffprobe dagli stessi binari e dalle stesse impronte della CI
# (ci.yml, DR-268). Nessun node_modules: il servizio non usa moduli nativi.
#   docker build -f infra/docker/scrub.Dockerfile -t amoris-scrub:<commit> .

# Node 25.0.0 come `.nvmrc`, Debian 12 slim, fissato per digest.
FROM node:25.0.0-bookworm-slim@sha256:cb4db5ec2a285632fbd8ff2fc2cc3c4cc393245b0e4d8419fc08909bf29c52ea AS build
ENV CI=true PNPM_HOME=/pnpm PATH=/pnpm:$PATH npm_config_store_dir=/pnpm/store
RUN npm install --global --no-fund --no-audit pnpm@11.6.0
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch
COPY . .
RUN pnpm install --frozen-lockfile --offline
# Il bundle è ESM: l'immagine porta solo un package.json con `"type": "module"`.
RUN pnpm --filter @amoris/api build \
 && echo '{"type":"module"}' > /repo/scrub-package.json

# Programmi della pulizia: versione e impronta si aggiornano insieme a ci.yml.
FROM node:25.0.0-bookworm-slim@sha256:cb4db5ec2a285632fbd8ff2fc2cc3c4cc393245b0e4d8419fc08909bf29c52ea AS tools
RUN apt-get update \
 && apt-get install --yes --no-install-recommends unzip xz-utils \
 && rm -rf /var/lib/apt/lists/*
ADD --checksum=sha256:db367d897829f22c4198ce1094143c9d467bd6ee7dfabc44ba6f02056b24f8b1 \
  https://github.com/qpdf/qpdf/releases/download/v12.4.2/qpdf-12.4.2-bin-linux-x86_64.zip /tmp/qpdf.zip
ADD --checksum=sha256:68ee646831adaae2495618346f3bba94ff207ff83bbd34d643e7004730d66269 \
  https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-09-30-13-08/ffmpeg-n9.0.2-17-g2a571b6068-linux64-gpl-9.0.tar.xz /tmp/ffmpeg.tar.xz
RUN mkdir -p /opt/qpdf /opt/ffmpeg/bin \
 && unzip -q /tmp/qpdf.zip -d /opt/qpdf \
 && tar -xJf /tmp/ffmpeg.tar.xz -C /tmp \
 && cp /tmp/ffmpeg-n9.0.2-17-g2a571b6068-linux64-gpl-9.0/bin/ffmpeg /tmp/ffmpeg-n9.0.2-17-g2a571b6068-linux64-gpl-9.0/bin/ffprobe /opt/ffmpeg/bin/ \
 && /opt/qpdf/bin/qpdf --version \
 && /opt/ffmpeg/bin/ffmpeg -version | head -n 1

FROM node:25.0.0-bookworm-slim@sha256:cb4db5ec2a285632fbd8ff2fc2cc3c4cc393245b0e4d8419fc08909bf29c52ea AS runtime
RUN groupadd --system --gid 10002 scrub \
 && useradd --system --uid 10002 --gid scrub --no-create-home --home-dir /nonexistent \
    --shell /usr/sbin/nologin scrub
ENV NODE_ENV=production SCRUB_HOST=0.0.0.0 SCRUB_PORT=3003 TMPDIR=/tmp \
    QPDF_PATH=/opt/qpdf/bin/qpdf FFMPEG_PATH=/opt/ffmpeg/bin/ffmpeg FFPROBE_PATH=/opt/ffmpeg/bin/ffprobe
COPY --from=tools /opt/qpdf /opt/qpdf
COPY --from=tools /opt/ffmpeg /opt/ffmpeg
WORKDIR /app
COPY --from=build /repo/scrub-package.json ./package.json
# File di root in sola lettura per l'utente: scrive solo nella cartella temporanea.
COPY --from=build /repo/apps/api/dist/bin/scrub-server.js /repo/apps/api/dist/bin/scrub-server.js.map ./bin/
COPY --from=build /repo/apps/api/dist/chunks ./chunks
USER scrub
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.SCRUB_PORT || 3003) + '/health/live').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "--enable-source-maps", "bin/scrub-server.js"]
