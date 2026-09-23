import { configure } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

/**
 * Attese più larghe, per una ragione misurata e non per comodità: i valori
 * predefiniti sono 5 s per una prova e 1 s per un'attesa asincrona, e la prima
 * resa di un file di prova li supera su una macchina che sta già compilando
 * due applicazioni di sviluppo. Il 2026-09-23 la prima prova del menu falliva
 * per questo, e le sette successive dello stesso file passavano.
 *
 * Ciò che è rotto continua a fallire: ha solo il tempo di dirlo.
 */
configure({ asyncUtilTimeout: 5000 });
