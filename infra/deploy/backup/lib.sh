# Funzioni comuni degli script di backup (1F-W3 T2, DR-366…DR-373); si legge con `.` da amoris-backup.
# Regole: nessun segreto sull'uscita, nessun output degli strumenti, una sola riga JSON per esecuzione (DR-371).

BACKUP_HOST_NAME=amoris
BACKUP_TAG=amoris-backup
DATA_DIR=${BACKUP_DATA_DIR:-/backup/data}
STATE_DIR=${BACKUP_STATE_DIR:-/backup/state}
WORK_DIR=
RESTORE_DIR=
SESSIONS_REVOKED=

CMD=
STARTED_EPOCH=0
STARTED_ISO=
DUMP_BYTES=null
OBJECTS_BYTES=null
OBJECTS_COUNT=null
SNAPSHOT_ID=
REPO_STATE=
EMITTED=
STATE_UNWRITTEN=
HAVE_LOCK=

# Comincia un comando: orario, cartella di lavoro in /tmp e pulizia all'uscita.
begin() {
  CMD=$1
  STARTED_EPOCH=$(date +%s)
  STARTED_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  WORK_DIR=$(mktemp -d /tmp/amoris-backup.XXXXXX) || WORK_DIR=
  trap cleanup EXIT
  trap 'exit 143' INT TERM
  # Stato non scrivibile: si ferma prima di qualunque dump o contatto con la rete.
  # Prova di scrittura vera: `test -w` di BusyBox non vede un volume in sola lettura.
  [ -d "$STATE_DIR" ] && touch "$STATE_DIR/.write-probe" 2>/dev/null || fail state_write 74
  rm -f "$STATE_DIR/.write-probe"
}

# Lock esclusivo non bloccante sul volume di stato: una sola esecuzione di backup o ripristino alla volta.
# Preso il lock si svuota /backup/data: un SIGKILL o un OOM precedenti saltano il trap d'uscita (DR-403).
acquire_lock() {
  exec 9>"$STATE_DIR/.lock" || fail state_write 74
  flock -n 9 || fail busy 75
  HAVE_LOCK=1
  empty_data_dir
}

# Svuota /backup/data (R18): la copia in chiaro non resta sul disco; agisce solo sul contenuto di quella cartella.
empty_data_dir() {
  [ -n "$DATA_DIR" ] && [ "$DATA_DIR" != / ] && [ -d "$DATA_DIR" ] || return 0
  chmod -R u+rwX "$DATA_DIR" 2>/dev/null || true
  find "$DATA_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
}

# Uscita senza riga di esito: la emette come unexpected; i dati si svuotano solo con il lock, anche dopo un errore.
cleanup() {
  rc=$?
  trap - EXIT
  if [ -n "$CMD" ] && [ -z "$EMITTED" ]; then
    [ "$rc" -ne 0 ] || rc=1
    emit error unexpected "$rc"
  fi
  if [ -n "$WORK_DIR" ]; then rm -rf "$WORK_DIR"; fi
  if [ -n "$HAVE_LOCK" ]; then empty_data_dir; fi
  exit "$rc"
}

json_string_or_null() {
  if [ -n "$1" ]; then printf '"%s"' "$1"; else printf 'null'; fi
}

# Compone la riga di esito: $1 esito, $2 passo fallito (vuoto se nessuno), $3 codice.
compose() {
  extra=
  [ -z "$REPO_STATE" ] || extra=",\"repository\":\"$REPO_STATE\""
  [ -z "$STATE_UNWRITTEN" ] || extra="$extra,\"state_written\":false"
  [ -z "$SESSIONS_REVOKED" ] || extra="$extra,\"sessions_revoked\":$SESSIONS_REVOKED"
  printf '{"command":"%s","outcome":"%s","started_at":"%s","duration_seconds":%s,"dump_bytes":%s,"objects_bytes":%s,"objects_count":%s,"snapshot_id":%s,"failed_step":%s,"exit_code":%s%s}' \
    "$CMD" "$1" "$STARTED_ISO" "$(($(date +%s) - STARTED_EPOCH))" "$DUMP_BYTES" "$OBJECTS_BYTES" \
    "$OBJECTS_COUNT" "$(json_string_or_null "$SNAPSHOT_ID")" "$(json_string_or_null "$2")" "$3" "$extra"
}

# Scrive il file di stato in modo atomico, in una cartella separata dai dati sottoposti a backup.
write_state() {
  [ -d "$STATE_DIR" ] && [ -w "$STATE_DIR" ] || return 1
  state_tmp="$STATE_DIR/.last-$CMD.json.tmp"
  if { printf '%s\n' "$1" >"$state_tmp"; } 2>/dev/null && mv -f "$state_tmp" "$STATE_DIR/last-$CMD.json" 2>/dev/null; then
    return 0
  fi
  rm -f "$state_tmp"
  return 1
}

# Stampa la riga di esito e la registra; $1 esito, $2 passo, $3 codice.
emit() {
  EMITTED=1
  line=$(compose "$1" "$2" "$3")
  if ! write_state "$line"; then
    STATE_UNWRITTEN=1
    if [ "$1" = ok ]; then
      line=$(compose error state_write 74)
      printf '%s\n' "$line"
      exit 74
    fi
    line=$(compose "$1" "$2" "$3")
  fi
  printf '%s\n' "$line"
}

# Chiude con errore: $1 passo fallito, $2 codice dello strumento (mai 0).
fail() {
  code=${2:-1}
  [ "$code" -ne 0 ] 2>/dev/null || code=1
  emit error "$1" "$code"
  exit "$code"
}

succeed() {
  emit ok "" 0
  exit 0
}

config_error() {
  fail config 78
}

# Verifica che le variabili elencate abbiano un valore, senza stamparlo.
need() {
  for name in "$@"; do
    eval "value=\${$name:-}"
    [ -n "$value" ] || config_error
  done
}

# Imposta ed esporta $1 dal valore diretto o dal file indicato in $1_FILE (il file vince).
load_secret() {
  eval "secret_file=\${$1_FILE:-}"
  if [ -n "$secret_file" ]; then
    [ -r "$secret_file" ] || config_error
    secret_value=$(cat "$secret_file") || config_error
    eval "$1=\$secret_value"
  fi
  eval "secret_value=\${$1:-}"
  [ -n "$secret_value" ] || config_error
  export "${1?}"
}

# Rifiuta valori con caratteri che l'interprete di ssh potrebbe leggere come altro.
safe_word() {
  case $1 in
    '' | -* | *[!A-Za-z0-9._/-]*) config_error ;;
  esac
}

# Prepara restic per la destinazione SFTP: chiave copiata in /tmp con permessi 0600, host verificato.
setup_restic() {
  BACKUP_SFTP_PORT=${BACKUP_SFTP_PORT:-22}
  BACKUP_SSH_KEY_FILE=${BACKUP_SSH_KEY_FILE:-/run/secrets/backup_ssh_key}
  BACKUP_KNOWN_HOSTS_FILE=${BACKUP_KNOWN_HOSTS_FILE:-/run/secrets/backup_known_hosts}
  need BACKUP_SFTP_HOST BACKUP_SFTP_USER BACKUP_SFTP_PATH
  safe_word "$BACKUP_SFTP_HOST"
  safe_word "$BACKUP_SFTP_USER"
  safe_word "$BACKUP_SFTP_PATH"
  case $BACKUP_SFTP_PORT in '' | *[!0-9]*) config_error ;; esac
  BACKUP_SSH_CONNECT_TIMEOUT=${BACKUP_SSH_CONNECT_TIMEOUT:-15}
  case $BACKUP_SSH_CONNECT_TIMEOUT in '' | *[!0-9]*) config_error ;; esac
  [ -r "$BACKUP_SSH_KEY_FILE" ] && [ -r "$BACKUP_KNOWN_HOSTS_FILE" ] || config_error
  if [ -z "${RESTIC_PASSWORD:-}" ]; then
    [ -r "${RESTIC_PASSWORD_FILE:-}" ] || config_error
  fi
  [ -n "$WORK_DIR" ] || config_error
  (umask 077 && cat "$BACKUP_SSH_KEY_FILE" >"$WORK_DIR/ssh_key") || config_error

  SFTP_COMMAND="ssh -F /dev/null -p $BACKUP_SFTP_PORT -i $WORK_DIR/ssh_key -o IdentitiesOnly=yes -o IdentityAgent=none -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$BACKUP_KNOWN_HOSTS_FILE -o GlobalKnownHostsFile=/dev/null -o ConnectTimeout=$BACKUP_SSH_CONNECT_TIMEOUT -o ServerAliveInterval=15 -o ServerAliveCountMax=4 $BACKUP_SFTP_USER@$BACKUP_SFTP_HOST -s sftp"
  RESTIC_REPOSITORY="sftp:$BACKUP_SFTP_USER@$BACKUP_SFTP_HOST:$BACKUP_SFTP_PATH"
  export RESTIC_REPOSITORY
  # La cache sta nel volume dedicato se c'è, altrimenti in /tmp: il resto del file system è in sola lettura.
  cache=${BACKUP_CACHE_DIR:-/backup/cache}
  if [ -d "$cache" ] && [ -w "$cache" ]; then RESTIC_CACHE_DIR=$cache; else RESTIC_CACHE_DIR=$WORK_DIR/cache; fi
  export RESTIC_CACHE_DIR
}

# restic con il comando ssh fissato; l'uscita la scarta il chiamante.
restic_run() {
  restic -o "sftp.command=$SFTP_COMMAND" "$@"
}

# Il repository risponde e la password è giusta; il codice di restic (10 assente, 12 password) passa invariato.
probe_repository() {
  restic_run cat config >/dev/null 2>&1
}
