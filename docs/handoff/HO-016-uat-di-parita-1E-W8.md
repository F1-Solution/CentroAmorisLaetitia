# HO-016 — UAT di parità visiva (`1E-W8`)

Fase 1E, wave `1E-W8`. Scritto il 2026-10-12, **attivato il 2026-10-18** dopo l'audit
della fase (`.planning/phases/1E/AUDIT.md`) e il rapporto completo
(`docs/qa/visual-parity-report.md`, commit `e70b51d`, CI verde).

## 1. Che cosa è

La UAT è la tua prova di accettazione: guardi il sito nuovo accanto alla sorgente e
dichiari se lo approvi. È la **condizione 13 del gate**: nessuna fase gestionale si
pianifica senza la tua approvazione esplicita, registrata nel §12 del rapporto. Io non
dichiaro mai la parità al posto tuo.

Che cosa sai già: il confronto al pixel non dà l'identità. Su 591 confronti 40 sono
identici; tutte le altre viste le hai esaminate e accettate nei due report «Bozze di
parità» (DR-162, DR-203). Il rapporto, al §11.1, elenca ogni difformità accettata.

## 2. Prerequisiti

| Che cosa | Come verificarlo |
|---|---|
| Audit e rapporto completi | `AUDIT.md` §1: 27 criteri eseguiti, 0 falliti senza approvazione; rapporto §12 «Risposta dell'utente: non ancora data» |
| Sito nuovo e sorgente attivi | http://127.0.0.1:3200/ (sito nuovo) e http://localhost:8088/ (sorgente congelata) si aprono; se non è così, chiedimi di avviarli |
| Memoria libera | almeno 4 GB; chiudi le applicazioni che non servono (HO-014) |
| Tempo | circa 2 ore, anche in più sessioni |

## 3. Passi

1. **Leggi il rapporto** `docs/qa/visual-parity-report.md`, soprattutto il §10, il §11 e
   l'indice delle difformità accettate (§11.1).
2. **Confronto a vista.** Apri le due versioni affiancate e controlla almeno: `/`,
   `/chi-siamo/`, `/contatti/`, `/dove-siamo/`, `/category/news/`, un articolo recente,
   `/informazioni-sui-cookie/`, `/download-category/moduli-consulenze/`, `/?s=corso`.
3. **Prova da telefono:** nel browser premi F12, poi Ctrl+Shift+M, e scegli una
   larghezza di 390 px. Apri e chiudi il menu, scorri una pagina lunga, apri la ricerca.
4. **Prova un form** su `/contatti/` **solo sul sito nuovo** (`:3200`), con **dati
   inventati**, per esempio «Mario Prova», `prova@example.invalid`, telefono
   `+39 000 0000000`. Atteso: il messaggio di conferma; nessuna email parte (DR-108).
   Non usare mai dati veri. Annota l'ora dell'invio: la compilazione resta nel database
   locale e la cancello dopo, con la tua conferma (DR-208).
5. **Annota ogni differenza** che non ti convince: pagina, larghezza, che cosa vedi.

## 4. Come rispondere

Se approvi, con la formula di DR-209 (vale come condizione del gate):

```
HO-016: approvo la parità pixel-perfect del sito pubblico, con le difformità accettate elencate nel rapporto. Form inviato alle <ora>.
```

Se non approvi, elenca le differenze:

```
HO-016: non approvo. 1) <pagina>, <larghezza>: <che cosa vedi>. 2) … Form inviato alle <ora> (oppure: nessun form inviato).
```

Registrerò la tua risposta, con le tue parole, nel §12 del rapporto e nel registro delle
decisioni. Le differenze diventano correzioni, con il metodo della `1E-W6`, poi si ripete
la UAT su quelle.

## 5. Dopo la risposta

| Passo | Conferma |
|---|---|
| Cancellazione della compilazione di prova (conteggio, transazione che si annulla se le righe non sono quelle attese, come HO-024) | sì, tua, puntuale |
| Riga `STATUS:complete` della `1E-W8`, commit e push | sì |
| Chiusura della Fase 1E, poi HO-017 (distruzione dell'istanza di riferimento) | sì, ciascuna |

## 6. Che cosa la UAT non copre

Sicurezza, prestazioni, email, privacy e cookie sono della Fase 1F. MI-06, la verifica
legale, resta aperta e richiede un professionista. L'approvazione non supera da sola il
gate: serve anche il deploy in produzione eseguito e verificato (`deployment-gate`).
