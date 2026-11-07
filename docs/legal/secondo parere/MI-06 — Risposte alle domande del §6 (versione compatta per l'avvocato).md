# MI-06 — Risposte alle domande del §6 (versione compatta)

**Centro per la Famiglia Amoris Laetitia** — bozza di risposta del manutentore, 2026-11-07,
da sottoporre al professionista incaricato della verifica MI-06 (DR-303). Non è un parere
legale: ogni risposta è una regola proposta da confermare, correggere o scartare.

**Legenda Priorità:** **P** = prima della messa in produzione; **S** = può seguire (termine
indicato). **Azione:** **C** = Centro (contratti, nomine, registro); **M** = manutentore
(regole tecniche).

| Dom. | Risposta | Testo | Priorità | Azione |
|---|---|---|---|---|
| **1a** | Iscrizioni: art. 6.1.b (precontrattuale). Adesione: art. 6.1.b. Non sono categorie ex art. 9 di per sé; i campi liberi possono esserlo → trattarli come potenzialmente particolari (RN-02). Trasferimento al nuovo sistema: stesso titolare e finalità, nessun consenso nuovo; verificare l'informativa storica e coprire con l'informativa aggiornata + nota sulle iscrizioni pregresse. | Nota: «Le iscrizioni raccolte con il sito precedente sono conservate solo per finalità amministrative e fiscali.» | P (verifica); nota S 60 gg | C + M |
| **1b** | Iscrizioni e contatto: art. 6.1.b (il contatto anche 6.1.f). Nessun consenso per l'iscrizione. Campi di testo libero: ridurre e avvisare di non inserire dati su salute o terzi; se un modulo richiede dati ex art. 9 strutturati → consenso esplicito 9.2.a, da valutare. | Avviso moduli: «Inviando questo modulo autorizzi il trattamento dei tuoi dati per gestire la tua iscrizione, come descritto nell'Informativa privacy [link]. Ti chiediamo di non inserire informazioni sulla tua salute o su altre persone.» | P | M |
| **1c** | Notifiche email al Centro: stessa base del modulo (1b), non comunicazione a terzi. Il punto critico è il canale in chiaro → vedi 11. | — | P (con 11) | M |
| **2** | Le 425: **ridurre**, non conservare. Finalità residua solo fiscale (art. 2220 c.c., 10 anni): oltre il termine → cancellazione integrale; entro il termine → solo nome, corso, importo, data (via email, telefono, indirizzo, nascita, testo libero, metadati). Se il Centro conferma l'assenza di esigenze fiscali → cancellazione anticipata integrale. Serve conteggio per anno. | — | P (regola); esec. S 30 gg | C (decisione) + M (strumenti) |
| **3a** | Nuove compilazioni: 24 mesi dalla gestione, poi riduzione ai soli dati fiscali fino a 10 anni. Contatto: 12 mesi. Adesione: fino a cessazione + 10 anni. Tempi da dichiarare nell'informativa. | Tempi nell'informativa (A1 versione integrale) | P | M + C |
| **3b** | Registro errori (187 righe) e riga statistiche: nessuna finalità residua → cancellazione al passaggio, niente import nel nuovo sistema. | — | P | M |
| **3c** | Registro attività: 12 mesi a rullo, per l'intera riga (incl. nomi oggetti, DR-315); 24 se rischio elevato. | — | P | M + C |
| **3d** | Bozze redazionali: 12 mesi dall'ultima modifica, poi eliminazione; immediata alla chiusura account. | — | S 90 gg | M |
| **3e** | Backup: la cancellazione non si propaga se (1) regola scritta, (2) dichiarata in informativa, (3) ripristino con bonifica (ri-applicare le cancellazioni). Finestra max = rotazione: 6 mesi. | Menzione nell'informativa | P (regola); proc. S 30 gg | M |
| **4** | Copie: riferimento vecchio sito → subito; salvataggi sviluppo → a migrazione finita (dopo riconciliazione conteggi); backup 2026-09-13 → max 90 gg dalla produzione; vecchio hosting → cancellazione definitiva su richiesta scritta + conferma del fornitore. Prova: conferma del fornitore + verbale firmato con data ed elenco. Poi solo dati sintetici (DR-010). | — | P (richieste); esec. S 90 gg | M (copie, verbali) + C (fornitore) |
| **5a** | Le due pagine non si copiano: vanno riscritte (art. 13 GDPR). Contenuti: titolare e contatti; finalità e basi; categorie dati; destinatari (server UE, backup UE, Aruba; Google e PayPal al clic come titolari autonomi con link); conservazione; sopravvivenza nei backup 6 mesi; diritti e reclamo. Pagina cookie: solo cookie tecnici, nessun tracciamento all'apertura, video/mappa al clic. | Scheletro completo nell'allegato A della versione integrale | P | M + C |
| **5b** | Sì: nota breve sopra il pulsante di invio con link all'informativa. Niente casella di consenso (base 6.1.b, il consenso non è la base). Casella solo dove la base è il consenso (art. 9 strutturato o usi ulteriori). | Come 1b | P | M |
| **5c** | PDF con informativa: aggiornare o ritirare (riferiscono strumenti non più usati). Se restano pubblicati sul nuovo sito → prima della produzione; se ritirati → S 60 gg. | — | P / S 60 gg | C + M |
| **6** | No banner: nessuna terza parte all'apertura e soli cookie tecnici → basta l'informativa (linee guida Garante 231/2021). DR-124 si risolve con la pagina cookie aggiornata. | — | P | M |
| **6a** | Il clic sulla copertina basta se l'immagine è locale (come previsto) e accanto c'è il testo che dichiara il caricamento da Google: azione positiva inequivocabile, nessun cookie non tecnico prima della scelta. Il testo è parte della soluzione. | Video: «Il video è ospitato su YouTube (Google). Caricandolo, i tuoi dati saranno trattati da Google secondo la sua informativa: [link].» Mappa: idem con Google Maps. | P | M |
| **6b** | Cookie tecnico di sessione: solo informativa nella pagina cookie, nessun consenso. | — | P | M |
| **6c** | Future statistiche senza consenso solo se: self-hosted, nessun cookie di terze parti, IP troncato/impronta, aggregati, ≤12 mesi. Altrimenti banner Accetta/Rifiuta (231/2021). Regola da vincolo di progetto. | — | S (se introdotte) | M |
| **7a** | Server (Hetzner/OVHcloud/Aruba): DPA art. 28 prima dell'attivazione. Controlli: data center UE (no UK per OVH), sub-responsabili, misure di sicurezza, notifica violazioni, nessun trasferimento extra-UE senza garanzie, giurisdizione del fornitore. | — | P | C (firma) + M (confronto) |
| **7b** | Backup: DPA art. 28 + sede UE; dichiarare la cifratura pre-invio (DR-298) e verificare il no-accesso in chiaro. Chiave: vedi 12. | — | P | C + M |
| **7c** | Aruba posta: DPA art. 28. Dominio: nessun contratto (dati registrant = Centro). Verificare sede UE. | — | P | C |
| **7d** | Google e PayPal: titolari autonomi, nessun art. 28. Sì, dirlo nell'informativa con link, indicando il caricamento solo su azione della persona. | Come 5a e 6a | P | M |
| **7e** | Servizio del codice: nulla (non riceve dati personali, DR-010). Impegno permanente a mantenerlo così. | — | — | M |
| **8** | Registro: sì, obbligatorio. L'esonero <250 dipendenti non si applica (trattamenti non occasionali, possibili art. 9; associazioni incluse). Voci nuove: iscrizioni corsi; adesione; contatto; area amministrativa; backup; posta/notifiche; migrazione storici. | Schema voci nell'allegato B della versione integrale | P | C (registro) + M (info tecniche) |
| **9** | DPIA: sì, ora per questa fase. Ricorrono i criteri Garante (non occasionale su vulnerabili – minori; possibili categorie particolari collegate ad altri dati). Strutturarla per aggiornamento (non rifacimento) alla fase gestionale. | — | P | C + M |
| **10** | Centro = titolare (confermato). Manutentore = responsabile esterno ex art. 28 → incarico scritto (oggetto, durata, natura, finalità, categorie, misure); alternativa: incaricato interno, ma la qualifica più difendibile è il 28. Area amministrativa = incaricati → nomina scritta con istruzioni e riservatezza, per persona, revocabile. | — | P | C (nomine) + M (testo tecnico) |
| **11** | Compilazioni leggibili solo dal ruolo Amministrazione, da schermata di sola lettura nell'area riservata (non dal database): ruoli, tracciamento, via ordinaria non tecnica. Email consigliata di solo avviso («nuova iscrizione al corso X») con lettura dati via HTTPS; se si mantiene il contenuto in email, accettazione formale del rischio del canale in chiaro. | — | P | C (decisione) + M (implementazione) |
| **12** | Cifratura database: sì, almeno disco (LUKS). Chiave backup: consegna formale a persona designata del Centro (verbale, sostituzione a rotazione) o doppia custodia; l'esclusiva del manutentore con contratti del Centro è criticabile. 2FA: sì, area amministrativa e server (authenticator, no SMS). Dati reali sul computer: solo fino a fine migrazione (vedi 4), disco cifrato; poi solo sintetici. IA: regole attuali adeguate + divieto di trasmettere dati reali e verifica di non-accesso al db di sviluppo. | — | P (disco, 2FA, chiave); S 30 gg (verifiche IA) | M + C (chiave, verbali) |
| **13** | Passaggio: finestra dichiarata (vecchio sito smette di accettare iscrizioni in momento noto); ultimo trasferimento con riconciliazione dei conteggi (righe/valori, senza contenuti); backup di sicurezza pre-spegnimento (copie con scadenza 4); cancellazione definitiva su richiesta scritta al fornitore hosting + conferma; DNS; tutto a verbale nel registro decisioni. Nessuna informativa specifica oltre 1a. | — | P | M (procedura) + C (fornitore) |

---

**Riferimenti normativi principali:** GDPR artt. 6, 9, 13, 28, 30, 35 — Linee guida cookie
del Garante n. 231/2021 — Elenco DPIA del Garante, provvedimento 11.10.2018 — FAQ registro
dei trattamenti del Garante (associazioni) — art. 2220 c.c. (scritture contabili).

*Le risposte confermate diventano regole tecniche del sistema e vengono registrate fra le
decisioni del progetto; i documenti del Centro (contratti, nomine, registro) restano a
carico del Centro. Versione integrale con testi completi e schema del registro:
«MI-06 — Bozza di risposta alle domande del §6».*
