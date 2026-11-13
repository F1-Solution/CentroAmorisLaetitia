# HO-063 — Record DNS dello staging e primo certificato di prova (Fase 1F, W5)

**Stato:** 📝 **bozza**, da eseguire nella `1F-W5` T6 dopo HO-062. Non eseguire prima che il
documento passi a «da eseguire». È una **modifica DNS**: richiede la tua conferma puntuale (§4).

**Scopo:** far puntare `staging.centroamorislaetitia.it` al server (DR-440), con il **solo** record
A (DR-441), e attivare il nome nell'ingresso comune con la directory ACME **di prova** di
Let's Encrypt. Il certificato vero si chiede nella T7. Questo handoff **non** tocca `www`, il
dominio radice, la posta (MX) né altri record.

**Stile:** come HO-056: una azione per passo, forma imperativa. Un'AVVERTENZA indica un rischio per
il sito o per la posta del Centro. Avvertenze e attenzioni sono sempre **prima** del passo.

**Dove si lavora:** i passi segnati **[PC]** in PowerShell; **[Aruba]** nel pannello del dominio,
con l'account del Centro che ha il dominio (DR-354); **[server]** sul server, in `bash`, come
`gestore` (HO-062).

**Fonti dei nomi dell'interfaccia:** i nomi del pannello DNS di Aruba di questo documento non sono
stati verificati sull'interfaccia. Se un nome non corrisponde, usa la voce con lo stesso
significato e scrivi la differenza nella segnalazione (§10).

---

## 1. Decisioni già prese

| Id | Decisione | Esito |
|---|---|---|
| D226 | Accesso allo staging | **DR-375**: sottodominio con password davanti a tutto lo staging |
| D295 | Porte 80 e 443 | **DR-409**: l'ingresso comune tiene i certificati; directory ACME di prova prima di quella vera |
| D304 | Nome dello staging | **DR-440**: `staging.centroamorislaetitia.it` |
| D305 | IPv6 | **DR-441**: solo record A nella W5, **nessun AAAA**; IPv6 rivalutato nella W8 |

## 2. Fatti letti dall'agente il 2026-11-13 (DNS pubblico, sola lettura)

| Voce | Valore |
|---|---|
| Nameserver del dominio | `dns.technorail.com`, `dns2.technorail.com`, `dns3.arubadns.net`, `dns4.arubadns.cz` (Aruba) |
| `staging.centroamorislaetitia.it` | non esiste |
| Record jolly (`*`) | nessuno |
| Record CAA | nessuno: Let's Encrypt è ammesso |
| `www.centroamorislaetitia.it` | A e AAAA, TTL 3600 (vecchio hosting, da non toccare fino alla W8) |
| TTL della risposta negativa (SOA) | 3600 secondi: un resolver che ha già cercato `staging` può rispondere «non esiste» fino a un'ora |

## 3. Prerequisiti

- [ ] HO-062 chiuso: firewall con 80 e 443 aperte, ingresso comune avviato senza nomi.
- [ ] L'indirizzo IPv4 del server (HO-056 §7). Non è segreto.
- [ ] Accesso all'area clienti Aruba del dominio `centroamorislaetitia.it`.
- [ ] 30 minuti, più fino a un'ora di attesa per la propagazione.

## 4. Riepilogo per la conferma

Prima del §6, scrivi all'agente `Confermo HO-063` oppure fermati. La conferma vale solo per questo
record.

| Voce | Valore |
|---|---|
| Azione | nuovo record `A` `staging.centroamorislaetitia.it` → `<IPv4>`, TTL predefinito del pannello |
| Record toccati | solo questo; nessun AAAA, nessuna modifica a `www`, alla radice, a MX o TXT |
| Impatto | lo staging diventa raggiungibile per nome; risponde 502 finché lo staging non è avviato (T7), poi con password |
| Copia di sicurezza | elenco dei record prima della modifica (§5) |
| Ritorno indietro | cancella il record `staging` dal pannello (§9) e togli il nome dall'ingresso (§9) |
| Verifica | §7 e §8 |

## 5. Procedura A — Controlli prima della modifica

1. **[PC]** Salva le risposte di oggi, per confrontarle dopo:

   ```powershell
   $prima = Resolve-DnsName www.centroamorislaetitia.it -Server dns.technorail.com | Select-Object Name, Type, IPAddress | Out-String
   $prima
   Resolve-DnsName staging.centroamorislaetitia.it -Server dns.technorail.com -ErrorAction SilentlyContinue
   ```

   **Esito atteso:** `www` con una riga A e una AAAA; per `staging` nessuna risposta. Tieni la
   finestra aperta fino al §7: `$prima` serve lì.

2. **[Aruba]** Apri il pannello DNS del dominio (area clienti → domini → `centroamorislaetitia.it`
   → gestione DNS). Conta i record presenti e scrivi il numero sul foglio. Non cambiare niente.

## 6. Procedura B — Crea il record A

> **AVVERTENZA:** Non modificare e non cancellare nessun record esistente. Un errore su `www`, sulla
> radice o su MX ferma il sito attuale o la posta del Centro.

1. **[Aruba]** Aggiungi un record nuovo con questi valori:

   | Campo | Valore |
   |---|---|
   | Tipo | `A` |
   | Nome (host) | `staging` (alcuni pannelli lo chiedono intero: `staging.centroamorislaetitia.it`) |
   | Valore (indirizzo) | `<IPv4>` del server |
   | TTL | il valore predefinito del pannello |

2. **[Aruba]** Salva. **Non** aggiungere un record AAAA (DR-441).
3. **[Aruba]** Conta di nuovo i record. **Esito atteso:** il numero del §5.2 più uno.

## 7. Procedura C — Verifica del DNS

1. **[PC]** Chiedi al nameserver di Aruba e a un resolver pubblico:

   ```powershell
   Resolve-DnsName staging.centroamorislaetitia.it -Type A -Server dns.technorail.com
   Resolve-DnsName staging.centroamorislaetitia.it -Type A -Server 1.1.1.1
   Resolve-DnsName staging.centroamorislaetitia.it -Type AAAA -Server dns.technorail.com -ErrorAction SilentlyContinue
   ```

   **Esito atteso:** le prime due righe rispondono con `<IPv4>`; la terza non dà indirizzi IPv6. Se
   `1.1.1.1` risponde ancora «non esiste», attendi fino a un'ora (§2) e ripeti.

2. **[PC]** Controlla che `www` non sia cambiato:

   ```powershell
   $dopo = Resolve-DnsName www.centroamorislaetitia.it -Server dns.technorail.com | Select-Object Name, Type, IPAddress | Out-String
   $prima -eq $dopo
   ```

   **Esito atteso:** `True`.

## 8. Procedura D — Nome dello staging nell'ingresso, con la directory ACME di prova

1. **[server]** Controlla che l'ingresso usi ancora la directory di prova:

   ```bash
   grep -c '^INGRESS_ACME_CA=https://acme-staging-v02.api.letsencrypt.org/directory$' /opt/amoris/ingresso/ingresso.env
   ```

   **Esito atteso:** `1`. Se stampa `0`, fermati: con la directory vera un errore consuma i tetti di
   Let's Encrypt.

2. **[server]** Scrivi il nome dello staging:

   ```bash
   sudo sed -i 's/^INGRESS_STAGING_NAME=.*/INGRESS_STAGING_NAME=staging.centroamorislaetitia.it/' /opt/amoris/ingresso/ingresso.env
   grep -c '^INGRESS_STAGING_NAME=staging.centroamorislaetitia.it$' /opt/amoris/ingresso/ingresso.env
   grep -c '^INGRESS_PRODUCTION_NAME=$' /opt/amoris/ingresso/ingresso.env
   ```

   **Esito atteso:** `1` e `1`: il nome della produzione resta vuoto fino alla W8.

3. **[server]** Ricrea l'ingresso (con nomi nuovi `up -d` da solo non basta, README §3):

   ```bash
   sudo docker compose -f /opt/amoris/ingresso/compose.yml --env-file /opt/amoris/ingresso/ingresso.env up -d --wait --force-recreate ingresso
   ```

4. **[server]** Dopo un minuto, controlla che il certificato di prova sia arrivato:

   ```bash
   sudo docker compose -f /opt/amoris/ingresso/compose.yml --env-file /opt/amoris/ingresso/ingresso.env logs --since 10m ingresso 2>&1 | grep -c 'certificate obtained successfully'
   ```

   **Esito atteso:** `1` o più.

5. **[PC]** Controlla le risposte dall'esterno. `-k` serve perché il certificato di prova non è
   fidato dai browser:

   ```powershell
   curl.exe -s -o NUL -w "%{http_code}`n" http://staging.centroamorislaetitia.it/
   curl.exe -sk -o NUL -w "%{http_code}`n" https://staging.centroamorislaetitia.it/
   ```

   **Esito atteso:** `308` (da HTTP a HTTPS) e `502` (lo staging non è ancora avviato: lo avvia la T7).

## 9. Che cosa fare se qualcosa non va

| Sintomo | Causa probabile | Cosa fare |
|---|---|---|
| Il pannello rifiuta il nome `staging` | il pannello vuole il nome intero, o il contrario | prova l'altra forma del §6.1 |
| Il §7.1 non risponde dopo un'ora | record salvato con un nome diverso | controlla il nome nel pannello; non creare un secondo record |
| `$prima -eq $dopo` dà `False` | un record di `www` è cambiato | **fermati**; non fare altre modifiche e segnala subito le due uscite |
| Il §8.4 stampa `0` | DNS non ancora propagato, porta 80 chiusa, nome scritto male | attendi 10 minuti e ripeti; poi `... logs --since 10m ingresso 2>&1 \| grep -i error \| tail -n 5` e incolla le righe |
| Il §8.5 dà `000` | nome non attivo nell'ingresso, firewall o ingresso fermo | ricontrolla il §8.2 e ripeti il §8.3; poi `sudo ufw status` e `sudo docker ps` e segnala l'uscita |

**Ritorno indietro:** nel pannello cancella il solo record `staging`. Sul server riporta il nome a
vuoto e ricrea l'ingresso:

```bash
sudo sed -i 's/^INGRESS_STAGING_NAME=.*/INGRESS_STAGING_NAME=/' /opt/amoris/ingresso/ingresso.env
sudo docker compose -f /opt/amoris/ingresso/compose.yml --env-file /opt/amoris/ingresso/ingresso.env up -d --wait --force-recreate ingresso
```

## 10. Come segnalare il completamento

```text
HO-063 fatto.
Data: <data>
Conferma data in chat: sì
Record nel pannello: <numero prima> → <numero dopo>
staging A: <IPv4> da dns.technorail.com e da 1.1.1.1; AAAA: nessuno
www invariato ($prima -eq $dopo): True
Directory ACME: di prova (grep 1); nome della produzione vuoto (grep 1)
Certificato di prova: grep <numero>
HTTP: <codice>; HTTPS: <codice>
Differenze fra i nomi di questo documento e il pannello: <elenco o «nessuna»>
```

## 11. Esito

Da compilare dopo la segnalazione.
