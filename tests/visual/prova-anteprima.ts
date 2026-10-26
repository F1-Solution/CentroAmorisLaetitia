import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { formaConfrontabile, primaDifferenza } from './confrontoHtml';

/**
 * Criterio 1G-10 (wave 1G-W5, S19): l'anteprima di un contenuto pubblicato e la sua pagina
 * pubblica sono identiche con la regola di DR-202, menu compresi. Prova sul database di
 * sviluppo, su tutti i contenuti pubblicati con un indirizzo: l'e2e non ha menu e non basta.
 *
 * Non scrive nulla nel database (solo `SELECT`) né nei contenuti: l'unica scrittura è
 * l'ingresso dell'account di prova, come in `prova-1e-19.ts` (`qa-1e-w6@locale.invalid`,
 * ruolo Redazione). Il rapporto contiene percorsi pubblici ed esiti, mai titoli.
 *
 *   API=http://127.0.0.1:3002 SITO=http://127.0.0.1:3200 \
 *     QA_PASSWORD=... npx tsx tests/visual/prova-anteprima.ts
 */

const API = process.env.API ?? 'http://127.0.0.1:3002';
const SITO = process.env.SITO ?? 'http://127.0.0.1:3200';
const EMAIL = process.env.QA_EMAIL ?? 'qa-1e-w6@locale.invalid';
const PASSWORD = process.env.QA_PASSWORD;
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://amoris:sviluppo-locale@localhost:5432/amoris';

function leggiCookie(intestazioni: Headers, nome: string): string {
  for (const riga of intestazioni.getSetCookie?.() ?? []) {
    const [n, v] = (riga.split(';')[0] ?? '').split('=');
    if (n === nome) return v ?? '';
  }
  throw new Error(`cookie ${nome} non impostato dal login`);
}

/** Entra come in `prova-1e-19.ts` e sceglie la veste di Redazione; restituisce l'intestazione `cookie`. */
async function accedi(): Promise<string> {
  if (!PASSWORD) throw new Error('QA_PASSWORD non impostata');
  const risposta = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!risposta.ok) throw new Error(`login fallito: ${risposta.status}`);
  const sessione = leggiCookie(risposta.headers, 'amoris_sessione');
  const csrf = leggiCookie(risposta.headers, 'amoris_csrf');
  const cookie = `amoris_sessione=${sessione}; amoris_csrf=${csrf}`;

  const corpo = (await risposta.json()) as {
    activeArea: string | null;
    rolesHeld: { roleId: string; areas: string[] }[];
  };
  if (corpo.activeArea !== 'redazione') {
    const ruolo = corpo.rolesHeld.find((r) => r.areas.includes('redazione'));
    if (!ruolo) throw new Error('nessun ruolo posseduto ha l’area «redazione»');
    const scelta = await fetch(`${API}/auth/context`, {
      method: 'POST',
      headers: { cookie, 'x-csrf-token': csrf, 'content-type': 'application/json' },
      body: JSON.stringify({ roleId: ruolo.roleId, area: 'redazione' }),
    });
    if (!scelta.ok) throw new Error(`scelta della veste fallita: ${scelta.status}`);
  }
  return cookie;
}

interface Pubblicato {
  readonly id: string;
  /** Indirizzo pubblico: «/» per la pagina iniziale. */
  readonly path: string;
  readonly type: string;
}

/** Solo `SELECT`: i contenuti pubblicati con un indirizzo, con la pagina iniziale a «/». */
async function pubblicati(): Promise<Pubblicato[]> {
  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    return await sql<Pubblicato[]>`
      select c.id::text as id,
        case when (h.value #>> '{}') = c.id::text then '/' else c.path end as path,
        c.type
      from contents c
      left join settings h on h.key = 'site.home_content_id'
      where c.status = 'published' and c.path is not null
      order by 2`;
  } finally {
    await sql.end();
  }
}

async function forma(url: string, cookie?: string): Promise<string> {
  const risposta = await fetch(url, {
    redirect: 'manual',
    ...(cookie ? { headers: { cookie } } : {}),
  });
  return formaConfrontabile(risposta.status, await risposta.text());
}

interface Esito {
  readonly path: string;
  readonly type: string;
  readonly identica: boolean;
}

/** Chiude la sessione di prova, che altrimenti resterebbe valida 12 ore. */
async function esci(cookie: string): Promise<void> {
  const csrf = /amoris_csrf=([^;]*)/.exec(cookie)?.[1] ?? '';
  const risposta = await fetch(`${API}/auth/logout`, {
    method: 'POST',
    headers: { cookie, 'x-csrf-token': csrf },
  });
  if (!risposta.ok) console.error(`uscita non riuscita: ${risposta.status}`);
}

async function main(): Promise<void> {
  const cookie = await accedi();
  try {
    await confronta(cookie);
  } finally {
    await esci(cookie);
  }
}

async function confronta(cookie: string): Promise<void> {
  const contenuti = await pubblicati();
  console.log(`contenuti pubblicati con indirizzo: ${contenuti.length}`);

  const esiti: Esito[] = [];
  for (const c of contenuti) {
    const pubblica = await forma(`${SITO}${c.path}`);
    const anteprima = await forma(`${SITO}/anteprima/${c.id}/`, cookie);
    const differenza = primaDifferenza(pubblica, anteprima);
    // L'estratto della differenza può contenere testo dei contenuti: sta nella console, non nel rapporto.
    if (differenza) console.log(`  DIVERSO: ${c.type} ${c.path} ${differenza}`);
    esiti.push({ path: c.path, type: c.type, identica: differenza === null });
  }

  const falliti = esiti.filter((e) => !e.identica);
  console.log(`${esiti.length - falliti.length}/${esiti.length} identici`);

  mkdirSync(path.join(process.cwd(), 'docs/qa/confronto'), { recursive: true });
  writeFileSync(
    path.join(process.cwd(), 'docs/qa/confronto/prova-anteprima.json'),
    `${JSON.stringify(esiti, null, 1)}\n`,
  );
  if (falliti.length > 0) process.exitCode = 1;
}

main().catch((errore: unknown) => {
  console.error(errore);
  process.exitCode = 1;
});
