import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

/**
 * Criterio 1E-19 (ADR-005 §7): aprire e salvare senza modifiche un contenuto
 * non cambia la pagina pubblica. Prova end-to-end, non a confine di servizio
 * come `apps/api/tests/roundTripCorpus.test.ts` (quella è sul corpus sintetico
 * e si ferma al database): qui si passa dall'API amministrativa reale e dal
 * sito pubblico reale, su un campione di contenuti **importati**, per
 * dimostrare che l'editor non altera la resa di ciò che non ha toccato.
 *
 * Non tocca testo: PATCH con lo stesso `blocks`, `title`, `excerpt` letti da
 * GET. Account locale sintetico creato per la prova (`qa-1e-w6@locale.invalid`,
 * ruolo `editor`), nessun dato reale modificato.
 *
 *   API=http://127.0.0.1:3002 SITO=http://127.0.0.1:3200 \
 *     QA_PASSWORD=... npx tsx tests/visual/prova-1e-19.ts
 */

const API = process.env.API ?? 'http://127.0.0.1:3002';
const SITO = process.env.SITO ?? 'http://127.0.0.1:3200';
const EMAIL = process.env.QA_EMAIL ?? 'qa-1e-w6@locale.invalid';
const PASSWORD = process.env.QA_PASSWORD;
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://amoris:sviluppo-locale@localhost:5432/amoris';

interface Cookie {
  readonly name: string;
  readonly value: string;
}

function leggiCookie(intestazioni: Headers, nome: string): string {
  const grezzo = intestazioni.getSetCookie?.() ?? [];
  for (const riga of grezzo) {
    const parte = riga.split(';')[0] ?? '';
    const [n, v] = parte.split('=');
    if (n === nome) return v ?? '';
  }
  throw new Error(`cookie ${nome} non impostato dal login`);
}

async function accedi(): Promise<{ cookie: string; csrf: string }> {
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

  // Il ruolo `editor` vale per due aree («redazione», «impostazioni»): il
  // login non sceglie da solo, va scelta la veste di `redazione`.
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
  return { cookie, csrf };
}

interface Campione {
  readonly id: string;
  readonly path: string;
  readonly type: string;
}

async function campione(): Promise<Campione[]> {
  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    // Campione rappresentativo: la home (post_list), pagine con `show_title`
    // falso (Divi Builder, DR-119), una pagina con form, e per il resto un
    // contenuto per tipo pubblicato — non solo i due estremi.
    const righe = await sql<Campione[]>`
      (select id::text, path, type from contents where path = '/' limit 1)
      union all
      (select id::text, path, type from contents
        where status = 'published' and show_title = false and path is not null
        order by path limit 2)
      union all
      (select id::text, path, type from contents
        where status = 'published' and path is not null
          and blocks::text like '%"type":"form"%'
        order by path limit 1)
      union all
      (select distinct on (type) id::text, path, type
        from contents
        where status = 'published' and path is not null and blocks -> 'blocks' <> '[]'::jsonb
        order by type, updated_at desc)
    `;
    const visti = new Set<string>();
    return righe.filter((r) => (visti.has(r.id) ? false : (visti.add(r.id), true)));
  } finally {
    await sql.end();
  }
}

async function paginaPubblica(p: string): Promise<string> {
  const risposta = await fetch(`${SITO}${p}`, { redirect: 'manual' });
  return `${risposta.status}\n${await risposta.text()}`;
}

async function main(): Promise<void> {
  const { cookie, csrf } = await accedi();
  const scelti = await campione();
  console.log(`campione: ${scelti.length} contenuti, uno per tipo`);

  const esiti: { path: string; type: string; identica: boolean; nota?: string }[] = [];
  for (const c of scelti) {
    const prima = await paginaPubblica(c.path);

    const letto = await fetch(`${API}/contents/${c.id}`, { headers: { cookie } });
    if (!letto.ok) {
      esiti.push({ path: c.path, type: c.type, identica: false, nota: `GET ${letto.status}` });
      continue;
    }
    const corpo = (await letto.json()) as {
      blocks: unknown;
      title: string;
      excerpt: string | null;
      showTitle: boolean;
      contentHtml: string;
      contentText: string;
    };

    const salvato = await fetch(`${API}/contents/${c.id}`, {
      method: 'PATCH',
      headers: { cookie, 'x-csrf-token': csrf, 'content-type': 'application/json' },
      body: JSON.stringify({
        blocks: corpo.blocks,
        title: corpo.title,
        excerpt: corpo.excerpt,
        showTitle: corpo.showTitle,
        contentHtml: corpo.contentHtml,
        contentText: corpo.contentText,
      }),
    });
    if (!salvato.ok) {
      esiti.push({ path: c.path, type: c.type, identica: false, nota: `PATCH ${salvato.status}` });
      continue;
    }

    const dopo = await paginaPubblica(c.path);
    esiti.push({ path: c.path, type: c.type, identica: prima === dopo });
  }

  const falliti = esiti.filter((e) => !e.identica);
  console.log(`identici: ${esiti.length - falliti.length}/${esiti.length}`);
  for (const f of falliti) console.log(`  DIVERSO: ${f.type} ${f.path} ${f.nota ?? ''}`);

  mkdirSync(path.join(process.cwd(), 'docs/qa/confronto'), { recursive: true });
  writeFileSync(
    path.join(process.cwd(), 'docs/qa/confronto/prova-1e-19.json'),
    `${JSON.stringify(esiti, null, 1)}\n`,
  );
  if (falliti.length > 0) process.exitCode = 1;
}

main().catch((errore: unknown) => {
  console.error(errore);
  process.exitCode = 1;
});
