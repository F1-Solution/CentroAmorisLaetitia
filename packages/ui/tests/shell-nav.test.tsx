import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from '../src/shell/AppShell.js';
import { AreaNav } from '../src/shell/AreaNav.js';
import { SectionNav } from '../src/shell/SectionNav.js';
import { TopBar } from '../src/shell/TopBar.js';
import { Breadcrumbs } from '../src/shell/Breadcrumbs.js';
import type { AreaSummary, NavSectionGroup } from '../src/shell/types.js';

const redazione: AreaSummary = { id: 'redazione', label: 'Redazione', icon: '📝', href: '/redazione' };
const impostazioni: AreaSummary = { id: 'impostazioni', label: 'Impostazioni', icon: '⚙️', href: '/impostazioni' };

describe('AreaNav — componente 2', () => {
  it('stato R, S: rende solo le aree possedute e marca quella attiva', () => {
    render(<AreaNav areas={[redazione, impostazioni]} activeAreaId="redazione" />);
    expect(screen.getByRole('link', { name: /Redazione/ }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('link', { name: /Impostazioni/ }).getAttribute('aria-current')).toBeNull();
  });

  it('DR-055: le quattro aree non costruite non compaiono, perché non sono mai passate', () => {
    render(<AreaNav areas={[redazione]} activeAreaId="redazione" />);
    for (const label of ['Segreteria', 'Tesoreria', 'Formazione', 'Consulenza', 'Direzione']) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  it("l'elemento è raggiungibile da tastiera (marcato come focalizzabile)", () => {
    render(<AreaNav areas={[redazione]} activeAreaId="redazione" />);
    const link = screen.getByRole('link', { name: /Redazione/ });
    expect(link.className).toContain('amoris-focusable');
  });
});

describe('SectionNav — componente 3', () => {
  const groups: NavSectionGroup[] = [
    {
      id: 'contenuti',
      label: 'CONTENUTI',
      sections: [
        { id: 'pagine', label: 'Pagine', href: '/pagine' },
        { id: 'utenti', label: 'Utenti', href: '/utenti', permitted: false },
      ],
    },
  ];

  it('stato R, S: rende le sezioni permesse e marca quella attiva', () => {
    render(<SectionNav groups={groups} activeSectionId="pagine" />);
    expect(screen.getByRole('link', { name: 'Pagine' }).getAttribute('aria-current')).toBe('page');
  });

  it('DR-057: una sezione non permessa non compare, non compare disabilitata', () => {
    render(<SectionNav groups={groups} activeSectionId="pagine" />);
    expect(screen.queryByText('Utenti')).toBeNull();
  });

  it("stato V: nessun gruppo con sezioni permesse produce un messaggio esplicito, non una colonna vuota silenziosa", () => {
    render(
      <SectionNav
        groups={[{ id: 'g', label: 'G', sections: [{ id: 'x', label: 'X', href: '/x', permitted: false }] }]}
        activeSectionId="x"
      />,
    );
    expect(screen.getByText('Nessuna sezione disponibile in questo ambiente.')).not.toBeNull();
  });

  it("è richiudibile: nello stato richiuso mostra solo l'interruttore per riaprire", () => {
    const onToggle = vi.fn();
    render(<SectionNav groups={groups} activeSectionId="pagine" collapsed onToggleCollapsed={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(screen.queryByRole('link', { name: 'Pagine' })).toBeNull();
  });
});

describe('TopBar — componente 4', () => {
  it('stato R: si rende come intestazione, sempre chiara (DR-018)', () => {
    render(<TopBar breadcrumbs={<Breadcrumbs items={[{ label: 'Redazione' }]} />} />);
    const header = screen.getByRole('banner');
    expect(header.className).toContain('amoris-top-bar');
  });
});

describe('Breadcrumbs — componente 5', () => {
  it("l'ultimo elemento non è cliccabile ed è marcato aria-current", () => {
    render(
      <Breadcrumbs
        items={[{ label: 'Redazione', href: '/redazione' }, { label: 'Pagine', href: '/pagine' }, { label: 'Chi siamo' }]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Redazione' })).not.toBeNull();
    expect(screen.queryByRole('link', { name: 'Chi siamo' })).toBeNull();
    expect(screen.getByText('Chi siamo').getAttribute('aria-current')).toBe('page');
  });
});

describe('AppShell — componente 1', () => {
  it('stato R: ordine di tabulazione SkipLink, TopBar, AreaNav, SectionNav, area di lavoro, barra di registro (§9.3)', () => {
    render(
      <AppShell
        topBar={<button type="button">bottone barra superiore</button>}
        areaNav={<button type="button">bottone area</button>}
        sectionNav={<button type="button">bottone sezione</button>}
        registerBar={<button type="button">bottone registro</button>}
      >
        <button type="button">bottone area di lavoro</button>
      </AppShell>,
    );

    const focusable = Array.from(document.querySelectorAll('a, button')) as HTMLElement[];
    const labels = focusable.map((el) => el.textContent);
    expect(labels).toEqual([
      'Vai al contenuto',
      'bottone barra superiore',
      'bottone area',
      'bottone sezione',
      'bottone area di lavoro',
      'bottone registro',
    ]);
  });

  it('SkipLink porta al contenuto e il contenuto è realmente focalizzabile', () => {
    render(
      <AppShell topBar={null} areaNav={null} sectionNav={null}>
        <p>contenuto</p>
      </AppShell>,
    );
    const skipLink = screen.getByRole('link', { name: 'Vai al contenuto' });
    expect(skipLink.getAttribute('href')).toBe('#amoris-app-shell-content');
    const content = document.getElementById('amoris-app-shell-content');
    expect(content).not.toBeNull();
    expect(content?.getAttribute('tabindex')).toBe('-1');
  });
});
