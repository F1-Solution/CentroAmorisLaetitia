import { configure } from '@testing-library/react';

/**
 * Attese più larghe, per una ragione misurata e non per comodità.
 *
 * I valori predefiniti sono 5 s per una prova e 1 s per un'attesa asincrona.
 * Su una macchina che sta già compilando due applicazioni di sviluppo, la
 * **prima** resa di un file di prova li supera, e il giro fallisce in un punto
 * diverso ogni volta: il 2026-09-23 sono falliti a turno l'inseritore di
 * blocchi, la schermata di scelta dell'area e il bottone di sola icona, tutti
 * per scadenza e nessuno per un difetto.
 *
 * Un test che fallisce a caso è peggio di un test lento: smette di essere un
 * segnale. Qui si allarga l'attesa, non si nasconde un errore — ciò che è
 * rotto continua a fallire, semplicemente ha il tempo di dirlo.
 */
configure({ asyncUtilTimeout: 5000 });
