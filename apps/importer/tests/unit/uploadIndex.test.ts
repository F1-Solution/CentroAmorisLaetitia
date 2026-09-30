/**
 * Ricerca di un file di `uploads/` senza distinguere maiuscole e minuscole
 * (DR-065). Funzione pura: la prova dell'ambiguità non si può costruire su un
 * disco che non distingue le maiuscole, e qui non serve un disco.
 */
import { describe, expect, it } from 'vitest';
import { createUploadIndex } from '../../src/source/files/uploads.js';

const FILES = [
  { relativePath: '2020/05/esatto.jpg', sizeBytes: 1 },
  { relativePath: '2020/05/Maiuscole-Diverse.JPG', sizeBytes: 2 },
  { relativePath: '2020/05/doppio.jpg', sizeBytes: 3 },
  { relativePath: '2020/05/DOPPIO.jpg', sizeBytes: 4 },
];

describe('createUploadIndex', () => {
  it('trova per primo il nome esatto', () => {
    const index = createUploadIndex(FILES);
    expect(index.find('2020/05/esatto.jpg')).toEqual({ kind: 'exact', file: FILES[0] });
    // Il nome esatto vince anche quando esiste un omonimo che differisce per maiuscole.
    expect(index.find('2020/05/doppio.jpg')).toEqual({ kind: 'exact', file: FILES[2] });
  });

  it('senza nome esatto, trova l’unico file che differisce solo per maiuscole e minuscole', () => {
    const index = createUploadIndex(FILES);
    expect(index.find('2020/05/maiuscole-diverse.jpg')).toEqual({
      kind: 'case-insensitive',
      file: FILES[1],
    });
  });

  it('non sceglie fra due file che differiscono solo per maiuscole', () => {
    const index = createUploadIndex(FILES);
    expect(index.find('2020/05/Doppio.jpg')).toEqual({ kind: 'ambiguous' });
  });

  it('un file che non c’è resta mancante', () => {
    expect(createUploadIndex(FILES).find('2020/05/assente.jpg')).toEqual({ kind: 'missing' });
  });
});
