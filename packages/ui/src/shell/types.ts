import type { ComponentType, ReactNode } from 'react';

/**
 * Tipi condivisi dal guscio applicativo — capitoli 7 e 8 di
 * `docs/design/design-system.md`. Ogni componente riceve i propri dati come
 * proprietà: nessun contesto globale d'ambiente in questa wave, perché la
 * sessione reale che porta il contesto dell'area (§8.2 punto 2) nasce in
 * `apps/admin`, non qui. Chi possiede solo un'area o un ruolo passa un elenco
 * di un solo elemento: è la base per cui, ad esempio, `RoleSwitcher` non si
 * mostra come un commutatore vuoto (DR-050).
 */

/**
 * Come si rende un collegamento di navigazione.
 *
 * Esiste perché un'ancora normale **non conosce il prefisso** sotto cui
 * l'applicazione è servita: l'area amministrativa vive sotto `/admin`
 * (ADR-008 §3.2), e fino al 2026-09-23 ogni voce della navigazione puntava
 * fuori dall'applicazione e rispondeva 404.
 *
 * Il pacchetto resta neutro rispetto al framework: il valore predefinito è
 * un'ancora, e chi ha un componente che sa dei prefissi — `apps/admin` ha
 * quello di Next — lo passa. In cambio si riottiene anche la navigazione senza
 * ricaricare la pagina, che con un'ancora nuda si era persa.
 */
export interface NavLinkProps {
  href: string;
  className?: string | undefined;
  'aria-current'?: 'page' | 'true' | undefined;
  children?: ReactNode | undefined;
}

/**
 * Le proprietà sono **esattamente quelle che la navigazione passa**, non tutte
 * quelle di un'ancora: un contratto più stretto è quello che rende accettabile
 * il collegamento di Next, che di suo ne dichiara altre.
 */
export type NavLinkComponent = ComponentType<NavLinkProps>;

/** Un'area posseduta dalla persona (capitolo 7). Le aree non costruite non compaiono mai: non hanno voce qui. */
export interface AreaSummary {
  id: string;
  label: string;
  icon: ReactNode;
  href: string;
  /** Conteggio delle cose aperte, mostrato da `AreaChoiceScreen` (§7.4 punto 1). */
  openCount?: number;
}

/** Una sezione della seconda colonna (§6, componente 3). */
export interface NavSection {
  id: string;
  label: string;
  href: string;
  /**
   * DR-057: un'azione — qui una sezione — non permessa nel ruolo attivo non si
   * mostra, non si mostra disabilitata. Predefinito `true`.
   */
  permitted?: boolean;
}

/** Un gruppo di sezioni sotto un'etichetta in maiuscoletto (§6, componente 3). */
export interface NavSectionGroup {
  id: string;
  label: string;
  sections: NavSection[];
}

/** Un ruolo posseduto dalla persona (§8.3 punto 1). */
export interface RoleOption {
  id: string;
  /** Nome del ruolo, quello mostrato nella pastiglia e nell'`ActiveContextBadge`. */
  label: string;
  /** Riga che descrive che cosa cambia scegliendo questo ruolo. */
  description: string;
  /** Poteri estesi: la pastiglia ha bordo 2 px (§6, componente 7). */
  elevated?: boolean;
}

/** Una voce del percorso «Area / Sezione / Oggetto» (§6, componente 5). */
export interface BreadcrumbItem {
  label: string;
  /** Assente sull'ultimo elemento: non è cliccabile. */
  href?: string;
}

/** Un risultato di `CommandSearch`, sempre interno all'ambiente attivo (DR-054). */
export interface CommandResult {
  id: string;
  label: string;
  href: string;
  /** Etichetta di raggruppamento, ad esempio la sezione di provenienza. */
  group?: string;
}
