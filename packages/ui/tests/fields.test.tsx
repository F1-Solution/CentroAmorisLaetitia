import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TextField } from '../src/primitives/TextField.js';
import { TextArea } from '../src/primitives/TextArea.js';
import { CheckboxField } from '../src/primitives/CheckboxField.js';
import { RadioGroup } from '../src/primitives/RadioGroup.js';
import { SelectField } from '../src/primitives/SelectField.js';
import { FieldGroup } from '../src/primitives/FieldGroup.js';

describe('TextField — componente 21', () => {
  it('mostra etichetta sopra il campo e testo di aiuto permanente', () => {
    render(<TextField label="Titolo" helpText="Compare nel menu." />);
    expect(screen.getByLabelText('Titolo')).toBeDefined();
    expect(screen.getByText('Compare nel menu.')).toBeDefined();
  });

  it('stato E: errore con messaggio testuale e bordo più spesso, non solo colore', () => {
    render(<TextField label="Titolo" errorText="Il titolo è obbligatorio." />);
    const input = screen.getByLabelText('Titolo');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('Il titolo è obbligatorio.');
    expect(input.className).toContain('amoris-field-input--error');
  });

  it('stato D: disabilitato', () => {
    render(<TextField label="Titolo" disabled />);
    expect(screen.getByLabelText('Titolo')).toHaveProperty('disabled', true);
  });
});

describe('TextArea — componente 22', () => {
  it('rende con etichetta ed errore', () => {
    render(<TextArea label="Riassunto" errorText="Troppo lungo." />);
    expect(screen.getByLabelText('Riassunto')).toBeDefined();
    expect(screen.getByRole('alert').textContent).toBe('Troppo lungo.');
  });
});

describe('CheckboxField — componente 24', () => {
  it('rende lo stato indeterminato', () => {
    render(
      <CheckboxField label="Seleziona tutte" indeterminate onChange={() => {}} checked={false} />,
    );
    const input = screen.getByLabelText('Seleziona tutte') as HTMLInputElement;
    expect(input.indeterminate).toBe(true);
  });

  it('rende lo stato selezionato S', () => {
    render(<CheckboxField label="Riga 1" checked readOnly />);
    expect((screen.getByLabelText('Riga 1') as HTMLInputElement).checked).toBe(true);
  });
});

describe('RadioGroup — componente 25', () => {
  it('rende la scelta esclusiva e segnala la selezione', () => {
    const onChange = vi.fn();
    render(
      <RadioGroup
        legend="Visibilità"
        value="public"
        onChange={onChange}
        options={[
          { value: 'public', label: 'Pubblico' },
          { value: 'restricted', label: 'Riservato' },
        ]}
      />,
    );
    expect((screen.getByLabelText('Pubblico') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Riservato') as HTMLInputElement).checked).toBe(false);
  });
});

describe('SelectField — componente 23', () => {
  it('stato V: elenco vuoto', () => {
    render(<SelectField label="Autore" options={[]} emptyText="Nessun autore." />);
    expect(screen.getByText('Nessun autore.')).toBeDefined();
  });

  it('rende le voci quando presenti', () => {
    render(
      <SelectField
        label="Autore"
        options={[
          { value: 'a', label: 'Alfa' },
          { value: 'b', label: 'Beta' },
        ]}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Autore' })).toBeDefined();
  });
});

describe('FieldGroup — componente 27', () => {
  it('rende titolo maiuscoletto e contenuto', () => {
    render(
      <FieldGroup title="Pubblicazione" description="Quando compare sul sito.">
        <p>Campo interno</p>
      </FieldGroup>,
    );
    expect(screen.getByText('Pubblicazione')).toBeDefined();
    expect(screen.getByText('Campo interno')).toBeDefined();
  });
});
