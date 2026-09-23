import type { NavLinkComponent } from './types';

/**
 * Il collegamento predefinito della navigazione: un'ancora, e nulla più.
 *
 * Sta in un file suo perché i tre componenti che lo usano lo condividano senza
 * importarsi a vicenda. Chi rende l'applicazione sotto un prefisso passa il
 * proprio: l'ancora nuda non lo conosce, e questo è il comportamento giusto per
 * un pacchetto che non sa dove verrà montato.
 */
export const DefaultNavLink: NavLinkComponent = (props) => <a {...props} />;
