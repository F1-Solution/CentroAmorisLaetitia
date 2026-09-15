import { describe, expect, it } from 'vitest';
import { isAllowedUrl } from '../src/sanitize/url.js';

/**
 * Casi di aggiramento del controllo sugli URL. Sono scritti a parte perché
 * nascono da una revisione di sicurezza e non dall'elenco chiuso di
 * `BLOCK-MODEL.md` §5.3: se qualcuno rilassa `isAllowedUrl`, questi test devono
 * fallire prima che il rilassamento arrivi nei contenuti.
 */
describe('isAllowedUrl — percorsi e schemi ammessi', () => {
  it('ammette i percorsi interni e le ancore', () => {
    expect(isAllowedUrl('/media/2024/05/foto.jpg')).toBe(true);
    expect(isAllowedUrl('/chi-siamo/')).toBe(true);
    expect(isAllowedUrl('#sezione')).toBe(true);
  });

  it('ammette i quattro schemi dell elenco chiuso', () => {
    expect(isAllowedUrl('https://esempio.invalid/pagina')).toBe(true);
    expect(isAllowedUrl('http://esempio.invalid/pagina')).toBe(true);
    expect(isAllowedUrl('mailto:qualcuno@esempio.invalid')).toBe(true);
    expect(isAllowedUrl('tel:+390000000000')).toBe(true);
  });
});

describe('isAllowedUrl — aggiramenti', () => {
  it('rifiuta gli URL relativi allo schema, che sembrano interni ma portano fuori', () => {
    expect(isAllowedUrl('//esempio.invalid/pagina')).toBe(false);
    expect(isAllowedUrl('  //esempio.invalid/pagina')).toBe(false);
    expect(isAllowedUrl('///esempio.invalid')).toBe(false);
  });

  it('rifiuta javascript: anche con caratteri di controllo dentro lo schema', () => {
    expect(isAllowedUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedUrl('JaVaScRiPt:alert(1)')).toBe(false);
    expect(isAllowedUrl('\u0001javascript:alert(1)')).toBe(false);
    expect(isAllowedUrl('java\tscript:alert(1)')).toBe(false);
    expect(isAllowedUrl('java\nscript:alert(1)')).toBe(false);
    expect(isAllowedUrl('java\u0000script:alert(1)')).toBe(false);
    expect(isAllowedUrl('\u007Fjavascript:alert(1)')).toBe(false);
  });

  it('rifiuta gli altri schemi pericolosi', () => {
    expect(isAllowedUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
    expect(isAllowedUrl('vbscript:msgbox(1)')).toBe(false);
    expect(isAllowedUrl('file:///etc/passwd')).toBe(false);
  });

  it('rifiuta il valore vuoto e quello fatto di soli caratteri di controllo', () => {
    expect(isAllowedUrl('')).toBe(false);
    expect(isAllowedUrl('   ')).toBe(false);
    expect(isAllowedUrl('\u0001\u0002')).toBe(false);
  });
});
