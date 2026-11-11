# syntax=docker/dockerfile:1.7
# Server di prova SOLO per le prove del rilascio (1F-W5 T3a): sshd vero e utente `deploy`, come sul server Ubuntu.
# Base già presente per digest; chiavi, `docker` finto e archivi nascono nella prova, non qui.
#   docker build -t amoris-rilascio-prova:<tag> - < infra/deploy/tests/rilascio-prova.Dockerfile
FROM ubuntu:22.04@sha256:5ec03bb3441e8b0bf3b4f9cd4629a1ae763010dc3035bb8da3ae6cf026486401
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends openssh-server openssh-client python3 \
 && rm -rf /var/lib/apt/lists/* \
 && useradd -m -s /bin/bash deploy \
 && usermod -p '*' deploy \
 && mkdir -p /run/sshd /opt/amoris/rilascio /srv/prova /srv/finto /srv/fix \
 && chown deploy:deploy /srv/prova /srv/finto \
 && printf '%s\n' \
    'Port 22' \
    'HostKey /etc/ssh/ssh_host_ed25519_key' \
    'PasswordAuthentication no' \
    'KbdInteractiveAuthentication no' \
    'PermitRootLogin no' \
    'UsePAM no' \
    'AllowUsers deploy' \
    'Subsystem sftp internal-sftp' \
    > /etc/ssh/sshd_config
CMD ["sleep", "3600"]
