/**
 * I moduli di contatto di Divi (`et_pb_contact_form`) diventano form veri
 * (DR-094). Non hanno una riga sorgente propria: la definizione si ricava dallo
 * shortcode, letto con lo stesso parser dei contenuti. Funzione pura.
 */
import { parseShortcodes, type ParsedShortcode } from '../../convert/divi/shortcodes.js';

export interface DiviSourcePost {
  readonly postId: number;
  readonly content: string;
}

export interface DiviFormField {
  readonly id: string;
  readonly type: 'text' | 'email';
  readonly label: string;
  readonly required: boolean;
  readonly order: number;
  readonly description: null;
  readonly options: Readonly<Record<string, unknown>>;
}

export interface DiviContactForm {
  /** La pagina in cui il modulo compare: è la chiave della corrispondenza. */
  readonly postId: number;
  readonly title: string;
  readonly slug: string;
  readonly fields: readonly DiviFormField[];
  readonly confirmationMessage: string | null;
  readonly notification: { readonly recipients: string; readonly body: string };
}

/** Un'anomalia da segnalare nel rapporto: mai il contenuto, solo il codice e la pagina. */
export interface DiviFormIssue {
  readonly code: 'divi-form-title-conflict' | 'divi-form-unknown-field-type';
  readonly postId: number;
}

export interface DiviContactForms {
  readonly forms: readonly DiviContactForm[];
  readonly issues: readonly DiviFormIssue[];
}

const TAG = 'et_pb_contact_form';
const KNOWN_DIVI_FIELD_TYPES = new Set(['input', 'email', 'text']);

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function collect(nodes: readonly ParsedShortcode[], tag: string): ParsedShortcode[] {
  return nodes.flatMap((node) => [
    ...(node.tag === tag ? [node] : []),
    ...collect(node.children, tag),
  ]);
}

/** Campo Divi: `input` o assente è testo, `email` è email, `text` è testo su più righe. */
function toField(node: ParsedShortcode, order: number): DiviFormField {
  const divType = node.attrs['field_type'] ?? 'input';
  return {
    id: node.attrs['field_id'] ?? String(order),
    type: divType === 'email' ? 'email' : 'text',
    label: node.attrs['field_title'] ?? '',
    required: node.attrs['required_mark'] !== 'off',
    order,
    description: null,
    options: {
      ...(divType === 'text' ? { multiline: true } : {}),
      // Campo a tutta riga invece che a metà (T, DR-157).
      ...(node.attrs['fullwidth_field'] === 'on' ? { fullwidth: true } : {}),
    },
  };
}

/**
 * Un form per titolo: lo stesso modulo copiato in due pagine è lo stesso form,
 * ed è il titolo la chiave con cui il convertitore lo cita
 * (`divi-contact-form:<titolo>`). Due moduli con lo stesso titolo ma campi
 * diversi non si fondono in silenzio: il secondo si segnala.
 */
export function findDiviContactForms(posts: readonly DiviSourcePost[]): DiviContactForms {
  const byTitle = new Map<string, DiviContactForm>();
  const issues: DiviFormIssue[] = [];
  for (const post of posts) {
    if (!post.content.includes(`[${TAG}`)) continue;
    for (const node of collect(parseShortcodes(post.content), TAG)) {
      const title = node.attrs['title'] ?? '';
      if (title === '') continue;
      const fieldNodes = collect(node.children, 'et_pb_contact_field');
      const fields = fieldNodes.map(toField);
      const seen = byTitle.get(title);
      if (seen) {
        if (JSON.stringify(seen.fields) !== JSON.stringify(fields)) {
          issues.push({ code: 'divi-form-title-conflict', postId: post.postId });
        }
        continue;
      }
      if (fieldNodes.some((f) => !KNOWN_DIVI_FIELD_TYPES.has(f.attrs['field_type'] ?? 'input'))) {
        issues.push({ code: 'divi-form-unknown-field-type', postId: post.postId });
      }
      byTitle.set(title, {
        postId: post.postId,
        title,
        slug: `contatto-${slugify(title)}`,
        fields,
        confirmationMessage: node.attrs['success_message'] || null,
        notification: {
          recipients: node.attrs['email'] ?? '',
          body: node.attrs['custom_message'] ?? '',
        },
      });
    }
  }
  return { forms: [...byTitle.values()], issues };
}
