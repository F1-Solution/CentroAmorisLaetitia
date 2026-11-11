#!/bin/sh
# Regole della catena DOCKER-USER per la rete `backup-out` (1F-W4 T6i, rilievo R13); si lancia da root sull'host.
#
# Uso: backup-out.sh [--check] [--env production|staging] [--env-file FILE] [--host NOME] [--port N] [--ip ADDR]... [--dns ADDR]...
#                    [--subnet CIDR] [--bridge NOME] [--ipv6-subnet CIDR]
#
# Che cosa fa: la rete esce solo verso la Storage Box (TCP, porta BACKUP_SFTP_PORT) e verso i resolver
# DNS dell'host (porta 53, solo se BACKUP_SFTP_HOST è un nome); il resto è rifiutato.
# Il DNS serve: il resolver integrato di Docker (127.0.0.11) inoltra le richieste esterne dallo spazio di
# rete del contenitore, quindi passano dalla catena FORWARD con la sottorete di `backup-out` come origine.
#
# Per ambiente (DR-412): produzione e staging hanno ciascuno la propria catena (AMORIS-BKP-OUT-PRODUCTION o
# AMORIS-BKP-OUT-STAGING), la propria sottorete e il proprio bridge; si lancia una volta per ambiente e ogni
# applicazione tocca solo la catena e il salto del proprio ambiente. Senza ambiente valido esce con 64.
#
# Idempotente: la catena è riscritta in una sola operazione atomica, senza istanti
# aperti, con un solo salto da DOCKER-USER; le altre regole non si toccano.
# Fallisce chiuso: se la Storage Box o il DNS non si risolvono esce con 2 e non lascia la rete aperta
# (nessuna regola precedente: tutto rifiutato; regole precedenti: restano, sono già restrittive).
# Con --check non modifica nulla (e guarda solo il proprio ambiente): esce con 0 se le regole attese ci sono
# tutte, con 1 se ne manca o ne avanza qualcuna, con 2 se non riesce a calcolarle.
#
# Valori da ambiente o da --env-file (solo le righe CHIAVE=valore, mai eseguito): AMORIS_ENV (production o
# staging), BACKUP_SFTP_HOST, BACKUP_SFTP_PORT (23), BACKUP_OUT_SUBNET e BACKUP_OUT_BRIDGE (senza predefiniti:
# 10.77.86.0/24 e amoris-bkp-prod in produzione, 10.77.87.0/24 e amoris-bkp-stag in staging),
# BACKUP_OUT_SUBNET6 (vuoto: la rete è solo IPv4), BACKUP_OUT_DNS (vuoto: dai resolver dell'host).
# I flag prevalgono su tutto. Fuori dalla sottorete non cambia nulla.
set -eu

CHAIN=
CHECK=0
ENV_FILE=
FLAG_ENV=
FLAG_HOST=
FLAG_PORT=
FLAG_SUBNET=
FLAG_BRIDGE=
FLAG_SUBNET6=
FLAG_IPS=
FLAG_DNS=

die() {
  printf 'backup-out: %s\n' "$*" >&2
  exit "${DIE_CODE:-64}"
}

need_value() { [ "$1" -ge 2 ] || die "manca il valore di $2"; }

while [ $# -gt 0 ]; do
  case $1 in
    --check) CHECK=1 ;;
    --env) need_value $# "$1"; FLAG_ENV=$2; shift ;;
    --env-file) need_value $# "$1"; ENV_FILE=$2; shift ;;
    --host) need_value $# "$1"; FLAG_HOST=$2; shift ;;
    --port) need_value $# "$1"; FLAG_PORT=$2; shift ;;
    --subnet) need_value $# "$1"; FLAG_SUBNET=$2; shift ;;
    --bridge) need_value $# "$1"; FLAG_BRIDGE=$2; shift ;;
    --ipv6-subnet) need_value $# "$1"; FLAG_SUBNET6=$2; shift ;;
    --ip) need_value $# "$1"; FLAG_IPS="$FLAG_IPS $2"; shift ;;
    --dns) need_value $# "$1"; FLAG_DNS="$FLAG_DNS $2"; shift ;;
    -h | --help) sed -n '2,27p' "$0"; exit 0 ;;
    *) die "argomento sconosciuto: $1" ;;
  esac
  shift
done

AMORIS_ENV_NAME=${AMORIS_ENV:-}
HOST=${BACKUP_SFTP_HOST:-}
PORT=${BACKUP_SFTP_PORT:-23}
SUBNET=${BACKUP_OUT_SUBNET:-}
BRIDGE=${BACKUP_OUT_BRIDGE:-}
SUBNET6=${BACKUP_OUT_SUBNET6:-}
DNS_LIST=${BACKUP_OUT_DNS:-}

# Legge una chiave dal file d'ambiente senza eseguirlo; l'ultima riga vince, le virgolette si tolgono.
env_value() {
  sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1 | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/"
}
if [ -n "$ENV_FILE" ]; then
  [ -r "$ENV_FILE" ] || die "file d'ambiente illeggibile: $ENV_FILE"
  v=$(env_value AMORIS_ENV); [ -z "$v" ] || AMORIS_ENV_NAME=$v
  v=$(env_value BACKUP_SFTP_HOST); [ -z "$v" ] || HOST=$v
  v=$(env_value BACKUP_SFTP_PORT); [ -z "$v" ] || PORT=$v
  v=$(env_value BACKUP_OUT_SUBNET); [ -z "$v" ] || SUBNET=$v
  v=$(env_value BACKUP_OUT_BRIDGE); [ -z "$v" ] || BRIDGE=$v
  v=$(env_value BACKUP_OUT_SUBNET6); [ -z "$v" ] || SUBNET6=$v
  v=$(env_value BACKUP_OUT_DNS); [ -z "$v" ] || DNS_LIST=$v
fi
[ -z "$FLAG_ENV" ] || AMORIS_ENV_NAME=$FLAG_ENV
[ -z "$FLAG_HOST" ] || HOST=$FLAG_HOST
[ -z "$FLAG_PORT" ] || PORT=$FLAG_PORT
[ -z "$FLAG_SUBNET" ] || SUBNET=$FLAG_SUBNET
[ -z "$FLAG_BRIDGE" ] || BRIDGE=$FLAG_BRIDGE
[ -z "$FLAG_SUBNET6" ] || SUBNET6=$FLAG_SUBNET6
[ -z "$FLAG_DNS" ] || DNS_LIST=$FLAG_DNS
IPS=$FLAG_IPS

# L'ambiente sceglie la catena: senza un valore valido non si tocca nulla.
case $AMORIS_ENV_NAME in
  production) CHAIN=AMORIS-BKP-OUT-PRODUCTION ;;
  staging) CHAIN=AMORIS-BKP-OUT-STAGING ;;
  *) die "ambiente mancante o sconosciuto (AMORIS_ENV o --env: production o staging): '$AMORIS_ENV_NAME'" ;;
esac
[ -n "$SUBNET" ] || die 'manca BACKUP_OUT_SUBNET (10.77.86.0/24 in produzione, 10.77.87.0/24 in staging)'
[ -n "$BRIDGE" ] || die 'manca BACKUP_OUT_BRIDGE (amoris-bkp-prod in produzione, amoris-bkp-stag in staging)'

# I valori finiscono nelle regole: si accettano solo i caratteri attesi.
case $PORT in '' | *[!0-9]*) die "porta non valida: $PORT" ;; esac
[ "$PORT" -ge 1 ] && [ "$PORT" -le 65535 ] || die "porta non valida: $PORT"
case $SUBNET in */*) ;; *) die "sottorete non valida: $SUBNET" ;; esac
case $SUBNET in *[!0-9./]*) die "sottorete non valida: $SUBNET" ;; esac
# Prefisso da /16 a /32: una sottorete più ampia rifiuterebbe (o aprirebbe) il traffico di mezza rete.
PREFIX=${SUBNET#*/}
case $PREFIX in '' | *[!0-9]*) die "prefisso della sottorete non valido: $SUBNET" ;; esac
{ [ "$PREFIX" -ge 16 ] && [ "$PREFIX" -le 32 ]; } || die "prefisso della sottorete fuori da /16-/32: $SUBNET"
case $SUBNET6 in *[!0-9a-fA-F:/]*) die "sottorete IPv6 non valida: $SUBNET6" ;; esac
case $BRIDGE in '' | *[!A-Za-z0-9_.-]*) die "nome del bridge non valido: $BRIDGE" ;; esac
[ "${#BRIDGE}" -le 15 ] || die "nome del bridge troppo lungo (massimo 15): $BRIDGE"
case $HOST in *[!A-Za-z0-9.:-]*) die "nome della Storage Box non valido" ;; esac
for a in $IPS $DNS_LIST; do
  case $a in '' | *[!0-9a-fA-F:.]*) die "indirizzo non valido: $a" ;; esac
done

[ "$(id -u)" = 0 ] || die 'servono i privilegi di root'

is_literal() { case $1 in '' | *[!0-9a-fA-F:.]*) return 1 ;; *[.:]*) return 0 ;; *) return 1 ;; esac; }

V4_IPS=
V6_IPS=
DNS4=
DNS6=
NEED_DNS=0

lookup_v4() {
  r=$(getent ahostsv4 "$1" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ') || true
  [ -n "$r" ] || r=$(getent hosts "$1" 2>/dev/null | awk '$1 !~ /:/ {print $1}' | sort -u | tr '\n' ' ') || true
  printf '%s' "$r"
}
lookup_v6() {
  getent ahostsv6 "$1" 2>/dev/null | awk '$1 !~ /^::[fF]{4}:/ {print $1}' | sort -u | tr '\n' ' ' || true
}

# I resolver dell'host, esclusi quelli locali (127.x, ::1) che il contenitore non raggiunge.
host_dns() {
  for f in /etc/resolv.conf /run/systemd/resolve/resolv.conf; do
    [ -r "$f" ] || continue
    r=$(awk '$1 == "nameserver" {print $2}' "$f" | grep -v -e '^127\.' -e '^::1$' | sort -u | tr '\n' ' ') || true
    if [ -n "$r" ]; then printf '%s' "$r"; return 0; fi
  done
  return 0
}

# Calcola gli indirizzi consentiti; ritorna 1 se non può, e allora si resta chiusi.
prepare() {
  if [ -n "$IPS" ]; then
    for a in $IPS; do case $a in *:*) V6_IPS="$V6_IPS $a" ;; *) V4_IPS="$V4_IPS $a" ;; esac; done
  elif [ -z "$HOST" ]; then
    printf 'backup-out: manca BACKUP_SFTP_HOST (o --host, --ip)\n' >&2
    return 1
  elif is_literal "$HOST"; then
    case $HOST in *:*) V6_IPS=$HOST ;; *) V4_IPS=$HOST ;; esac
  else
    V4_IPS=$(lookup_v4 "$HOST")
    [ -z "$SUBNET6" ] || V6_IPS=$(lookup_v6 "$HOST")
  fi
  if [ -z "$V4_IPS" ]; then
    printf 'backup-out: nessun indirizzo IPv4 per la Storage Box\n' >&2
    return 1
  fi
  # Il contenitore risolve il nome da sé: il DNS serve solo se BACKUP_SFTP_HOST non è un indirizzo.
  if [ -n "$HOST" ] && ! is_literal "$HOST"; then NEED_DNS=1; fi
  if [ "$NEED_DNS" = 1 ]; then
    d=${DNS_LIST:-$(host_dns)}
    for a in $d; do case $a in *:*) DNS6="$DNS6 $a" ;; *) DNS4="$DNS4 $a" ;; esac; done
    if [ -z "$DNS4$DNS6" ]; then
      printf 'backup-out: nessun resolver DNS non locale trovato (usare --dns)\n' >&2
      return 1
    fi
  fi
  return 0
}

# Le specifiche delle regole di una famiglia (4 o 6), una per riga, senza `-A catena`.
specs() {
  if [ "$1" = 4 ]; then
    src="-s $SUBNET"; ips=$V4_IPS; dns=$DNS4
  elif [ -n "$SUBNET6" ]; then
    src="-s $SUBNET6"; ips=$V6_IPS; dns=$DNS6
  else
    # Rete solo IPv4: nessun indirizzo da indicare, si rifiuta quanto entra dal bridge.
    printf '%s\n' "-i $BRIDGE -j REJECT"
    return 0
  fi
  printf '%s\n' "$src -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN"
  for ip in $ips; do printf '%s\n' "$src -d $ip -p tcp --dport $PORT -j RETURN"; done
  for ns in $dns; do
    printf '%s\n' "$src -d $ns -p udp --dport 53 -j RETURN"
    printf '%s\n' "$src -d $ns -p tcp --dport 53 -j RETURN"
  done
  printf '%s\n' "$src -j REJECT"
}

ipt_for() { if [ "$1" = 4 ]; then echo iptables; else echo ip6tables; fi; }

have_chain() { "$(ipt_for "$1")" -S DOCKER-USER >/dev/null 2>&1; }

jump_count() { "$(ipt_for "$1")" -S DOCKER-USER 2>/dev/null | grep -c -e "^-A DOCKER-USER -j $CHAIN\$" || true; }

# Riscrive la catena con una sola iptables-restore (atomica) e poi, se manca, aggiunge il salto in testa.
apply() {
  ipt=$(ipt_for "$1")
  {
    echo '*filter'
    echo ":$CHAIN - [0:0]"
    specs "$1" | sed "s/^/-A $CHAIN /"
    echo 'COMMIT'
  } | "${ipt}-restore" --noflush
  if [ "$(jump_count "$1")" = 0 ]; then "$ipt" -I DOCKER-USER 1 -j "$CHAIN"; fi
}

# Confronta le regole presenti con quelle attese; stampa le differenze e ritorna 1 se ce ne sono.
verify() {
  ipt=$(ipt_for "$1")
  bad=0
  n=$(jump_count "$1")
  if [ "$n" != 1 ]; then
    printf 'DIFFERENZA IPv%s: il salto da DOCKER-USER a %s compare %s volte (atteso 1)\n' "$1" "$CHAIN" "$n"
    bad=1
  fi
  if ! "$ipt" -S "$CHAIN" >/dev/null 2>&1; then
    printf 'DIFFERENZA IPv%s: la catena %s non esiste\n' "$1" "$CHAIN"
    return 1
  fi
  want=0
  while IFS= read -r s; do
    want=$((want + 1))
    # shellcheck disable=SC2086
    "$ipt" -C "$CHAIN" $s >/dev/null 2>&1 || { printf 'DIFFERENZA IPv%s: assente: %s\n' "$1" "$s"; bad=1; }
  done <<EOS
$(specs "$1")
EOS
  have=$("$ipt" -S "$CHAIN" | grep -c '^-A ') || true
  if [ "$have" != "$want" ]; then
    printf 'DIFFERENZA IPv%s: %s regole presenti, %s attese\n' "$1" "$have" "$want"
    bad=1
  fi
  return "$bad"
}

families() { if [ -n "$SUBNET6" ] || have_chain 6; then echo '4 6'; else echo 4; fi; }

if prepare; then RESOLVED=1; else RESOLVED=0; fi

if [ "$CHECK" = 1 ]; then
  [ "$RESOLVED" = 1 ] || { printf 'backup-out: impossibile verificare, indirizzi non risolti\n' >&2; exit 2; }
  have_chain 4 || die 'catena DOCKER-USER assente: Docker non è in esecuzione?'
  rc=0
  for f in $(families); do
    if [ "$f" = 6 ] && ! have_chain 6; then continue; fi
    verify "$f" || rc=1
  done
  if [ "$rc" = 0 ]; then echo "backup-out: regole presenti ($SUBNET)"; else echo 'backup-out: regole NON conformi' >&2; fi
  exit "$rc"
fi

have_chain 4 || { DIE_CODE=1; die 'catena DOCKER-USER assente: Docker non è in esecuzione?'; }

# Un ambiente non deve riscrivere la sottorete o il bridge già protetti dalla catena dell'altro.
case $CHAIN in
  AMORIS-BKP-OUT-PRODUCTION) OTHER_CHAIN=AMORIS-BKP-OUT-STAGING ;;
  *) OTHER_CHAIN=AMORIS-BKP-OUT-PRODUCTION ;;
esac
for t in iptables ip6tables; do
  rules=$("$t" -S "$OTHER_CHAIN" 2>/dev/null) || continue
  if printf '%s\n' "$rules" | grep -F -q -e " -s $SUBNET " -e " -i $BRIDGE "; then
    die "la catena $OTHER_CHAIN usa già la sottorete $SUBNET o il bridge $BRIDGE"
  fi
done
DIE_CODE=1

if [ "$RESOLVED" = 0 ]; then
  # Fallire chiuso: se esistono regole precedenti restano, altrimenti si installa il rifiuto totale.
  if [ "$(jump_count 4)" -ge 1 ]; then
    printf 'backup-out: regole precedenti lasciate invariate\n' >&2
  else
    V4_IPS=
    V6_IPS=
    DNS4=
    DNS6=
    for f in $(families); do
      if have_chain "$f"; then apply "$f"; fi
    done
    printf 'backup-out: installato il rifiuto totale per %s\n' "$SUBNET" >&2
  fi
  exit 2
fi

for f in $(families); do
  if have_chain "$f"; then
    apply "$f"
  else
    printf 'backup-out: catena DOCKER-USER IPv%s assente, saltata\n' "$f" >&2
  fi
done
echo "backup-out: regole applicate ($SUBNET -> $V4_IPS porta $PORT)"
