# Crea (o ripristina, o rimuove) l'ambiente di collaudo: copia del database e dei bucket, compilazioni e sessioni svuotate,
# account copiati disattivati e senza password utilizzabile, copia di lavoro Git sul commit da collaudare.
# Stampa solo conteggi, mai nomi, indirizzi o valori.
#Requires -Version 7.3
[CmdletBinding()]
param(
  # Commit da collaudare (sha). Obbligatorio, tranne con -Rimuovi.
  [string]$Commit,
  [string]$Database = 'amoris_collaudo',
  [string]$PrefissoBucket = 'collaudo',
  [string]$Worktree = 'C:\work\amoris-collaudo',
  [int]$PortaSito = 3300,
  [int]$PortaArea = 3301,
  [int]$PortaApi = 3302,
  # Conferma testuale: il nome del database. Il controller la usa solo dopo la conferma dell'utente in chat.
  [string]$ConfermaScritta,
  # Cancella database, bucket e copia di lavoro del collaudo e si ferma.
  [switch]$Rimuovi,
  # Rifà la copia di lavoro anche se il commit non è cambiato.
  [switch]$RifaiWorktree,
  # Stampa i passi e i comandi senza scrivere nulla (restano solo le letture di controllo).
  [Alias('WhatIf')][switch]$Simula
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'comune.ps1')

# Tabelle confrontate fra sviluppo e collaudo dopo la copia e la pulizia. `form_submissions` si confronta con le righe svuotate.
$tabelle = @(
  'contents', 'content_revisions', 'content_seo', 'content_terms', 'documents', 'form_notifications',
  'forms', 'media', 'media_variants', 'menu_items', 'menus', 'redirects', 'settings',
  'slider_slides', 'sliders', 'terms', 'user_roles', 'users', 'audit_log'
)
$sqlConteggi = (($tabelle + 'form_submissions' | ForEach-Object { "SELECT '$_=' || count(*) FROM $_" }) -join ' UNION ALL ') + ' ORDER BY 1;'

# S9: compilazioni e sessioni si svuotano; gli account copiati si disattivano (non si cancellano) e la loro password diventa inutilizzabile (`password_hash` nullo: l'accesso la rifiuta).
$sqlPulizia = @'
BEGIN;
CREATE TEMP TABLE esito (chiave text, n bigint);
WITH d AS (DELETE FROM form_submissions RETURNING 1) INSERT INTO esito SELECT 'compilazioni', count(*) FROM d;
WITH d AS (DELETE FROM sessions RETURNING 1) INSERT INTO esito SELECT 'sessioni', count(*) FROM d;
WITH u AS (UPDATE users SET is_active = false, updated_at = now() WHERE is_active RETURNING 1) INSERT INTO esito SELECT 'disattivati', count(*) FROM u;
WITH u AS (UPDATE users SET password_hash = NULL, updated_at = now() WHERE password_hash IS NOT NULL RETURNING 1) INSERT INTO esito SELECT 'senza_password', count(*) FROM u;
COMMIT;
SELECT chiave || '=' || n FROM esito
UNION ALL SELECT 'compilazioni_rimaste=' || count(*) FROM form_submissions
UNION ALL SELECT 'attivi_rimasti=' || count(*) FROM users WHERE is_active
UNION ALL SELECT 'password_rimaste=' || count(*) FROM users WHERE password_hash IS NOT NULL;
'@

# Dump con nome unico dentro il contenitore, cancellato anche in caso di errore.
$copioneCopia = @'
f=$(mktemp /tmp/collaudo.XXXXXX) || exit 1
trap 'rm -f $f' EXIT INT TERM
pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc -f $f && pg_restore -U $POSTGRES_USER -d $0 --exit-on-error $f
'@

function ConvertTo-Conteggi {
  param([string[]]$Righe)
  $mappa = [ordered]@{}
  foreach ($riga in $Righe) {
    if ($riga -cmatch '^([a-z_]+)=(\d+)\z') { $mappa[$Matches[1]] = [long]$Matches[2] }
  }
  return $mappa
}

function Remove-Worktree {
  # Solo la copia di lavoro del collaudo: niente `git worktree prune` globale.
  param([string]$Percorso)
  $registrata = (Get-WorktreeRegistrati) -contains $Percorso
  if ($registrata) { & git -C $script:Radice worktree remove --force $Percorso *> $null }
  elseif (Test-Path -LiteralPath $Percorso) {
    throw 'La cartella del collaudo esiste ma non è una copia di lavoro registrata: non la tocco.'
  }
  if (Test-Path -LiteralPath $Percorso) { Remove-Item -LiteralPath $Percorso -Recurse -Force }
  if ((Get-WorktreeRegistrati) -contains $Percorso) {
    $amministrative = Join-Path $script:Radice '.git\worktrees'
    foreach ($cartella in @(Get-ChildItem -LiteralPath $amministrative -Directory)) {
      $punta = (Get-Content -LiteralPath (Join-Path $cartella.FullName 'gitdir') -Raw).Trim() -replace '/', '\'
      if ($punta -ieq "$Percorso\.git") { Remove-Item -LiteralPath $cartella.FullName -Recurse -Force }
    }
  }
  if (Test-Path -LiteralPath "$Percorso.stato") { Remove-Item -LiteralPath "$Percorso.stato" -Recurse -Force }
}

function Remove-BucketDiCollaudo {
  param([string[]]$Bucket)
  foreach ($nome in $Bucket) {
    if ($nome -cnotmatch '^collaudo(-[a-z0-9]+)*-(public|private)\z' -or ($script:BucketSviluppo -ccontains $nome)) {
      throw 'rb rifiutato: il nome non è quello di un bucket di collaudo.'
    }
    if ((Invoke-Mc -Argomenti @('ls', "local/$nome") -Tollerante).Codice -eq 0) {
      Invoke-Mc -Argomenti @('rb', '--force', "local/$nome") | Out-Null
    }
  }
}

function Confirm-Cancellazione {
  param([string]$NomeAtteso, [string]$Scritta)
  if ($Scritta) {
    if ($Scritta -cne $NomeAtteso) { throw 'La conferma scritta non coincide con il nome del database del collaudo.' }
    return
  }
  if (-not [Environment]::UserInteractive) { throw 'Serve la conferma scritta (-ConfermaScritta) e non c''è un terminale interattivo.' }
  $risposta = Read-Host "L'ambiente di collaudo esiste e verrà CANCELLATO. Per confermare scrivi il nome del database ($NomeAtteso)"
  if ($risposta -cne $NomeAtteso) { throw 'Conferma non corrispondente: non ho cancellato nulla.' }
}

# --- 1. Controlli preliminari (solo letture) ------------------------------------------------------------------------
Write-Passo '1. Controlli preliminari (solo letture)'
if ($Simula) { Write-Host '   MODALITA SIMULAZIONE: nessuna scrittura; restano solo le letture di controllo.' }
Assert-RadiceDiSviluppo
foreach ($programma in @('docker', 'git', 'pnpm')) {
  if (-not (Get-Command $programma -ErrorAction SilentlyContinue)) { throw "$programma non è nel PATH." }
}
Assert-ContenitoriPronti
Initialize-NomiDiSviluppo
$Worktree = Get-PercorsoCompleto $Worktree
Assert-NomiDiCollaudo -Database $Database -PrefissoBucket $PrefissoBucket -Worktree $Worktree
$script:DirStato = "$Worktree.stato"
$bucketCollaudo = @("$PrefissoBucket-public", "$PrefissoBucket-private")
$bucketCoppie = @(
  [pscustomobject]@{ Da = $script:BucketSviluppo[0]; A = $bucketCollaudo[0] },
  [pscustomobject]@{ Da = $script:BucketSviluppo[1]; A = $bucketCollaudo[1] }
)

# Memoria limitata e nessuna scrittura mentre lo sviluppo lavora: i server di sviluppo devono essere spenti.
$sviluppoAcceso = @($script:PorteSviluppo | Where-Object { Test-PortaInAscolto $_ })
if ($sviluppoAcceso.Count -gt 0) {
  $messaggio = "Ci sono $($sviluppoAcceso.Count) server di sviluppo accesi (porte 3000, 3001, 3002, 3200): fermali prima."
  if ($Simula) { Write-Host "   ATTENZIONE: $messaggio" } else { throw $messaggio }
}

$sha = $null
if (-not $Rimuovi) {
  if (-not $Commit) { throw 'Serve -Commit <sha> (oppure usa -Rimuovi).' }
  $sha = (& git -C $script:Radice rev-parse --verify --quiet "$Commit^{commit}")
  if ($LASTEXITCODE -ne 0 -or -not $sha) { throw 'Il commit indicato non esiste in questo repository.' }
  # Un commit uguale a HEAD con codice modificato e non salvato non rappresenta ciò che c'è sul disco.
  $testa = (& git -C $script:Radice rev-parse HEAD)
  if ($sha -ceq $testa) {
    $modificati = @(& git -C $script:Radice status --porcelain --untracked-files=no -- apps packages pnpm-lock.yaml)
    if ($modificati.Count -gt 0) {
      throw "Il commit coincide con HEAD ma $($modificati.Count) file in apps, packages o pnpm-lock.yaml sono modificati e senza commit: il collaudo non conterrebbe quel codice. Fai prima il commit."
    }
  }
}

$esisteDb = Get-DatabaseEsiste $Database
$esistonoBucket = @($bucketCollaudo | Where-Object { (Invoke-Mc -Argomenti @('ls', "local/$_") -Tollerante).Codice -eq 0 })
$worktreeRegistrata = (Get-WorktreeRegistrati) -contains $Worktree
$esisteCartella = Test-Path -LiteralPath $Worktree
$esiste = $esisteDb -or ($esistonoBucket.Count -gt 0) -or $worktreeRegistrata
Write-Host "   database del collaudo presente: $(if ($esisteDb) { 'si' } else { 'no' }); bucket presenti: $($esistonoBucket.Count)/2; copia di lavoro registrata: $(if ($worktreeRegistrata) { 'si' } else { 'no' })"
if ($esisteCartella -and -not $worktreeRegistrata) { throw 'La cartella del collaudo esiste ma non è una copia di lavoro registrata: non la tocco.' }

$inAscolto = @(@($PortaSito, $PortaArea, $PortaApi) | Where-Object { Test-PortaInAscolto $_ })
if ($inAscolto.Count -gt 0) {
  $messaggio = "Il collaudo è acceso su $($inAscolto.Count) delle 3 porte: esegui tools\collaudo\ferma.ps1 prima."
  if ($Simula) { Write-Host "   ATTENZIONE: $messaggio" } else { throw $messaggio }
}

# --- Rimozione -----------------------------------------------------------------------------------------------------
if ($Rimuovi) {
  Write-Passo '2. Rimozione dell''ambiente di collaudo (database, 2 bucket, copia di lavoro)'
  if (-not $esiste -and -not $esisteCartella) {
    if (Test-Path -LiteralPath $script:DirStato) {
      if ($Simula) { Write-Host '   simulato: toglierei la cartella dei log' }
      else { Remove-Item -LiteralPath $script:DirStato -Recurse -Force; Write-Host '   Tolta la cartella dei log rimasta.' }
    }
    else { Write-Host '   Niente da rimuovere.' }
    return
  }
  if ($Simula) {
    Write-Host '   simulato: DROP DATABASE <collaudo> WITH (FORCE); mc rb --force su 2 bucket; git worktree remove --force'
    return
  }
  Confirm-Cancellazione -NomeAtteso $Database -Scritta $ConfermaScritta
  Remove-DatabaseDiCollaudo -Database $Database
  Remove-BucketDiCollaudo -Bucket $bucketCollaudo
  Remove-Worktree -Percorso $Worktree
  Write-Host '   Ambiente rimosso: 1 database, 2 bucket, 1 copia di lavoro.'
  return
}

# --- 2. Cancellazione dell'ambiente esistente ----------------------------------------------------------------------
Write-Passo '2. Ambiente esistente (S10: si cancella e si ricrea; la copia di lavoro si tiene se il commit è lo stesso)'
if ($esiste) {
  if ($Simula) {
    Write-Host '   simulato: conferma scritta, poi DROP DATABASE <collaudo> WITH (FORCE) e mc rb --force sui bucket di collaudo.'
  }
  else {
    Confirm-Cancellazione -NomeAtteso $Database -Scritta $ConfermaScritta
    Remove-DatabaseDiCollaudo -Database $Database
    Remove-BucketDiCollaudo -Bucket $bucketCollaudo
    Write-Host '   Database e bucket di collaudo cancellati.'
  }
}
else { Write-Host '   Nessun ambiente esistente.' }

# --- 3-4. Copia del database, pulizia S9 e confronto ---------------------------------------------------------------
# pg_dump + pg_restore dentro il contenitore: legge dallo sviluppo senza bloccarlo (CREATE DATABASE ... TEMPLATE vorrebbe zero connessioni alla sorgente).
# A qualunque errore la sola copia di collaudo si cancella, con lo stesso controllo del nome.
Write-Passo '3. Copia del database di sviluppo (pg_dump -Fc e pg_restore dentro il contenitore, file temporaneo cancellato anche in caso di errore)'
Write-Passo '4. S9 subito dopo la copia (compilazioni e sessioni svuotate, account disattivati e senza password), poi confronto dei conteggi'
$conteggiSviluppo = $null
$conteggiCollaudo = $null
$pulizia = $null
if ($Simula) {
  Write-Host "   simulato: CREATE DATABASE ""$Database"" TEMPLATE template0;"
  Write-Host '   simulato: docker exec <db> sh -c <mktemp; trap rm; pg_dump -Fc -f <file> && pg_restore --exit-on-error -d <collaudo> <file>>'
  Write-Host '   simulato: DELETE FROM form_submissions; DELETE FROM sessions; UPDATE users SET is_active = false; UPDATE users SET password_hash = NULL (una transazione, solo collaudo).'
  Write-Host "   simulato: SELECT count(*) su $($tabelle.Count + 1) tabelle in sviluppo e in collaudo, devono coincidere (compilazioni: righe svuotate = righe di sviluppo)."
  Write-Host '   simulato: in caso di errore, DROP DATABASE della sola copia di collaudo.'
}
else {
  $creato = $false
  try {
    Invoke-Sql -Database 'postgres' -Sql "CREATE DATABASE ""$Database"" TEMPLATE template0;" | Out-Null
    $creato = $true
    $conteggiSviluppo = ConvertTo-Conteggi (Invoke-Sql -Database $script:DbSviluppo -Sql $sqlConteggi)
    $uscita = & docker exec $script:ContenitoreDb sh -c $copioneCopia $Database 2>&1
    $codice = $LASTEXITCODE
    if ($codice -ne 0) { throw "Copia del database non riuscita: $(Get-MessaggioErrore -Righe @($uscita | ForEach-Object { "$_" }) -Codice $codice -Sigla 'restore')" }

    $pulizia = ConvertTo-Conteggi (Invoke-Sql -Database $Database -Sql $sqlPulizia)
    if ($pulizia['compilazioni_rimaste'] -ne 0 -or $pulizia['attivi_rimasti'] -ne 0 -or $pulizia['password_rimaste'] -ne 0) {
      throw 'La pulizia del database non è completa.'
    }

    $sqlLocale = 'SELECT datlocprovider::text || coalesce(datlocale, ''-'') FROM pg_database WHERE datname = current_database();'
    if ((Invoke-Sql -Database $script:DbSviluppo -Sql $sqlLocale)[0] -cne (Invoke-Sql -Database $Database -Sql $sqlLocale)[0]) {
      throw 'La collazione del database di collaudo non coincide con quella di sviluppo.'
    }

    $conteggiCollaudo = ConvertTo-Conteggi (Invoke-Sql -Database $Database -Sql $sqlConteggi)
    $diverse = @($tabelle | Where-Object { $conteggiSviluppo[$_] -ne $conteggiCollaudo[$_] })
    if ($diverse.Count -gt 0) { throw "La copia del database non è fedele: $($diverse.Count) tabelle con conteggi diversi." }
    if ($pulizia['compilazioni'] -ne $conteggiSviluppo['form_submissions']) { throw 'Le compilazioni svuotate non coincidono con quelle di sviluppo.' }
    Write-Host "   Copia completata, collazione identica; $($tabelle.Count + 1) tabelle confrontate, 0 con conteggi diversi."
  }
  catch {
    $errore = $_
    if ($creato) {
      try { Remove-DatabaseDiCollaudo -Database $Database; Write-Host '   Copia incompleta cancellata.' }
      catch { Write-Host '   ATTENZIONE: la copia incompleta non si è cancellata: usa crea.ps1 -Rimuovi.' }
    }
    throw $errore
  }
}

# --- 5. Copia dei bucket -------------------------------------------------------------------------------------------
Write-Passo '5. Copia dei bucket (mc mirror dentro il contenitore MinIO; nessun file passa dal repository; nessun accesso anonimo)'
$oggettiCopiati = 0
$oggettiSviluppo = 0
if ($Simula) {
  Write-Host '   simulato: per ciascuno dei 2 bucket: mc mb, mc anonymous set none, mc mirror <sviluppo> <collaudo>, poi conteggio degli oggetti.'
}
else {
  foreach ($coppia in $bucketCoppie) {
    Invoke-Mc -Argomenti @('mb', "local/$($coppia.A)") | Out-Null
    Invoke-Mc -Argomenti @('anonymous', 'set', 'none', "local/$($coppia.A)") | Out-Null
    Invoke-Mc -Argomenti @('mirror', "local/$($coppia.Da)", "local/$($coppia.A)") | Out-Null
    $politica = (Invoke-Mc -Argomenti @('anonymous', 'get', "local/$($coppia.A)")).Righe -join ' '
    if ($politica -cnotmatch 'private') { throw 'Un bucket di collaudo non risulta privato.' }
    $da = (Invoke-Mc -Argomenti @('ls', '--recursive', "local/$($coppia.Da)")).Righe.Count
    $a = (Invoke-Mc -Argomenti @('ls', '--recursive', "local/$($coppia.A)")).Righe.Count
    if ($da -ne $a) { throw "Copia dei bucket non fedele: $a oggetti copiati su $da." }
    $oggettiSviluppo += $da
    $oggettiCopiati += $a
  }
  Write-Host '   2 bucket creati senza accesso anonimo e copiati.'
}

# --- 6. Copia di lavoro Git ----------------------------------------------------------------------------------------
Write-Passo "6. Copia di lavoro Git staccata sul commit da collaudare ($($sha.Substring(0, 8)))"
$tenuta = $false
if ($worktreeRegistrata -and -not $RifaiWorktree) {
  $testaCollaudo = (& git -C $Worktree rev-parse HEAD)
  $modificata = @(& git -C $Worktree status --porcelain --untracked-files=no)
  $tenuta = ($testaCollaudo -ceq $sha) -and ($modificata.Count -eq 0)
}
if ($Simula) {
  Write-Host "   simulato: $(if ($tenuta) { 'copia di lavoro già sul commit e pulita: si tiene' } elseif ($worktreeRegistrata) { 'copia di lavoro da rifare: git worktree remove --force, poi git worktree add --detach' } else { 'git worktree add --detach <cartella> <commit>' })"
}
else {
  if ($tenuta) { Write-Host '   Copia di lavoro già sul commit e pulita: la tengo (installazione e compilazioni restano).' }
  else {
    if ($worktreeRegistrata) { Remove-Worktree -Percorso $Worktree }
    & git -C $script:Radice worktree add --detach $Worktree $sha *> $null
    if ($LASTEXITCODE -ne 0) { throw 'git worktree add non riuscito.' }
    Write-Host '   Copia di lavoro creata.'
  }
}

# --- 7. Installazione ----------------------------------------------------------------------------------------------
Write-Passo '7. Installazione delle dipendenze nella copia di lavoro (pnpm install --frozen-lockfile)'
if ($Simula) { Write-Host '   simulato: pnpm install --frozen-lockfile nella copia di lavoro, log nella cartella <copia>.stato.' }
else {
  New-Item -ItemType Directory -Force $script:DirStato | Out-Null
  Push-Location $Worktree
  try {
    & pnpm install --frozen-lockfile *> (Join-Path $script:DirStato 'install.log')
    if ($LASTEXITCODE -ne 0) { throw "pnpm install non riuscito: vedi $script:DirStato\install.log" }
  }
  finally { Pop-Location }
  Write-Host '   Dipendenze installate.'
}

# --- Riepilogo -----------------------------------------------------------------------------------------------------
Write-Passo 'Riepilogo (solo conteggi)'
if ($Simula) {
  Write-Host '   Simulazione finita: nessuna scrittura eseguita.'
}
else {
  Write-Host "   contenuti: $($conteggiCollaudo['contents']) (sviluppo $($conteggiSviluppo['contents']))"
  Write-Host "   media: $($conteggiCollaudo['media']) (sviluppo $($conteggiSviluppo['media']))"
  Write-Host "   oggetti copiati: $oggettiCopiati (sviluppo $oggettiSviluppo)"
  Write-Host "   compilazioni svuotate: $($pulizia['compilazioni'])"
  Write-Host "   sessioni tolte: $($pulizia['sessioni'])"
  Write-Host "   account disattivati: $($pulizia['disattivati']) (attivi rimasti: $($pulizia['attivi_rimasti']))"
  Write-Host "   password rese inutilizzabili: $($pulizia['senza_password']) (rimaste: $($pulizia['password_rimaste']))"
  Write-Host '   Prossimo passo: tools\collaudo\avvia.ps1, poi gli account sintetici (HO-034).'
}
