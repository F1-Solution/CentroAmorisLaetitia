import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Lavoro della CI che costruisce e pubblica le immagini (1F-W2 T9, criterio W2-9, DR-356).
 *
 * Letto dal testo di `ci.yml`: parte solo dopo la verifica di un push su `main`, con i permessi
 * minimi; ogni immagine porta l'hash del commit come etichetta e passa il controllo dei file
 * (W2-8) prima della pubblicazione. Nessuna chiave del server nella CI (DR-357: arriva nella W5).
 */

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const ciText = readFileSync(path.join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8').replace(
  /\r\n/g,
  '\n',
);

/** Blocco del lavoro `immagini`: dalle sue righe fino al lavoro successivo o alla fine. */
function imagesJob(): string {
  const start = ciText.indexOf('\n  immagini:\n');
  expect(start, 'lavoro «immagini» assente in ci.yml').toBeGreaterThan(-1);
  const rest = ciText.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[a-z][\w-]*:\n/);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

/** Righe di comando del lavoro, senza i commenti. */
function commands(job: string): string {
  return job
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

describe('ci.yml: lavoro delle immagini', () => {
  it('lascia i permessi del flusso in sola lettura', () => {
    const head = ciText.slice(0, ciText.indexOf('\njobs:'));
    expect(head).toMatch(/\npermissions:\n {2}contents: read\n/);
    expect(head).not.toContain('packages: write');
  });

  it('parte dopo la verifica, solo per un push su main', () => {
    const job = imagesJob();
    expect(job).toMatch(/\n {4}needs: verifica\n/);
    expect(job).toMatch(/\n {4}if: .*github\.event_name == 'push'/);
    expect(job).toMatch(/\n {4}if: .*github\.ref == 'refs\/heads\/main'/);
  });

  it('chiede solo contents: read e packages: write', () => {
    const job = imagesJob();
    const block = /\n {4}permissions:\n((?: {6}.+\n)+)/.exec(job);
    expect(block?.[1]?.trim().split(/\n\s*/).sort()).toEqual(['contents: read', 'packages: write']);
  });

  it('costruisce le cinque immagini dai Dockerfile del repository', () => {
    const job = commands(imagesJob());
    expect(job).toMatch(/app: \[web, admin, api, scrub, backup\]/);
    expect(job).toContain('-f "infra/docker/${APP}.Dockerfile"');
  });

  it('etichetta ogni immagine con l’hash completo del commit, mai latest', () => {
    const job = commands(imagesJob());
    expect(job).toContain('ghcr.io/');
    expect(job).toContain(':${GITHUB_SHA}');
    expect(job).not.toMatch(/latest/);
  });

  it('non chiede a setup-node la cache di pnpm, che in questo lavoro non è installato', () => {
    // setup-node@v5 la attiva da solo leggendo `packageManager` e fallisce senza pnpm (CI 42137609028).
    const lines = commands(imagesJob()).split('\n');
    const start = lines.findIndex((line) => line.includes('uses: actions/setup-node@'));
    expect(start).toBeGreaterThan(-1);
    const next = lines.findIndex((line, index) => index > start && /^\s+- /.test(line));
    const step = lines.slice(start, next === -1 ? undefined : next).map((line) => line.trim());
    expect(step).toContain('package-manager-cache: false');
  });

  it('collega l’immagine al repository privato e al commit', () => {
    const job = commands(imagesJob());
    expect(job).toContain('org.opencontainers.image.source=');
    expect(job).toContain('org.opencontainers.image.revision=${GITHUB_SHA}');
  });

  it('controlla i file dell’immagine prima di accedere al registro e pubblicare', () => {
    const job = commands(imagesJob());
    const check = job.indexOf('node infra/docker/check-image.mjs');
    const login = job.indexOf('docker login ghcr.io');
    const push = job.indexOf('docker push');
    expect(check).toBeGreaterThan(-1);
    expect(login).toBeGreaterThan(check);
    expect(push).toBeGreaterThan(login);
  });

  it('accede al registro con il gettone del flusso, da stdin, e nessun altro segreto', () => {
    const job = commands(imagesJob());
    expect(job).toContain('--password-stdin');
    const secrets = [...job.matchAll(/secrets\.([A-Z_]+)/g)].map((match) => match[1]);
    expect(new Set(secrets)).toEqual(new Set(['GITHUB_TOKEN']));
    expect(job).not.toMatch(/ssh|SSH_/);
  });
});

/**
 * Catena di fornitura della CI (1F-W4 T6d, rilievo R15, DR-386): azioni fissate per SHA,
 * `pnpm audit` bloccante e scansione dei segreti con un'immagine fissata per digest.
 */
describe('ci.yml: catena di fornitura', () => {
  const lines = ciText.split('\n');

  it('fissa ogni azione a uno SHA completo con il commento della versione', () => {
    const uses = lines.filter((line) => /^\s*(-\s+)?uses:/.test(line));
    expect(uses.length).toBeGreaterThan(0);
    for (const line of uses) {
      expect(line, line).toMatch(/uses: [\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+\s*$/);
    }
  });

  it('esegue pnpm audit bloccante subito dopo l’installazione', () => {
    const text = lines.filter((line) => !/^\s*#/.test(line)).join('\n');
    const install = text.indexOf('run: pnpm install --frozen-lockfile');
    const audit = text.indexOf('run: pnpm audit --prod --audit-level=high');
    expect(install).toBeGreaterThan(-1);
    expect(audit).toBeGreaterThan(install);
    // Tra l'installazione e l'audit c'è solo il nome del passo dell'audit stesso.
    expect(text.slice(install, audit).match(/- name:/g)).toHaveLength(1);
    expect(text).not.toContain('continue-on-error');
  });

  it('scansiona i segreti con gitleaks dall’immagine fissata per digest', () => {
    const text = lines.filter((line) => !/^\s*#/.test(line)).join('\n');
    expect(text).toContain(
      'ghcr.io/gitleaks/gitleaks@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f',
    );
    expect(text).toContain('--redact');
    expect(text).toMatch(/fetch-depth: 0/);
    expect(text).not.toMatch(/gitleaks-action/);
  });
});

/** Passo del browser degli e2e (1F-W5 T5c-4, DR-432): `apt` e il download riprovano su errori di rete. */
describe('ci.yml: browser degli e2e', () => {
  const start = ciText.indexOf('      - name: Browser per le prove end-to-end\n');
  const rest = ciText.slice(start + 1);
  const end = rest.search(/\n {6}(- name:|#)/);
  const step = start === -1 ? '' : end === -1 ? rest : rest.slice(0, end);
  const body = step
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

  it('esiste e ha un tempo massimo', () => {
    expect(start, 'passo del browser assente').toBeGreaterThan(-1);
    expect(body).toMatch(/\n {8}timeout-minutes: \d+\n/);
  });

  it('fa riprovare apt con un file in apt.conf.d scritto con sudo tee', () => {
    expect(body).toMatch(/sudo tee \/etc\/apt\/apt\.conf\.d\/\S+/);
    expect(body).toMatch(/Acquire::Retries "\d+"/);
  });

  it('ripete l’installazione di chromium al massimo tre volte, con pausa crescente', () => {
    expect(body).toContain('shell: bash');
    expect(body).toContain('set -euo pipefail');
    expect(body).toMatch(/for attempt in 1 2 3/);
    expect(body).toContain('pnpm exec playwright install --with-deps chromium');
    expect(body).toMatch(/sleep \$\(\(attempt \* 20\)\)/);
    expect(body).toContain('::warning::');
    expect(body).toMatch(/exit "\$status"/);
  });

  it('cita DR-432 nel commento sopra il passo', () => {
    expect(ciText.slice(Math.max(0, start - 300), start)).toContain('DR-432');
  });
});

/**
 * Workflow di rilascio (1F-W5 T3b, DR-411): letto dal testo di `rilascio.yml`, avviato a mano solo da
 * `main`, con la grammatica del comando uguale a quella di `rilascia.sh` (T3a).
 */
const rilascioText = readFileSync(
  path.join(repoRoot, '.github', 'workflows', 'rilascio.yml'),
  'utf8',
).replace(/\r\n/g, '\n');
const rilascioCode = rilascioText
  .split('\n')
  .filter((line) => !/^\s*#/.test(line))
  .join('\n');
const rilasciaScript = readFileSync(
  path.join(repoRoot, 'infra', 'deploy', 'rilascio', 'rilascia.sh'),
  'utf8',
);

/** Contenuto dei blocchi `run:` (a più righe o su una riga). */
function runBlocks(text: string): string[] {
  const lines = text.split('\n');
  const blocks: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^(\s*)(?:- )?run:\s*(.*)$/.exec(lines[i] as string);
    if (!m) continue;
    const indent = (m[1] as string).length;
    if (m[2] !== '|') {
      blocks.push(m[2] as string);
      continue;
    }
    const body: string[] = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j] as string;
      if (line.trim() !== '' && line.length - line.trimStart().length <= indent) break;
      body.push(line);
    }
    blocks.push(body.join('\n'));
  }
  return blocks;
}

describe('rilascio.yml', () => {
  it('parte solo a mano, con ambiente, hash e migrazioni', () => {
    const on = /\non:\n((?: {2}.*\n|\n)+)/.exec(rilascioCode)?.[1] ?? '';
    expect(on.match(/^ {2}[a-z_]+:/gm)).toEqual(['  workflow_dispatch:']);
    expect(on).toMatch(
      /ambiente:\n(?: {8}.+\n)*? {8}type: choice\n(?: {8}.+\n)*? {8}required: true\n {8}options:\n {10}- staging\n {10}- production\n/,
    );
    expect(on).toMatch(/hash:\n(?: {8}.+\n)*? {8}type: string\n {8}required: true\n/);
    expect(on).toMatch(/migrazioni:\n(?: {8}.+\n)*? {8}type: boolean\n {8}default: false\n/);
  });

  it('chiede esattamente contents: read e packages: read', () => {
    const block = /\npermissions:\n((?: {2}.+\n)+)/.exec(rilascioCode);
    expect(block?.[1]?.trim().split(/\n\s*/)).toEqual(['contents: read', 'packages: read']);
  });

  it('tiene un rilascio alla volta per ambiente, senza annullare', () => {
    expect(rilascioCode).toMatch(
      /\nconcurrency:\n {2}group: rilascio-\$\{\{ inputs\.ambiente \}\}\n {2}cancel-in-progress: false\n/,
    );
  });

  it('ha un solo lavoro, solo su main, con un tempo massimo', () => {
    const jobs = rilascioCode.slice(rilascioCode.indexOf('\njobs:\n'));
    expect(jobs.match(/^ {2}[\w-]+:$/gm)).toHaveLength(1);
    expect(jobs).toMatch(/\n {4}if: github\.ref == 'refs\/heads\/main'\n/);
    expect(jobs).toMatch(/\n {4}runs-on: ubuntu-24\.04\n/);
    expect(jobs).toMatch(/\n {4}timeout-minutes: \d+\n/);
  });

  it('il primo passo ricontrolla il riferimento e il formato dell’hash', () => {
    const first = runBlocks(rilascioCode)[0] ?? '';
    expect(first).toContain('GITHUB_REF');
    expect(first).toContain('refs/heads/main');
    expect(first).toContain('^[0-9a-f]{40}$');
    expect(first).toMatch(/exit 1/);
  });

  it('usa una sola azione esterna, fissata a 40 caratteri come in ci.yml', () => {
    const uses = [...rilascioCode.matchAll(/^\s*- uses: (\S+) # (v[\d.]+)$/gm)];
    expect(rilascioCode.match(/\buses:/g)).toHaveLength(uses.length);
    expect(uses.map((m) => m[1])).toEqual([
      'actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09',
    ]);
    expect(ciText).toContain('actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5.1.0');
    expect(uses[0]?.[2]).toBe('v5.1.0');
    expect(rilascioCode).toMatch(/fetch-depth: 0\n\s+persist-credentials: false\n/);
  });

  it('controlla che il commit sia su main e che le cinque immagini esistano', () => {
    const run = runBlocks(rilascioCode).join('\n');
    expect(run).toContain('git merge-base --is-ancestor "$HASH" origin/main');
    const ciApps = /app: \[([^\]]+)\]/.exec(ciText)?.[1]?.split(', ');
    expect(ciApps).toHaveLength(5);
    expect(run).toContain(`for app in ${(ciApps ?? []).join(' ')}; do`);
    expect(run).toContain(
      'docker manifest inspect "ghcr.io/${GITHUB_REPOSITORY_OWNER,,}/amoris-${app}:${HASH}"',
    );
    expect(run).toContain('docker logout ghcr.io');
  });

  it('nessuna espressione di ingressi, segreti o variabili dentro un blocco run', () => {
    const blocks = runBlocks(rilascioCode);
    expect(blocks.length).toBeGreaterThan(3);
    for (const block of blocks) {
      expect(block).not.toContain('${{');
      expect(block).not.toMatch(/\b(?:inputs|secrets|vars)\./);
    }
    expect(rilascioCode).toContain('RILASCIO_SSH_KEY: ${{ secrets.RILASCIO_SSH_KEY }}');
    expect(rilascioCode).toContain('RILASCIO_KNOWN_HOSTS: ${{ vars.RILASCIO_KNOWN_HOSTS }}');
    expect(rilascioCode).toContain('RILASCIO_HOST: ${{ vars.RILASCIO_HOST }}');
  });

  it('SSH rigoroso: BatchMode, host noto, solo la chiave del segreto, utente deploy', () => {
    const run = runBlocks(rilascioCode).join('\n');
    expect(run).toContain('-o BatchMode=yes');
    expect(run).toContain('-o StrictHostKeyChecking=yes');
    expect(run).toContain('-o UserKnownHostsFile="$known_hosts"');
    expect(run).toContain('-o IdentitiesOnly=yes');
    expect(run).toContain('-i "$chiave"');
    expect(run).toContain('"deploy@$RILASCIO_HOST"');
    expect(run).toMatch(/umask 077\n(?:.*\n)*?.*> "\$chiave"/);
    for (const name of ['RILASCIO_SSH_KEY', 'RILASCIO_KNOWN_HOSTS', 'RILASCIO_HOST']) {
      expect(run).toContain(`[ -n "$${name}" ]`);
    }
  });

  it('il token passa solo da stdin e non si stampa mai', () => {
    const run = runBlocks(rilascioCode).join('\n');
    const withToken = run
      .split('\n')
      .filter((l) => l.includes('$GITHUB_TOKEN'))
      .map((l) => l.trim());
    expect(withToken).toHaveLength(2);
    expect(withToken[0]).toBe(
      'printf \'%s\' "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin',
    );
    expect(withToken[1]).toMatch(
      /^esito=\$\(\{ printf '%s\\n%s\\n' "\$GITHUB_ACTOR" "\$GITHUB_TOKEN"; git archive /,
    );
    expect(run).not.toMatch(/set -x|set -[a-z]*x|xtrace/);
    expect(run).not.toMatch(/echo[^\n]*\$\{?(?:GITHUB_TOKEN|RILASCIO_SSH_KEY)/);
    expect(run).toContain('git archive --format=tar.gz "$HASH" infra');
  });

  it('la grammatica del comando è quella di rilascia.sh', () => {
    expect(rilasciaScript).toContain('case $AMB in production | staging) ;; *) rifiuta ;; esac');
    expect(rilascioCode).toContain('case "$AMBIENTE" in production | staging)');
    expect(rilascioCode).toMatch(/options:\n {10}- staging\n {10}- production\n/);
    expect(rilasciaScript).toContain('[ "$1" = rilascia ]');
    expect(rilascioCode).toContain('comando="rilascia $AMBIENTE $HASH"');
    expect(rilasciaScript).toContain('[ "$4" = --migrazioni ]');
    expect(rilascioCode).toContain('comando="$comando --migrazioni"');
    expect(rilasciaScript).toContain('[ ${#HASH} -eq 40 ]');
    expect(rilasciaScript).toContain('*[!0123456789abcdef]*');
    expect(rilascioCode).toContain('^[0-9a-f]{40}$');
  });

  it('cancella sempre la chiave e il known_hosts', () => {
    const last = rilascioCode.slice(rilascioCode.lastIndexOf('      - name:'));
    expect(last).toContain('if: always()');
    expect(last).toContain('rm -f "$RUNNER_TEMP/rilascio_key" "$RUNNER_TEMP/rilascio_known_hosts"');
  });

  it('il JSON del server va nel riepilogo e un’uscita non zero fa fallire il lavoro', () => {
    const run = runBlocks(rilascioCode).join('\n');
    expect(run).toContain('>> "$GITHUB_STEP_SUMMARY"');
    expect(run).toContain('exit "$rc"');
    expect(run).toContain('set -o pipefail');
  });
});
