import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GuidedFlow } from '../src/primitives/GuidedFlow.js';

const steps = [
  { key: 's1', title: 'Conferma i dati', content: <p>Passo 1</p> },
  { key: 's2', title: 'Conclusione', content: <p>Passo 2</p> },
];

describe('GuidedFlow — componente 54', () => {
  it('stato R: rende il passo corrente e i numeri', () => {
    render(<GuidedFlow steps={steps} currentStepIndex={0} onBack={vi.fn()} onNext={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByText('Passo 1')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Indietro' })).toHaveProperty('disabled', true);
  });

  it('sull\'ultimo passo mostra "Concludi" invece di "Avanti"', () => {
    render(<GuidedFlow steps={steps} currentStepIndex={1} onBack={vi.fn()} onNext={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Concludi' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Avanti' })).toBeNull();
  });

  it('stato E: errore', () => {
    render(<GuidedFlow steps={steps} currentStepIndex={0} onBack={vi.fn()} onNext={vi.fn()} onFinish={vi.fn()} errorText="Impossibile continuare." />);
    expect(screen.getByText('Impossibile continuare.')).toBeDefined();
  });

  it('stato L: avanti in caricamento', () => {
    render(<GuidedFlow steps={steps} currentStepIndex={0} onBack={vi.fn()} onNext={vi.fn()} onFinish={vi.fn()} loading />);
    expect(screen.getByRole('button', { name: 'Avanti' }).getAttribute('aria-busy')).toBe('true');
  });
});
