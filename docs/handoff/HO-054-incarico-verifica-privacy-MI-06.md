# HO-054 — Incarico della verifica privacy e legale (MI-06)

Fase 1F, in parallelo con la `1G-W9` (DR-303). Scritto il 2026-10-28.

## 1. Perché serve

La messa in produzione richiede che un professionista (avvocato o consulente privacy)
verifichi come il nuovo sito tratta i dati personali, in particolare le **425
compilazioni** dei moduli trasferite dal sito attuale (DR-026, rischio R-04, input
MI-06, criterio 1F-11). Non è una verifica che l'agente possa fare: può solo preparare
il materiale e poi tradurre il parere in regole tecniche.

Il materiale è pronto: `docs/legal/MI-06-ambito-verifica-privacy.md`. Descrive il sito
di oggi e quello nuovo con sole categorie e conteggi, e pone 13 domande numerate.
**Non contiene dati reali né attesta alcuna conformità.**

## 2. Prerequisiti

| Che cosa | Note |
|---|---|
| Un professionista disponibile | avvocato o consulente con esperienza GDPR, meglio se conosce il terzo settore o le strutture sanitarie e sociali |
| Chi firma l'incarico per il Centro | i contratti sono intestati al Centro (DR-302): l'incarico va conferito da chi lo rappresenta |
| Il documento di ambito letto da te | §1 (titolare) e §3.3 (dove stanno oggi i dati) vanno confermati o corretti prima dell'invio |

## 3. Passi

1. **Rileggi il documento** `docs/legal/MI-06-ambito-verifica-privacy.md`. Controlla
   in particolare:
   - §1: denominazione e natura del Centro, e chi è il titolare;
   - §3.3, tabella «Dove stanno oggi»: che le copie elencate siano tutte quelle che
     esistono (per esempio altri backup del sito attuale presso l'hosting o presso
     il Centro);
   - §3.4: quante persone useranno davvero l'area amministrativa.

   Se qualcosa non torna, dimmelo prima di inviare: correggo il documento.
2. **Individua il professionista** e chiedi un preventivo sul perimetro del §6 del
   documento, escluso quanto elencato al §7.
3. **Conferisci l'incarico** a nome del Centro.
4. **Invia il documento** al professionista, come PDF o come testo. Se vuoi un PDF,
   chiedimelo: lo produco dal file senza cambiarne il contenuto.
5. **Aspetta il parere** nella forma chiesta al §8 del documento (una riga per domanda,
   con risposta, testo, priorità e azione). Se il professionista chiede informazioni
   aggiuntive, girami la richiesta: preparo solo conteggi o dati sintetici.

### Che cosa NON inviare, mai

| Da non inviare | Perché |
|---|---|
| Copie o estratti del database, dump, file di backup del sito | contengono le compilazioni reali |
| Schermate dell'area amministrativa o del database con dati reali | stesso motivo |
| Account, password o accesso all'area amministrativa, al server o all'hosting | il parere non ne ha bisogno; per una dimostrazione si usa il collaudo con dati sintetici |
| Il contenuto di singole compilazioni, anche «come esempio» | per gli esempi esistono le etichette dei campi senza valori |
| File di configurazione del sito attuale o del nuovo | contengono credenziali |

Se il professionista ritiene indispensabile vedere dati reali, fermati e dimmelo: va
deciso a parte, con le cautele del caso.

## 4. Esito atteso

- Incarico conferito a nome del Centro.
- Parere scritto che risponde alle 13 domande del §6, con la priorità di ciascuna.
- Da qui io: registro le risposte nel registro delle decisioni, aggiorno R-04 e MI-06,
  e pianifico le regole tecniche (conservazione, cancellazione, testi, eventuale
  banner) nella Fase 1F. Le azioni che spettano al Centro (contratti con i fornitori,
  nomine, registro dei trattamenti) restano a carico del Centro e le elenco in un
  handoff separato.

## 5. Se qualcosa non va

| Problema | Che cosa fare |
|---|---|
| Non trovi un professionista in tempi brevi | dimmelo: la verifica deve chiudersi **prima della produzione**, non prima della `1G-W9`; si può pianificare la 1F nel frattempo |
| Il preventivo supera il budget | chiedi un parere solo sulle domande che il documento marca come necessarie prima della produzione (base giuridica, conservazione, informative, cookie, fornitori: 1-7); le altre possono seguire |
| Il professionista chiede dati reali | non inviarli; vedi §3, «Che cosa NON inviare» |
| Il parere non risponde a qualche domanda o è ambiguo | girami il parere: preparo le domande di chiarimento |
| Il parere chiede di cancellare dati | non cancellare nulla da solo: ogni cancellazione richiede la tua conferma puntuale con comando, backup e verifica |

## 6. Come segnalare il completamento

In due momenti:

```
HO-054: incarico affidato. Professionista: <avvocato | consulente>, risposta attesa entro <data>.
```

e, quando arriva il parere:

```
HO-054: parere ricevuto. Allego il testo (oppure: lo trovi in <percorso fuori dal repository>).
```

Non scrivere il nome del professionista se non vuoi: basta il ruolo. Se il parere
contiene dati personali, non metterlo nel repository: indicami solo dove si trova.
