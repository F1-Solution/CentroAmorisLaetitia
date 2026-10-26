# HO-032 — Installare `qpdf` sulla macchina di sviluppo (`1G-W6`, T5)

Fase 1G, wave `1G-W6`. Scritto il 2026-10-26.

Serve prima della T5 della `1G-W6`. Le attività T1-T4c non ne hanno bisogno: puoi farlo
quando vuoi, mentre la wave prosegue.

---

## 1. Perché serve

Con DR-254 e DR-258 (D154 = A) ogni PDF caricato o sostituito dal CMS si ripulisce con
`qpdf`, e ogni MP4 con `ffmpeg`, prima di essere salvato. Così autore, programma, date e
posizione non finiscono sul sito.

| Programma | Sulla macchina di sviluppo | Licenza dichiarata dal progetto |
|---|---|---|
| `ffmpeg` | c'è già, 9.0.2 (pacchetto winget `Gyan.FFmpeg`) | LGPL o GPL secondo la compilazione: da far verificare a una persona prima della 1F |
| `qpdf` | **manca** | Apache-2.0 |

Senza `qpdf`, le prove della T5 non girano in locale, e l'API di sviluppo rifiuta i PDF
con il messaggio «Il caricamento di PDF e video è sospeso…». Le immagini non ne dipendono.

L'installazione non tocca il repository, il database né i dati del Centro. Scarica il
programma dal catalogo di winget.

## 2. Che cosa fai

In PowerShell:

```powershell
winget install --id QPDF.QPDF -e --source winget
```

Se Windows chiede i permessi di amministratore, accetta. Poi **chiudi e riapri**
PowerShell, perché il nuovo `PATH` vale solo per le finestre aperte dopo, ed esegui:

```powershell
qpdf --version
ffmpeg -hide_banner -version | Select-Object -First 1
```

## 3. Esito atteso

| Controllo | Atteso |
|---|---|
| `qpdf --version` | prima riga `qpdf version 12.4.2`, o una versione successiva |
| `ffmpeg … -version` | `ffmpeg version 9.0.2-full_build-www.gyan.dev …` |

## 4. Se qualcosa va storto

| Problema | Che cosa fare |
|---|---|
| `winget` risponde che il pacchetto non esiste | `winget source update`, poi ripeti il comando del §2 |
| dopo aver riaperto PowerShell, `qpdf` non si trova | cercalo con `Get-ChildItem 'C:\Program Files' -Recurse -Filter qpdf.exe -ErrorAction SilentlyContinue \| Select-Object -First 1 -ExpandProperty FullName`. Poi aggiungi al file `.env` nella radice del repository la riga `QPDF_PATH=` seguita dal percorso trovato. Non incollare il contenuto di `.env` nella chat |
| l'installazione chiede i permessi e non li hai | scrivimelo: valutiamo insieme l'archivio portatile di `qpdf` |
| un altro errore | incolla il messaggio: non serve che lo interpreti tu |

## 5. Che cosa faccio io dopo

- Ritrovo `qpdf` anche se la mia sessione è nata prima dell'installazione.
- Scrivo le versioni in `PROGRESS.md` e in ADR-012.
- Eseguo la T5 con le prove sui file sintetici.

In CI i due programmi li installa il flusso di GitHub Actions (T5): lì non devi fare
nulla.

## 6. Come segnalare il completamento

```
HO-032: fatto
```

Aggiungi le due righe di versione del §3. Non servono percorsi né altro.

## 7. Esito (2026-10-26)

L'utente ha segnalato `HO-032: fatto` con `qpdf version 12.4.2`.

| Controllo | Esito |
|---|---|
| `qpdf.exe` | `C:\Program Files\qpdf 12.4.2\bin\qpdf.exe`, `qpdf version 12.4.2` |
| `ffmpeg` | `ffmpeg version 9.0.2-full_build-www.gyan.dev`, nel `PATH` |
| `qpdf` nel `PATH` di sistema o dell'utente | **no**: le prove e i server di sviluppo lo ricevono con `QPDF_PATH` |

## 8. Consiglio (non bloccante)

L'API di sviluppo avviata dagli script dell'agente riceve `QPDF_PATH` da sola. Se avvii tu
l'API in un altro modo, aggiungi al file `.env` nella radice del repository la riga:

```
QPDF_PATH=C:/Program Files/qpdf 12.4.2/bin/qpdf.exe
```

Senza questa riga, quell'API rifiuta ogni PDF e MP4 con il messaggio «Il caricamento di PDF e
video è sospeso…». In alternativa aggiungi `C:\Program Files\qpdf 12.4.2\bin` al `PATH`.
Non incollare il contenuto di `.env` nella chat.
