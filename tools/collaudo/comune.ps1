# Funzioni comuni degli script dell'ambiente di collaudo (D162 = A): si caricano con dot-sourcing, non si eseguono da sole.
Set-StrictMode -Version Latest

$script:Radice = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$script:ContenitoreDb = 'amoris-dev-db-1'
$script:ContenitoreOggetti = 'amoris-dev-objects-1'
$script:PorteSviluppo = @(3000, 3001, 3002, 3200)
$script:DbSviluppo = $null
$script:BucketSviluppo = @()
$script:DirStato = $null

# Dentro il contenitore MinIO le credenziali sono già nell'ambiente: non passano né dall'host né dalla riga di comando.
# L'alias si ridichiara a ogni chiamata e la configurazione si cancella alla fine, così le credenziali non restano in /tmp; l'unica virgoletta doppia serve a "$@".
$script:CopioneMc = @'
d=/tmp/mc-collaudo; mc --config-dir $d alias set local http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc --config-dir $d "$@"; rc=$?; rm -rf $d; exit $rc
'@

function Write-Passo {
  param([string]$Testo)
  Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] $Testo"
}

function Assert-RadiceDiSviluppo {
  # Gli script si lanciano dalla copia di lavoro di sviluppo, mai da quella del collaudo.
  if (-not (Test-Path -LiteralPath (Join-Path $script:Radice '.git') -PathType Container)) {
    throw 'Lancia gli script dalla copia di lavoro di sviluppo, non da una copia di lavoro del collaudo.'
  }
}

function Get-VariabiliEnv {
  # Con -Chiavi si tengono in memoria solo quelle nominate, così i segreti non si leggono.
  param([string]$Percorso, [string[]]$Chiavi)
  $risultato = @{}
  foreach ($riga in Get-Content -LiteralPath $Percorso) {
    if ($riga -cmatch '^([A-Z_][A-Z0-9_]*)=(.*)\z') {
      $nome = $Matches[1]
      if ($Chiavi -and ($Chiavi -cnotcontains $nome)) { continue }
      $risultato[$nome] = $Matches[2]
    }
  }
  return $risultato
}

function Save-Ambiente {
  $copia = @{}
  foreach ($voce in Get-ChildItem Env:) { $copia[$voce.Name] = $voce.Value }
  return $copia
}

function Restore-Ambiente {
  param([hashtable]$Copia)
  foreach ($voce in @(Get-ChildItem Env:)) {
    if (-not $Copia.ContainsKey($voce.Name)) { [Environment]::SetEnvironmentVariable($voce.Name, $null) }
  }
  foreach ($nome in $Copia.Keys) { [Environment]::SetEnvironmentVariable($nome, $Copia[$nome]) }
}

function Get-PercorsoCompleto {
  # Relativo alla cartella corrente di PowerShell ($PWD), non a quella del processo.
  param([string]$Percorso)
  return $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Percorso).TrimEnd('\')
}

function Test-NomeDatabaseDiCollaudo {
  param([string]$Database)
  return ($Database -cmatch '^amoris_collaudo(_[a-z0-9]+)*\z') -and ($Database -cne $script:DbSviluppo)
}

function Assert-NomiDiCollaudo {
  # Rifiuta tutto ciò che non ha la forma dei nomi del collaudo, e in ogni caso i nomi di sviluppo. Confronti sensibili alle maiuscole.
  param([string]$Database, [string]$PrefissoBucket, [string]$Worktree)
  if ($Database -cnotmatch '^amoris_collaudo(_[a-z0-9]+)*\z') {
    throw 'Il database di destinazione deve chiamarsi amoris_collaudo o amoris_collaudo_<suffisso> (minuscole, cifre e trattino basso).'
  }
  if ($Database -ceq $script:DbSviluppo) { throw 'Il database di destinazione coincide con quello di sviluppo: mi rifiuto.' }
  if ($PrefissoBucket -cnotmatch '^collaudo(-[a-z0-9]+)*\z') {
    throw 'Il prefisso dei bucket deve essere collaudo o collaudo-<suffisso> (minuscole, cifre e trattino).'
  }
  foreach ($bucket in @("$PrefissoBucket-public", "$PrefissoBucket-private")) {
    if ($bucket.Length -gt 63) { throw 'Nome di bucket troppo lungo.' }
    if ($script:BucketSviluppo -ccontains $bucket) { throw 'Un bucket di destinazione coincide con uno di sviluppo: mi rifiuto.' }
  }
  $percorso = Get-PercorsoCompleto $Worktree
  $foglia = Split-Path -Leaf $percorso
  if ($foglia -cnotmatch '^amoris-collaudo([-.][a-z0-9]+)*\z') {
    throw 'La cartella del collaudo deve chiamarsi amoris-collaudo o amoris-collaudo-<suffisso> (minuscole, cifre, trattino e punto).'
  }
  $radice = $script:Radice.TrimEnd('\')
  if ($percorso.StartsWith($radice + '\', [StringComparison]::OrdinalIgnoreCase) -or $radice.StartsWith($percorso + '\', [StringComparison]::OrdinalIgnoreCase) -or $percorso -ieq $radice) {
    throw 'La cartella del collaudo deve stare fuori dal repository di sviluppo.'
  }
}

function Write-ErroreCompleto {
  # L'uscita completa di un errore può contenere dati veri: va in un file della cartella di stato, mai a video.
  param([string[]]$Righe, [string]$Sigla)
  $cartella = if ($script:DirStato) { $script:DirStato } else { Join-Path ([IO.Path]::GetTempPath()) 'amoris-collaudo-stato' }
  New-Item -ItemType Directory -Force $cartella | Out-Null
  $file = Join-Path $cartella "errori-$Sigla-$((Get-Date).ToString('yyyyMMdd-HHmmss')).log"
  Set-Content -LiteralPath $file -Value $Righe
  return $file
}

function Get-MessaggioErrore {
  # Codice e prima riga `ERROR:` senza DETAIL né CONTEXT; il resto sta nel file.
  param([string[]]$Righe, [int]$Codice, [string]$Sigla)
  $file = Write-ErroreCompleto -Righe $Righe -Sigla $Sigla
  $riga = $Righe | Where-Object { $_ -cmatch 'ERROR:' } | Select-Object -First 1
  $prima = if ($riga) { ($riga -creplace '^.*?(ERROR:)', '$1').Trim() } else { 'nessuna riga ERROR: nell''uscita' }
  return "codice $Codice; $prima; uscita completa in $file (può contenere dati: non inviarla)"
}

function Invoke-Docker {
  param([string[]]$Argomenti)
  $uscita = & docker @Argomenti 2>&1
  if ($LASTEXITCODE -ne 0) { throw "docker $($Argomenti[0]) non riuscito (codice $LASTEXITCODE)" }
  return ,@($uscita | ForEach-Object { "$_" })
}

function Assert-ContenitoriPronti {
  foreach ($nome in @($script:ContenitoreDb, $script:ContenitoreOggetti)) {
    $stato = (& docker inspect -f '{{.State.Health.Status}}' $nome 2>$null)
    if ($LASTEXITCODE -ne 0 -or $stato -cne 'healthy') {
      throw "Il contenitore $nome non è acceso e in salute: avvia Docker e il compose di sviluppo."
    }
  }
}

function Initialize-NomiDiSviluppo {
  # Il nome del database di sviluppo lo dice il contenitore; i nomi dei bucket sono le sole chiavi non segrete che servono dal .env.
  $script:DbSviluppo = (Invoke-Docker @('exec', $script:ContenitoreDb, 'sh', '-c', 'echo $POSTGRES_DB'))[0].Trim()
  $nomi = Get-VariabiliEnv -Percorso (Join-Path $script:Radice '.env') -Chiavi @('S3_BUCKET_PUBLIC', 'S3_BUCKET_PRIVATE')
  foreach ($chiave in @('S3_BUCKET_PUBLIC', 'S3_BUCKET_PRIVATE')) {
    if (-not $nomi.ContainsKey($chiave)) { throw "Nel .env manca la chiave $chiave." }
  }
  $script:BucketSviluppo = @($nomi['S3_BUCKET_PUBLIC'], $nomi['S3_BUCKET_PRIVATE'])
  if (-not $script:DbSviluppo) { throw 'Non riesco a leggere il nome del database di sviluppo dal contenitore.' }
}

function Invoke-Sql {
  # L'SQL arriva da stdin: nessun problema di virgolette e nessun segreto sulla riga di comando. Sul database di sviluppo solo SELECT.
  param([string]$Database, [string]$Sql)
  if ($Database -ceq $script:DbSviluppo) {
    $corpo = $Sql.Trim().TrimEnd(';')
    if (($corpo -notmatch '^\s*SELECT\b') -or $corpo.Contains(';')) { throw 'Scrittura sul database di sviluppo: mi rifiuto.' }
  }
  $uscita = $Sql | & docker exec -i $script:ContenitoreDb sh -c 'exec psql -U $POSTGRES_USER -d $0 -v ON_ERROR_STOP=1 -At -q -f -' $Database 2>&1
  $righe = @($uscita | ForEach-Object { "$_" })
  if ($LASTEXITCODE -ne 0) { throw "SQL non riuscito: $(Get-MessaggioErrore -Righe $righe -Codice $LASTEXITCODE -Sigla 'sql')" }
  return ,$righe
}

function Invoke-Mc {
  param([string[]]$Argomenti, [switch]$Tollerante)
  $scrivono = @('mb', 'rb', 'rm', 'anonymous', 'mirror', 'cp', 'mv', 'retention', 'version')
  if ($scrivono -ccontains $Argomenti[0]) {
    $destinazione = $Argomenti[-1]
    foreach ($bucket in $script:BucketSviluppo) {
      if ($destinazione -ceq "local/$bucket" -or $destinazione -clike "local/$bucket/*") {
        throw 'Scrittura su un bucket di sviluppo: mi rifiuto.'
      }
    }
  }
  $uscita = & docker exec $script:ContenitoreOggetti sh -c $script:CopioneMc sh @Argomenti 2>&1
  $codice = $LASTEXITCODE
  if ($codice -ne 0 -and -not $Tollerante) { throw "mc $($Argomenti[0]) non riuscito (codice $codice)" }
  return [pscustomobject]@{ Codice = $codice; Righe = @($uscita | ForEach-Object { "$_" }) }
}

function Test-PortaInAscolto {
  param([int]$Porta)
  $connessioni = @(Get-NetTCPConnection -LocalPort $Porta -State Listen -ErrorAction SilentlyContinue)
  return $connessioni.Count -gt 0
}

function Get-WorktreeRegistrati {
  $righe = & git -C $script:Radice worktree list --porcelain
  if ($LASTEXITCODE -ne 0) { throw 'git worktree list non riuscito.' }
  return @($righe | Where-Object { $_ -clike 'worktree *' } | ForEach-Object { Get-PercorsoCompleto ($_.Substring(9) -replace '/', '\') })
}

function Get-DatabaseEsiste {
  param([string]$Database)
  return (Invoke-Sql -Database 'postgres' -Sql "SELECT count(*) FROM pg_database WHERE datname = '$Database';")[0] -ceq '1'
}

function Remove-DatabaseDiCollaudo {
  # Prima di ogni DROP si ripete il controllo del nome: mai il database di sviluppo, mai un nome fuori forma.
  param([string]$Database)
  if (-not (Test-NomeDatabaseDiCollaudo $Database)) { throw 'DROP rifiutato: il nome non è quello di un database di collaudo.' }
  if (Get-DatabaseEsiste $Database) { Invoke-Sql -Database 'postgres' -Sql "DROP DATABASE ""$Database"" WITH (FORCE);" | Out-Null }
}

function Get-UrlDatabaseCollaudo {
  # Indirizzo del database di collaudo: quello del .env con il solo nome cambiato; rifiuta tutto ciò che non finisce esattamente in /<database>.
  param([string]$Database)
  if (-not (Test-NomeDatabaseDiCollaudo $Database)) { throw 'Il nome del database non è quello di un database di collaudo.' }
  $url = (Get-VariabiliEnv -Percorso (Join-Path $script:Radice '.env') -Chiavi @('DATABASE_URL'))['DATABASE_URL']
  if (-not $url) { throw 'Nel .env manca DATABASE_URL.' }
  $parti = [regex]::Match($url, '^(.*/)' + [regex]::Escape($script:DbSviluppo) + '\z')
  if (-not $parti.Success) { throw 'DATABASE_URL del .env non finisce esattamente nel nome del database di sviluppo: mi rifiuto.' }
  $nuovo = $parti.Groups[1].Value + $Database
  if ($nuovo -cnotmatch ('/' + [regex]::Escape($Database) + '\z')) { throw 'L''indirizzo costruito non finisce nel database di collaudo: mi rifiuto.' }
  return $nuovo
}
