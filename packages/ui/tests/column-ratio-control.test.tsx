import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColumnRatioControl } from '../src/editor/ColumnRatioControl.js';

const options = [
  { value: '1_2,1_2', label: '1/2 + 1/2' },
  { value: '1_3,2_3', label: '1/3 + 2/3' },
];

describe('ColumnRatioControl — componente 43', () => {
  it('stato S: marca la ripartizione corrente', () => {
    render(<ColumnRatioControl value="1_2,1_2" options={options} onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: '1/2 + 1/2' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: '1/3 + 2/3' }).getAttribute('aria-checked')).toBe('false');
  });

  it('cambia la ripartizione', () => {
    const onChange = vi.fn();
    render(<ColumnRatioControl value="1_2,1_2" options={options} onChange={onChange} />);
    screen.getByRole('radio', { name: '1/3 + 2/3' }).click();
    expect(onChange).toHaveBeenCalledWith('1_3,2_3');
  });

  it('stato D: disabilitato', () => {
    render(<ColumnRatioControl value="1_2,1_2" options={options} onChange={vi.fn()} disabled />);
    expect(screen.getByRole('radio', { name: '1/2 + 1/2' })).toHaveProperty('disabled', true);
  });
});
