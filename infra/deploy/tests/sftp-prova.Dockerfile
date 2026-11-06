# syntax=docker/dockerfile:1.7
# Destinazione SFTP SOLO per le prove del backup (1F-W3 T2, DR-370): mai nella CI di pubblicazione né nel Compose.
# Stessa base fissata dell'immagine di backup; chiavi, known_hosts e repository nascono nella prova, non qui.
#   docker build -f infra/deploy/tests/sftp-prova.Dockerfile -t amoris-sftp-prova:<tag> .
FROM postgres:17.11-alpine@sha256:562a6e0a66b5136bc28bef5944bbc2ddddf8ea0058d4016b96cee63f2edaf143
# La versione del pacchetto segue il repository Alpine 3.24, come il client ssh dell'immagine di backup.
RUN apk add --no-cache openssh-server=10.3_p1-r2 \
 && addgroup -S -g 10010 sftpuser \
 && adduser -D -u 10010 -G sftpuser -h /home/sftpuser -s /bin/sh sftpuser \
 && sed -i 's/^sftpuser:!/sftpuser:*/' /etc/shadow \
 && mkdir -p /var/empty /home/sftpuser/repo \
 && chown sftpuser:sftpuser /home/sftpuser /home/sftpuser/repo \
 && printf '%s\n' \
    'Port 2222' \
    'HostKey /keys/host_ed25519' \
    'AuthorizedKeysFile /keys/authorized_keys' \
    'StrictModes no' \
    'PasswordAuthentication no' \
    'KbdInteractiveAuthentication no' \
    'PubkeyAuthentication yes' \
    'AllowUsers sftpuser' \
    'PidFile /tmp/sshd.pid' \
    'Subsystem sftp internal-sftp' \
    > /etc/ssh/sshd_config
# Il server resta root (serve a sshd per cambiare utente); l'accesso dei client è dell'utente sftpuser.
ENTRYPOINT []
CMD ["/usr/sbin/sshd", "-D", "-e"]
