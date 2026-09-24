import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from '../src/primitives/Tabs.js';

const tabs = [
  { key: 'general', label: 'Generale' },
  { key: 'advanced', label: 'Avanzate' },
];

describe('Tabs — componente 50', () => {
  it('stato S: marca la scheda attiva', () => {
    render(
      <Tabs tabs={tabs} activeKey="general" onChange={vi.fn()}>
        <p>Contenuto</p>
      </Tabs>,
    );
    expect(screen.getByRole('tab', { name: 'Generale' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Avanzate' }).getAttribute('aria-selected')).toBe(
      'false',
    );
  });

  it('cambia scheda al clic', () => {
    const onChange = vi.fn();
    render(
      <Tabs tabs={tabs} activeKey="general" onChange={onChange}>
        <p>Contenuto</p>
      </Tabs>,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Avanzate' }));
    expect(onChange).toHaveBeenCalledWith('advanced');
  });

  it('freccia destra sposta alla scheda successiva', () => {
    const onChange = vi.fn();
    render(
      <Tabs tabs={tabs} activeKey="general" onChange={onChange}>
        <p>Contenuto</p>
      </Tabs>,
    );
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Generale' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('advanced');
  });
});
