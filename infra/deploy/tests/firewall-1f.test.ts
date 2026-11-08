import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Regole DOCKER-USER di `backup-out` (1F-W4 T6i, rilievo R13).
 *
 * Prova comportamentale in un contenitore Linux con privilegi di rete: dentro, il contenitore fa da
 * «host Docker» (ip_forward, FORWARD che salta in DOCKER-USER come fa Docker) e quattro spazi di rete
 * (`ip netns`) fanno da backup, Storage Box, «altro» e DNS. Lo script si lancia come sull'host.
 *
 * **Nessun dato reale**: indirizzi di documentazione (RFC 5737, RFC 3849) e nomi `.invalid`.
 */

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const scriptPath = path.join(repoRoot, 'infra', 'deploy', 'firewall', 'backup-out.sh');

// Stessa immagine del backup (già fissata per digest nel repository): ha apk per installare gli strumenti.
const IMAGE =
  'postgres:17.11-alpine@sha256:562a6e0a66b5136bc28bef5944bbc2ddddf8ea0058d4016b96cee63f2edaf143';
const NAME = `amoris-fw-prova-${process.pid}`;

const SUBNET = '10.77.86.0/24';
const BRIDGE = 'vb-h';
const SB_HOST = 'storagebox.esempio.invalid';
const SB_IP = '198.51.100.10';
const OTHER_IP = '203.0.113.10';
const OTHER_IP6 = '2001:db8:113::10';
const DNS_IP = '192.0.2.53';
const CHAIN = 'AMORIS-BACKUP-OUT';

interface Result {
  readonly status: number | null;
  readonly out: string;
}

const dockerRun = (args: readonly string[], timeout = 120_000): Result => {
  const r = spawnSync('docker', args, { encoding: 'utf8', timeout });
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
};

const sh = (script: string, env: Readonly<Record<string, string>> = {}): Result =>
  dockerRun([
    'exec',
    ...Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
    NAME,
    'sh',
    '-c',
    script,
  ]);

/** Lancia lo script come root sull'«host»; di base la Storage Box è nominata e il DNS è quello di prova. */
const run = (args: readonly string[] = [], env: Readonly<Record<string, string>> = {}): Result =>
  sh(`sh /tmp/backup-out.sh ${args.join(' ')}`, {
    BACKUP_SFTP_HOST: SB_HOST,
    BACKUP_OUT_SUBNET: SUBNET,
    BACKUP_OUT_BRIDGE: BRIDGE,
    BACKUP_OUT_DNS: DNS_IP,
    ...env,
  });

/** Il backup (spazio `bk`) prova a collegarsi: true se il servizio risponde. */
const reach = (ip: string, port: number, v6 = false): boolean => {
  const target = v6 ? `TCP6:[${ip}]:${port}` : `TCP:${ip}:${port}`;
  const r = sh(`ip netns exec bk socat -T3 - ${target},connect-timeout=2 </dev/null | grep -q ok`);
  return r.status === 0;
};

const chainRules = (): string => sh(`iptables -S ${CHAIN}`).out;
const dockerUser = (): string => sh('iptables -S DOCKER-USER').out;

const TOPOLOGY = `
set -e
mk() { ns=$1; h=$2; hip=$3; nip=$4; h6=$5; n6=$6
  ip netns add $ns
  ip link add $h type veth peer name eth0 netns $ns
  ip addr add $hip/24 dev $h; ip link set $h up
  ip addr add $h6::1/64 dev $h nodad
  ip netns exec $ns ip link set lo up
  ip netns exec $ns ip addr add $nip/24 dev eth0
  ip netns exec $ns ip addr add $n6/64 dev eth0 nodad
  ip netns exec $ns ip link set eth0 up
  ip netns exec $ns ip route add default via $hip
  ip netns exec $ns ip -6 route add default via $h6::1
}
mk bk vb-h 10.77.86.1 10.77.86.2 2001:db8:86 2001:db8:86::2
mk sb vs-h 198.51.100.1 ${SB_IP} 2001:db8:100 2001:db8:100::10
mk ot vo-h 203.0.113.1 ${OTHER_IP} 2001:db8:113 ${OTHER_IP6}
mk dn vd-h 192.0.2.1 ${DNS_IP} 2001:db8:2 2001:db8:2::53
sysctl -qw net.ipv4.ip_forward=1 net.ipv6.conf.all.forwarding=1
for t in iptables ip6tables; do
  $t -N DOCKER-USER; $t -A DOCKER-USER -j RETURN; $t -I FORWARD -j DOCKER-USER
done
echo '${SB_IP} ${SB_HOST}' >> /etc/hosts
srv() { ip netns exec $1 socat $2-LISTEN:$3,fork,reuseaddr SYSTEM:'echo ok' >/dev/null 2>&1 & }
srv sb TCP 23; srv sb TCP 443
srv ot TCP 23; srv ot TCP 443; srv ot TCP 53
srv dn TCP 53
ip netns exec ot socat TCP6-LISTEN:443,fork,reuseaddr,ipv6-v6only=1 SYSTEM:'echo ok' >/dev/null 2>&1 &
sleep 3
`;

/** Riporta l'«host» allo stato iniziale: nessuna catena, nessun salto. */
const RESET = `
for t in iptables ip6tables; do
  while $t -D DOCKER-USER -j ${CHAIN} 2>/dev/null; do :; done
  $t -F ${CHAIN} 2>/dev/null || true
  $t -X ${CHAIN} 2>/dev/null || true
done
`;

beforeAll(() => {
  const start = dockerRun([
    'run',
    '-d',
    '--name',
    NAME,
    '--privileged',
    '--entrypoint',
    'sh',
    IMAGE,
    '-c',
    'sleep 3600',
  ]);
  expect(start.status, start.out).toBe(0);
  const apk = sh('apk add --no-cache iptables iproute2 socat >/dev/null 2>&1; echo $?');
  expect(apk.out.trim(), apk.out).toBe('0');
  const cp = dockerRun(['cp', scriptPath, `${NAME}:/tmp/backup-out.sh`]);
  expect(cp.status, cp.out).toBe(0);
  const topo = dockerRun(['exec', NAME, 'sh', '-c', TOPOLOGY], 60_000);
  expect(topo.status, topo.out).toBe(0);
}, 600_000);

afterAll(() => {
  dockerRun(['rm', '-f', '-v', NAME]);
});

describe('regole DOCKER-USER di backup-out (R13)', () => {
  it('lo script ha il fine riga LF e parte con #!/bin/sh', () => {
    const text = readFileSync(scriptPath, 'utf8');
    expect(text.startsWith('#!/bin/sh\n')).toBe(true);
    expect(text).not.toContain('\r');
  });

  it('sanità: senza regole il backup raggiunge tutto, anche per IPv6', () => {
    expect(reach(SB_IP, 23)).toBe(true);
    expect(reach(SB_IP, 443)).toBe(true);
    expect(reach(OTHER_IP, 23)).toBe(true);
    expect(reach(OTHER_IP, 443)).toBe(true);
    expect(reach(OTHER_IP, 53)).toBe(true);
    expect(reach(DNS_IP, 53)).toBe(true);
    expect(reach(OTHER_IP6, 443, true)).toBe(true);
  });

  it('--check prima delle regole dice che mancano', () => {
    const r = run(['--check']);
    expect(r.status, r.out).toBe(1);
    expect(r.out).toContain('DIFFERENZA');
  });

  it('dopo lo script il backup esce solo verso la Storage Box sulla 23 e verso il DNS', () => {
    const r = run();
    expect(r.status, r.out).toBe(0);
    expect(reach(SB_IP, 23)).toBe(true);
    expect(reach(DNS_IP, 53)).toBe(true);
    expect(reach(SB_IP, 443)).toBe(false);
    expect(reach(OTHER_IP, 23)).toBe(false);
    expect(reach(OTHER_IP, 443)).toBe(false);
    expect(reach(OTHER_IP, 53)).toBe(false);
    expect(reach(OTHER_IP6, 443, true)).toBe(false);
  });

  it('le regole scritte sono quelle attese, con un solo salto in testa a DOCKER-USER', () => {
    const rules = chainRules().trim().split('\n');
    expect(rules).toEqual([
      `-N ${CHAIN}`,
      `-A ${CHAIN} -s ${SUBNET} -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN`,
      `-A ${CHAIN} -s ${SUBNET} -d ${SB_IP}/32 -p tcp -m tcp --dport 23 -j RETURN`,
      `-A ${CHAIN} -s ${SUBNET} -d ${DNS_IP}/32 -p udp -m udp --dport 53 -j RETURN`,
      `-A ${CHAIN} -s ${SUBNET} -d ${DNS_IP}/32 -p tcp -m tcp --dport 53 -j RETURN`,
      `-A ${CHAIN} -s ${SUBNET} -j REJECT --reject-with icmp-port-unreachable`,
    ]);
    expect(dockerUser().trim().split('\n')).toEqual([
      '-N DOCKER-USER',
      `-A DOCKER-USER -j ${CHAIN}`,
      '-A DOCKER-USER -j RETURN',
    ]);
    const v6 = sh(`ip6tables -S ${CHAIN}`).out.trim().split('\n');
    expect(v6).toEqual([
      `-N ${CHAIN}`,
      `-A ${CHAIN} -i ${BRIDGE} -j REJECT --reject-with icmp6-port-unreachable`,
    ]);
  });

  it('--check dopo lo script dice che le regole ci sono', () => {
    const r = run(['--check']);
    expect(r.status, r.out).toBe(0);
  });

  it('rilanciare lo script non duplica regole né il salto', () => {
    const before = `${chainRules()}${dockerUser()}${sh('ip6tables -S').out}`;
    expect(run().status).toBe(0);
    expect(run().status).toBe(0);
    expect(`${chainRules()}${dockerUser()}${sh('ip6tables -S').out}`).toBe(before);
  });

  it('non tocca le altre regole di DOCKER-USER', () => {
    sh('iptables -A DOCKER-USER -s 192.0.2.0/24 -j DROP');
    expect(run().status).toBe(0);
    const lines = dockerUser().trim().split('\n');
    expect(lines).toContain('-A DOCKER-USER -s 192.0.2.0/24 -j DROP');
    expect(lines.filter((l) => l.includes(CHAIN))).toHaveLength(1);
    sh('iptables -D DOCKER-USER -s 192.0.2.0/24 -j DROP');
  });

  it('--check vede una regola tolta o aggiunta, e lo script le ripara', () => {
    sh(`iptables -D ${CHAIN} 2`);
    const missing = run(['--check']);
    expect(missing.status).toBe(1);
    expect(missing.out).toContain('assente');
    expect(run().status).toBe(0);
    expect(run(['--check']).status).toBe(0);

    sh(`iptables -I ${CHAIN} 1 -s ${SUBNET} -d ${OTHER_IP} -j RETURN`);
    const extra = run(['--check']);
    expect(extra.status).toBe(1);
    expect(extra.out).toContain('regole presenti');
    expect(reach(OTHER_IP, 443)).toBe(true);
    expect(run().status).toBe(0);
    expect(reach(OTHER_IP, 443)).toBe(false);
  });

  it('la porta della Storage Box è quella configurata', () => {
    expect(run([], { BACKUP_SFTP_PORT: '443' }).status).toBe(0);
    expect(reach(SB_IP, 443)).toBe(true);
    expect(reach(SB_IP, 23)).toBe(false);
    expect(run().status).toBe(0);
  });

  it('i resolver non locali si leggono da /etc/resolv.conf, senza 127.0.0.11', () => {
    sh(`printf 'nameserver 127.0.0.11\\nnameserver ${DNS_IP}\\n' > /etc/resolv.conf`);
    const r = run([], { BACKUP_OUT_DNS: '' });
    expect(r.status, r.out).toBe(0);
    const rules = chainRules();
    expect(rules).toContain(`-d ${DNS_IP}/32 -p udp -m udp --dport 53`);
    expect(rules).not.toContain('127.');
    // Un resolver che rifiuta subito: le prove sui nomi non risolti non aspettano i timeout del DNS.
    sh("printf 'nameserver 127.0.0.1\\noptions timeout:1 attempts:1\\n' > /etc/resolv.conf");
  });

  it('con la Storage Box data per indirizzo il DNS non è consentito', () => {
    expect(run(['--ip', SB_IP], { BACKUP_SFTP_HOST: '' }).status).toBe(0);
    expect(chainRules()).not.toContain('--dport 53');
    expect(reach(SB_IP, 23)).toBe(true);
    expect(reach(DNS_IP, 53)).toBe(false);
    expect(run().status).toBe(0);
  });

  it('se il nome non si risolve esce con 2 e, senza regole precedenti, rifiuta tutto', () => {
    sh(RESET);
    const r = run([], { BACKUP_SFTP_HOST: 'non-esiste.esempio.invalid' });
    expect(r.status, r.out).toBe(2);
    expect(reach(SB_IP, 23)).toBe(false);
    expect(reach(DNS_IP, 53)).toBe(false);
    expect(reach(OTHER_IP, 443)).toBe(false);
    expect(reach(OTHER_IP6, 443, true)).toBe(false);
    expect(run(['--check'], { BACKUP_SFTP_HOST: 'non-esiste.esempio.invalid' }).status).toBe(2);
  });

  it('se manca la variabile della Storage Box esce con 2 e resta tutto rifiutato', () => {
    sh(RESET);
    const r = run([], { BACKUP_SFTP_HOST: '' });
    expect(r.status, r.out).toBe(2);
    expect(r.out).toContain('BACKUP_SFTP_HOST');
    expect(reach(SB_IP, 23)).toBe(false);
    expect(reach(OTHER_IP, 443)).toBe(false);
  });

  it('con regole precedenti buone un nome che non si risolve le lascia invariate', () => {
    expect(run().status).toBe(0);
    const before = chainRules();
    const r = run([], { BACKUP_SFTP_HOST: 'non-esiste.esempio.invalid' });
    expect(r.status, r.out).toBe(2);
    expect(chainRules()).toBe(before);
    expect(reach(SB_IP, 23)).toBe(true);
    expect(reach(OTHER_IP, 23)).toBe(false);
  });

  it('rifiuta i valori che non sono quelli attesi, senza toccare le regole', () => {
    const before = chainRules();
    expect(run([], { BACKUP_SFTP_PORT: '23; reboot' }).status).toBe(64);
    expect(run(['--subnet', "'10.0.0.0/8 -j ACCEPT'"]).status).toBe(64);
    expect(run(['--dns', "'x;y'"]).status).toBe(64);
    expect(chainRules()).toBe(before);
  });

  it('con --env-file legge i valori senza eseguire il file', () => {
    sh(RESET);
    sh(
      `printf 'BACKUP_SFTP_HOST=${SB_HOST}\\nBACKUP_SFTP_PORT=23\\n$(touch /tmp/eseguito)\\n' > /tmp/prova.env`,
    );
    const r = sh(`sh /tmp/backup-out.sh --env-file /tmp/prova.env`, {
      BACKUP_OUT_SUBNET: SUBNET,
      BACKUP_OUT_BRIDGE: BRIDGE,
      BACKUP_OUT_DNS: DNS_IP,
    });
    expect(r.status, r.out).toBe(0);
    expect(sh('test -e /tmp/eseguito').status).toBe(1);
    expect(reach(SB_IP, 23)).toBe(true);
    expect(reach(OTHER_IP, 23)).toBe(false);
  });
});
