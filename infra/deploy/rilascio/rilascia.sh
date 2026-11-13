#!/bin/sh
# Rilascio sul server (1F-W5 T3a, DR-411): è l'unico comando che la chiave SSH di GitHub Actions può eseguire.
#
# Si lancia solo come comando forzato di authorized_keys (vedi authorized_keys.esempio); il comando del client
# arriva in SSH_ORIGINAL_COMMAND e ha una sola forma: `rilascia <production|staging> <hash di 40 caratteri> [--migrazioni]`.
# Ingresso standard: utente GitHub, token del registro, poi `git archive --format=tar.gz <hash> infra`.
# Uscita standard: una sola riga JSON d'esito (con il nome del registro); l'uscita di docker resta sul server (DR-422).
# Codici: 0 riuscito, 64 comando rifiutato, 1 errore di un passo.
# La radice è /opt/amoris, cambiabile solo con AMORIS_RADICE impostata nella riga di authorized_keys (prove).
set -u
# I file estratti devono restare leggibili ai contenitori; registri e configurazione di docker hanno permessi propri.
umask 022
LC_ALL=C
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export LC_ALL PATH

rifiuta() {
  printf 'rilascia: comando non consentito (atteso: rilascia <production|staging> <hash> [--migrazioni])\n' >&2
  exit 64
}

# 1. Comando: solo minuscole, cifre, trattino e spazi singoli; mai valutato da una shell.
cmd=${SSH_ORIGINAL_COMMAND-}
[ -n "$cmd" ] || rifiuta
case $cmd in
  *[!abcdefghijklmnopqrstuvwxyz0123456789' '-]* | ' '* | *' ' | *'  '*) rifiuta ;;
esac
set -f
# shellcheck disable=SC2086
set -- $cmd
set +f
{ [ $# -eq 3 ] || [ $# -eq 4 ]; } && [ "$1" = rilascia ] || rifiuta
AMB=$2
HASH=$3
MIGR=0
case $AMB in production | staging) ;; *) rifiuta ;; esac
case $HASH in *[!0123456789abcdef]*) rifiuta ;; esac
[ ${#HASH} -eq 40 ] || rifiuta
if [ $# -eq 4 ]; then
  [ "$4" = --migrazioni ] || rifiuta
  MIGR=1
fi

RADICE=${AMORIS_RADICE:-/opt/amoris}
BASE=$RADICE/rilasci/$AMB
SEGRETI=$RADICE/segreti/$AMB.env
INIZIO=$(date +%s)
FASE=blocco
ESITO=errore
CFG=
TMP=
REG=
REGNOME=
RIL=
RESIDUI_KO=
WD=
# Attesa massima delle letture da stdin (30 s); la riga di authorized_keys può ridurla solo per le prove.
ATTESA=${AMORIS_ATTESA_LETTURE:-30}
case $ATTESA in '' | *[!0123456789]* | 0*) ATTESA=30 ;; esac
[ ${#ATTESA} -le 3 ] || ATTESA=30

# Chiude sempre il registro di Docker e cancella i temporanei, anche su errore o segnale.
chiudi_registro() {
  if [ -n "$CFG" ]; then
    DOCKER_CONFIG=$CFG docker logout ghcr.io >/dev/null 2>&1 </dev/null
    rm -rf "$CFG"
    CFG=
    unset DOCKER_CONFIG
  fi
}
# Se il rilascio fallisce, la cartella dello stesso hash messa da parte torna al suo posto (basta che «vecchio» esista).
ripristina() {
  if [ "$ESITO" != ok ] && [ -n "$RIL" ] && [ -n "$TMP" ] &&
    { [ -e "$TMP/vecchio" ] || [ -L "$TMP/vecchio" ]; }; then
    rm -rf "$RIL"
    # Se lo spostamento fallisce, la cartella temporanea resta e il rilascio successivo la rimette.
    if ! mv "$TMP/vecchio" "$RIL"; then
      printf 'rilascia: ripristino di %s non riuscito, lasciato in %s\n' "${RIL##*/}" "${TMP##*/}" >&2
      TMP=
    fi
  fi
}
# Esce con una sola riga JSON sull'uscita standard.
fine() {
  rc=$?
  trap '' HUP INT TERM
  trap - EXIT
  # Una scadenza o un segnale durante la lettura delle credenziali lascia il motivo nel registro (nessun valore letto).
  if [ "$FASE" = credenziali ] && [ "$rc" -eq 143 ] && [ -n "$REG" ]; then
    printf 'rilascia: lettura delle credenziali interrotta o scaduta (limite %s s)\n' "$ATTESA" >&2
  fi
  [ -z "$WD" ] || kill "$WD" 2>/dev/null
  chiudi_registro
  ripristina
  [ -z "$TMP" ] || rm -rf "$TMP"
  dur=$(($(date +%s) - INIZIO))
  reg=
  [ -z "$REGNOME" ] || reg=$(printf ',"registro":"%s"' "$REGNOME")
  if [ "$ESITO" = ok ]; then
    printf '{"esito":"ok","ambiente":"%s","hash":"%s","migrazioni":%s,"durata_s":%s%s}\n' \
      "$AMB" "$HASH" "$([ $MIGR -eq 1 ] && echo true || echo false)" "$dur" "$reg"
  else
    [ $rc -ne 0 ] || rc=1
    printf '{"esito":"errore","ambiente":"%s","hash":"%s","fase":"%s","migrazioni":%s,"durata_s":%s%s}\n' \
      "$AMB" "$HASH" "$FASE" "$([ $MIGR -eq 1 ] && echo true || echo false)" "$dur" "$reg"
  fi
  exit $rc
}
trap fine EXIT
trap 'exit 143' HUP INT TERM

# Dopo il blocco l'errore standard è il registro sul server; prima è quello della sessione.
ko() {
  printf 'rilascia: %s\n' "$*" >&2
  exit 1
}

# Compose dell'ambiente: l'ultimo --env-file prevale; tutta l'uscita di docker va nel registro.
dc() {
  docker compose -f "$RIL/infra/deploy/compose.yml" --env-file "$SEGRETI" --env-file "$RIL/rilascio.env" "$@" >>"$REG" 2>&1 </dev/null
}

# Blocco per ambiente: un secondo rilascio in corso è un errore.
# Le cartelle create qui sono 0700 (umask 077 solo per questo mkdir); quelle già presenti non cambiano.
(umask 077 && mkdir -p "$BASE") || ko "cartella dei rilasci non scrivibile"
exec 9>"$BASE/.blocco"
flock -n 9 || ko "un altro rilascio di $AMB è in corso"

# Residui di rilasci interrotti: solo di questo ambiente, a blocco preso.
for residuo in "$BASE"/.tmp.*; do
  # Un SIGKILL fra i due mv lascia la cartella dell'hash in «vecchio»: se manca, torna al suo posto.
  if [ -e "$residuo/vecchio" ] || [ -L "$residuo/vecchio" ]; then
    h=$(cat "$residuo/hash" 2>/dev/null)
    case $h in *[!0123456789abcdef]*) h= ;; esac
    if [ ${#h} -eq 40 ] && [ ! -e "$BASE/$h" ] && [ ! -L "$BASE/$h" ]; then
      # Se lo spostamento fallisce il residuo resta com'è, con il caso nel registro del rilascio.
      if ! mv "$residuo/vecchio" "$BASE/$h"; then
        RESIDUI_KO="$RESIDUI_KO ${residuo##*/}"
        continue
      fi
    fi
  fi
  if [ -e "$residuo" ] || [ -L "$residuo" ]; then rm -rf "$residuo"; fi
done
for residuo in "$BASE"/.corrente.* "${TMPDIR:-/tmp}/amoris-docker-$AMB".*; do
  if [ -e "$residuo" ] || [ -L "$residuo" ]; then rm -rf "$residuo"; fi
done

# Registro di questo tentativo (DR-422): cartella 700, file 600; da qui in poi l'errore standard è il file.
mkdir -p "$BASE/registri" && chmod 700 "$BASE/registri" || ko "cartella dei registri non creabile"
nome=$(date -u +%Y%m%dT%H%M%SZ)-$HASH.log
(umask 077 && : >>"$BASE/registri/$nome") && chmod 600 "$BASE/registri/$nome" || ko "registro non creabile"
REG=$BASE/registri/$nome
REGNOME=$nome
exec 2>>"$REG"
for residuo in $RESIDUI_KO; do
  printf 'rilascia: ripristino del residuo %s non riuscito, lasciato dov è\n' "$residuo" >&2
done

# 2. Credenziali dalle prime due righe dell'ingresso.
FASE=credenziali
# Sorvegliante: allo scadere ferma lo script con TERM (JSON d'errore e blocco rilasciato); non tiene né il blocco né i canali.
PADRE=$$
(
  SP=
  FERMA=0
  trap 'FERMA=1; [ -z "${SP:-}" ] || kill "$SP" 2>/dev/null' TERM
  sleep "$ATTESA" &
  SP=$!
  # Un TERM arrivato prima di SP=$! si riconosce dal flag: lo sleep non resta mai orfano.
  [ "$FERMA" -eq 0 ] || { kill "$SP" 2>/dev/null; exit 0; }
  wait "$SP"
  [ "$FERMA" -eq 0 ] || { kill "$SP" 2>/dev/null; exit 0; }
  kill -TERM "$PADRE"
) >/dev/null 2>&1 </dev/null 9>&- &
WD=$!
IFS= read -r UTENTE || ko "manca l'utente GitHub"
IFS= read -r TOKEN || [ -n "$TOKEN" ] || ko "manca il token del registro"
kill "$WD" 2>/dev/null
WD=
case $UTENTE in
  '' | -* | *[!ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-]*) ko "utente GitHub non valido" ;;
esac
[ ${#UTENTE} -le 39 ] || ko "utente GitHub non valido"
[ -n "$TOKEN" ] || ko "token del registro vuoto"

# File dei segreti dell'ambiente: letto, mai stampato.
FASE=configurazione
[ -r "$SEGRETI" ] || ko "file dei segreti assente: $SEGRETI"
valore() {
  sed -n "s/^$1=//p" "$SEGRETI" | tr -d '\r' | tail -n 1 | sed "s/^\"\(.*\)\"\$/\1/;s/^'\(.*\)'\$/\1/"
}
# Percorso assoluto fuori dalle cartelle dei rilasci (che si ricreano a ogni rilascio); il file può non esistere ancora.
percorso_esterno() {
  case $2 in
    '') ko "$1 assente dal file dei segreti" ;;
    /*) ;;
    *) ko "$1 deve essere un percorso assoluto" ;;
  esac
  case $2 in
    */./* | */. | */../* | */.. | *//*) ko "$1 non valido" ;;
    *[!ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._/+@-]*) ko "$1 contiene caratteri non ammessi" ;;
    "$RADICE/rilasci" | "$RADICE/rilasci/"*) ko "$1 non può stare sotto le cartelle dei rilasci" ;;
  esac
}
amb_file=$(valore AMORIS_ENV)
[ -z "$amb_file" ] || [ "$amb_file" = "$AMB" ] || ko "AMORIS_ENV del file dei segreti non è $AMB"
case $(valore IMAGE_PREFIX) in ghcr.io/*) ;; *) ko "IMAGE_PREFIX deve cominciare con ghcr.io/" ;; esac
INGRESS_SUBNET=$(valore INGRESS_SUBNET)
[ -n "$INGRESS_SUBNET" ] || ko "INGRESS_SUBNET assente dal file dei segreti"
case $INGRESS_SUBNET in *[!0123456789abcdefABCDEF.:/]*) ko "INGRESS_SUBNET non valida" ;; esac
percorso_esterno BACKUP_SSH_KEY_PATH "$(valore BACKUP_SSH_KEY_PATH)"
percorso_esterno BACKUP_KNOWN_HOSTS_PATH "$(valore BACKUP_KNOWN_HOSTS_PATH)"

# 3. Archivio: salvato, controllato voce per voce, estratto in una cartella temporanea.
FASE=archivio
TMP=$(mktemp -d "$BASE/.tmp.XXXXXX") || ko "cartella temporanea non creabile"
MAX=$((100 * 1024 * 1024))
MAXDEC=$((200 * 1024 * 1024))
MAXVOCI=20000
head -c $((MAX + 1)) >"$TMP/archivio.tgz"
[ "$(wc -c <"$TMP/archivio.tgz")" -le $MAX ] || ko "archivio troppo grande"
# Tetto sui byte decompressi, misurato senza scriverli su disco.
[ "$(gzip -dc <"$TMP/archivio.tgz" 2>/dev/null | head -c $((MAXDEC + 1)) | wc -c)" -le $MAXDEC ] ||
  ko "archivio decompresso troppo grande"
tar --quoting-style=escape -tzf "$TMP/archivio.tgz" 2>/dev/null | head -n $((MAXVOCI + 1)) >"$TMP/nomi"
tar --quoting-style=escape -tvzf "$TMP/archivio.tgz" 2>/dev/null | head -n $((MAXVOCI + 1)) | cut -c1 >"$TMP/tipi"
[ -s "$TMP/nomi" ] || ko "archivio vuoto o non leggibile"
[ "$(wc -l <"$TMP/nomi")" -le $MAXVOCI ] || ko "archivio con troppe voci"
[ "$(wc -l <"$TMP/nomi")" -eq "$(wc -l <"$TMP/tipi")" ] || ko "archivio non leggibile"
while IFS= read -r tipo; do
  case $tipo in - | d) ;; *) ko "voce dell'archivio non ammessa (solo file e cartelle)" ;; esac
done <"$TMP/tipi"
while IFS= read -r nome; do
  case $nome in
    '' | /* | *//* | . | ./* | */./* | */. | .. | ../* | */../* | */..) ko "percorso non ammesso nell'archivio" ;;
    *[!ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._/+@=,-]*) ko "percorso non ammesso nell'archivio" ;;
    infra | infra/*) ;;
    *) ko "voce fuori da infra/ nell'archivio" ;;
  esac
done <"$TMP/nomi"
mkdir "$TMP/x" || ko "cartella temporanea non creabile"
tar -xzf "$TMP/archivio.tgz" -C "$TMP/x" --no-same-owner --no-same-permissions || ko "estrazione fallita"
[ -f "$TMP/x/infra/deploy/compose.yml" ] || ko "l'archivio non contiene infra/deploy/compose.yml"
printf 'AMORIS_ENV=%s\nIMAGE_TAG=%s\n' "$AMB" "$HASH" >"$TMP/x/rilascio.env" || ko "rilascio.env non scrivibile"

# 4. L'ingresso comune si installa da handoff: qui si controlla che la sua rete esista e abbia la sola sottorete attesa (N4).
FASE=rete
sottoreti=$(docker network inspect -f '{{range .IPAM.Config}}{{.Subnet}} {{end}}' "amoris-ingresso-$AMB" </dev/null) ||
  ko "rete amoris-ingresso-$AMB assente: installare prima l'ingresso comune"
[ "$sottoreti" = "$INGRESS_SUBNET " ] ||
  ko "la rete amoris-ingresso-$AMB non ha come unica sottorete INGRESS_SUBNET del file dei segreti"

# 5. Solo ora si tocca la cartella del rilascio: quella dello stesso hash resta da parte fino a rilascio riuscito (N13).
FASE=archivio
RIL=$BASE/$HASH
printf '%s\n' "$HASH" >"$TMP/hash" || ko "cartella temporanea non scrivibile"
if [ -e "$RIL" ] || [ -L "$RIL" ]; then
  mv "$RIL" "$TMP/vecchio" || ko "cartella del rilascio non sostituibile"
fi
mv "$TMP/x" "$RIL" || ko "cartella del rilascio non creabile"

# 6. Login con il token solo sull'ingresso standard di docker, in una configurazione temporanea per ambiente.
FASE=login
CFG=$(mktemp -d "${TMPDIR:-/tmp}/amoris-docker-$AMB.XXXXXX") || ko "configurazione di docker non creabile"
chmod 700 "$CFG"
DOCKER_CONFIG=$CFG
export DOCKER_CONFIG
docker compose version >>"$REG" 2>&1 </dev/null ||
  ko "plugin docker compose non trovato con la configurazione temporanea: va installato a livello di sistema, non in ~/.docker"
printf '%s' "$TOKEN" | docker login ghcr.io -u "$UTENTE" --password-stdin >>"$REG" 2>&1 || ko "login al registro fallito"

# 7. Pull di tutte le immagini del progetto (anche dei profili release e backup), poi il token non serve più.
FASE=pull
dc --profile backup --profile release pull || ko "pull delle immagini fallito"
TOKEN=
chiudi_registro

# 8. Migrazioni solo su richiesta.
if [ $MIGR -eq 1 ]; then
  FASE=migrazioni
  dc --profile release run --rm migrate || ko "migrazioni fallite"
fi

# 9. Avvio dei servizi predefiniti: niente down, niente --remove-orphans.
FASE=avvio
dc up -d --wait --wait-timeout 600 --pull never || ko "avvio dei servizi fallito"

# 10. Il collegamento «corrente» si sposta in modo atomico solo a rilascio riuscito.
FASE=collegamento
rm -f "$BASE/.corrente.$$"
ln -s "$HASH" "$BASE/.corrente.$$" && mv -T "$BASE/.corrente.$$" "$BASE/corrente" || ko "collegamento corrente non aggiornabile"
ESITO=ok
