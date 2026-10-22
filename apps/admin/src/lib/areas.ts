import type { NavSectionGroup } from '@amoris/ui';

/**
 * Le due aree della Fase 1 (`design-system.md` §7.2).
 *
 * **Le altre quattro del §7.1 non compaiono qui, e non è una dimenticanza.**
 * `CLAUDE.md` vieta di *pianificare* qualunque fase gestionale prima del gate,
 * e una voce «Tesoreria (in arrivo)» sarebbe una promessa di pianificazione
 * fatta nell'interfaccia: il gate scavalcato di fatto (§7.3 punto 1).
 */
export const AREAS = ['redazione', 'impostazioni'] as const;

export type AreaId = (typeof AREAS)[number];

export function isAreaId(value: string): value is AreaId {
  return (AREAS as readonly string[]).includes(value);
}

interface AreaDefinition {
  readonly id: AreaId;
  readonly label: string;
  readonly href: string;
  /** Riga che dice che cosa cambia scegliendo questa veste (§8.3 punto 1). */
  readonly description: string;
  readonly icon: string;
  readonly groups: readonly NavSectionGroup[];
}

/**
 * Le sezioni sono quelle del §7.2 e nient'altro. Quelle che la `1D-W9` deve
 * ancora costruire ci sono comunque: toglierle renderebbe la navigazione una
 * descrizione di quanto codice è stato scritto invece che dell'area.
 */
export const AREA_DEFINITIONS: Readonly<Record<AreaId, AreaDefinition>> = {
  redazione: {
    id: 'redazione',
    label: 'Redazione',
    href: '/redazione/pagine',
    description: 'Pagine, notizie, media, menu e indirizzi del sito pubblico.',
    icon: '✎',
    groups: [
      {
        id: 'contenuti',
        label: 'Contenuti',
        sections: [
          { id: 'pagine', label: 'Pagine', href: '/redazione/pagine' },
          { id: 'notizie', label: 'Notizie', href: '/redazione/notizie' },
          { id: 'categorie', label: 'Categorie', href: '/redazione/categorie' },
        ],
      },
      {
        id: 'corredo',
        label: 'Corredo',
        sections: [
          { id: 'media', label: 'Media', href: '/redazione/media' },
          { id: 'menu', label: 'Menu', href: '/redazione/menu' },
          { id: 'seo', label: 'SEO e indirizzi', href: '/redazione/seo' },
        ],
      },
    ],
  },
  impostazioni: {
    id: 'impostazioni',
    label: 'Impostazioni',
    href: '/impostazioni',
    description: 'Persone e permessi, registro delle operazioni, impostazioni del sito.',
    icon: '⚙',
    groups: [
      {
        id: 'sistema',
        label: 'Sistema',
        sections: [
          { id: 'persone', label: 'Persone e permessi', href: '/impostazioni/persone' },
          { id: 'registro', label: 'Registro delle operazioni', href: '/impostazioni/registro' },
          { id: 'sito', label: 'Impostazioni del sito', href: '/impostazioni' },
        ],
      },
    ],
  },
};
