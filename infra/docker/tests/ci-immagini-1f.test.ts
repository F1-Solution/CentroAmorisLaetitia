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
