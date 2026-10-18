import { fireEvent, render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SiteHeader } from '../src/components/SiteHeader';
import type { MenuItem } from '../src/lib/api';

// A3-1 (1E-W7, DR-169): il menu per telefono resta un <details> che si apre con
// Invio e Spazio senza script; Esc lo chiude e riporta il fuoco sulla barra.
const menu: MenuItem[] = [
  {
    id: 'm1',
    label: 'Chi siamo',
    href: '/chi-siamo/',
    target: null,
    cssClasses: null,
    children: [],
  },
  { id: 'm2', label: 'Contatti', href: '/contatti/', target: null, cssClasses: null, children: [] },
];

function header() {
  return <SiteHeader siteTitle="Sito di prova" logoPath={null} menu={menu} currentPath="/" />;
}

describe('menu per telefono — tasto Esc (A3-1)', () => {
  it('lascia il markup del <details> come prima', () => {
    const html = renderToStaticMarkup(header());
    expect(html).toContain('<details id="et_mobile_nav_menu"><summary class="mobile_nav">');
  });

  it('chiude il menu aperto con Esc da una voce e riporta il fuoco sulla barra', () => {
    const { container } = render(header());
    const details = container.querySelector<HTMLDetailsElement>('#et_mobile_nav_menu');
    const summary = details?.querySelector('summary');
    const link = details?.querySelector<HTMLAnchorElement>('a[href="/contatti/"]');
    if (!details || !summary || !link) throw new Error('menu per telefono assente');
    details.open = true;
    link.focus();
    fireEvent.keyDown(link, { key: 'Escape' });
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(summary);
  });

  it('chiude il menu aperto con Esc dalla barra stessa', () => {
    const { container } = render(header());
    const details = container.querySelector<HTMLDetailsElement>('#et_mobile_nav_menu');
    const summary = details?.querySelector('summary');
    if (!details || !summary) throw new Error('menu per telefono assente');
    details.open = true;
    fireEvent.keyDown(summary, { key: 'Escape' });
    expect(details.open).toBe(false);
  });

  it('a menu chiuso Esc non fa nulla', () => {
    const { container } = render(header());
    const details = container.querySelector<HTMLDetailsElement>('#et_mobile_nav_menu');
    const summary = details?.querySelector('summary');
    if (!details || !summary) throw new Error('menu per telefono assente');
    fireEvent.keyDown(summary, { key: 'Escape' });
    expect(details.open).toBe(false);
  });
});
