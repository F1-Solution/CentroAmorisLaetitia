# syntax=docker/dockerfile:1.7
# Immagine del servizio di backup (1F-W3 T1, DR-366): restic, client PostgreSQL 17, mc e ssh.
# Parte dall'immagine del database del Compose, così pg_dump e pg_restore hanno la stessa versione
# del server. Porta solo gli script di infra/deploy/backup, nessun segreto.
#   docker build -f infra/docker/backup.Dockerfile -t amoris-backup:<commit> .

# Programma di backup: versione e impronta (SHA256SUMS della release) si aggiornano insieme.
FROM postgres:17.11-alpine@sha256:562a6e0a66b5136bc28bef5944bbc2ddddf8ea0058d4016b96cee63f2edaf143 AS tools
ADD --checksum=sha256:f415415624dcc452f2a02b8c33641791a8c6d6d3b65bbb3543fcf9a25151585c \
  https://github.com/restic/restic/releases/download/v0.19.1/restic_0.19.1_linux_amd64.bz2 /tmp/restic.bz2
RUN bzip2 -dc /tmp/restic.bz2 > /tmp/restic \
 && chmod 0755 /tmp/restic

FROM postgres:17.11-alpine@sha256:562a6e0a66b5136bc28bef5944bbc2ddddf8ea0058d4016b96cee63f2edaf143
# Client ssh per restic via SFTP (DR-370); la versione del pacchetto segue il repository Alpine 3.24.
RUN apk add --no-cache openssh-client-default=10.3_p1-r2 \
 && addgroup -S -g 10003 backup \
 && adduser -S -u 10003 -G backup -H -h /nonexistent -s /sbin/nologin backup
COPY --from=tools /tmp/restic /usr/local/bin/restic
COPY --from=cgr.dev/chainguard/minio-client@sha256:5feb4dcc570e7578f82e6c84384849e6557d005fb9b06f714c63f7184883b13f /usr/bin/mc /usr/local/bin/mc
RUN mkdir -p -m 0755 /usr/local/lib/amoris-backup
COPY --chmod=0755 infra/deploy/backup/amoris-backup /usr/local/bin/amoris-backup
COPY --chmod=0644 infra/deploy/backup/lib.sh /usr/local/lib/amoris-backup/lib.sh
# Cartelle dei volumi (dati di appoggio, stato, cache di restic): i volumi nuovi ne ereditano il proprietario.
RUN mkdir -p /backup/data /backup/state /backup/cache \
 && chown -R 10003:10003 /backup
# Il servizio non avvia PostgreSQL: via l'avvio dell'immagine di base.
ENTRYPOINT []
USER backup
CMD ["restic", "version"]
