# Compila (se serve) e avvia sito, area e API dell'ambiente di collaudo, staccati, con log su file.
# Rifiuta di partire se i server di sviluppo sono accesi. Non stampa valori di configurazione.
#Requires -Version 7.3
[CmdletBinding()]
param(
  [string]$Database = 'amoris_collaudo',
  [string]$PrefissoBucket = 'collaudo',
  [string]$Worktree = 'C:\work\amoris-collaudo',
  [int]$PortaSito = 3300,
  [int]$PortaArea = 3301,
  [int]$PortaApi = 3302,
  # Rifà le compilazioni anche se la tracciatura dice che sono aggiornate.
  [switch]$RiCompila,
  [int]$TimeoutSecondi = 120
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'comune.ps1')

Assert-RadiceDiSviluppo
Assert-ContenitoriPronti
Initialize-NomiDiSviluppo
$Worktree = Get-PercorsoCompleto $Worktree
Assert-NomiDiCollaudo -Database $Database -PrefissoBucket $PrefissoBucket -Worktree $Worktree

# Memoria limitata: a collaudo acceso lo sviluppo è spento.
$sviluppoAcceso = @($script:PorteSviluppo | Where-Object { Test-PortaInAscolto $_ })
if ($sviluppoAcceso.Count -gt 0) {
  throw "Ci sono $($sviluppoAcceso.Count) server di sviluppo accesi (porte 3000, 3001, 3002, 3200): fermali prima di avviare il collaudo."
}
$collaudoAcceso = @(@($PortaSito, $PortaArea, $PortaApi) | Where-Object { Test-PortaInAscolto $_ })
if ($collaudoAcceso.Count -gt 0) {
  throw "Il collaudo è già acceso su $($collaudoAcceso.Count) delle 3 porte: esegui tools\collaudo\ferma.ps1 se vuoi riavviarlo."
}
if (-not ((Get-WorktreeRegistrati) -contains $Worktree)) { throw 'La copia di lavoro del collaudo non esiste: esegui prima tools\collaudo\crea.ps1.' }
if (-not (Get-DatabaseEsiste $Database)) { throw 'Il database di collaudo non esiste: esegui prima tools\collaudo\crea.ps1.' }

# Il collaudo non parte con dati personali: nessuna compilazione dei moduli e nessun account attivo fuori da @example.invalid.
$guardia = (Invoke-Sql -Database $Database -Sql "SELECT (SELECT count(*) FROM form_submissions) || '|' || (SELECT count(*) FROM users WHERE is_active AND lower(email::text) NOT LIKE '%@example.invalid');")[0]
$conteggi = $guardia -split '\|'
if ($conteggi[0] -cne '0') { throw "Il database di collaudo contiene $($conteggi[0]) compilazioni dei moduli: mi rifiuto di avviarlo. Ripristinalo con crea.ps1." }
if ($conteggi[1] -cne '0') { throw "Nel database di collaudo ci sono $($conteggi[1]) account attivi con un indirizzo diverso da @example.invalid: mi rifiuto di avviarlo. Ripristinalo con crea.ps1." }

$stato = "$Worktree.stato"
$script:DirStato = $stato
New-Item -ItemType Directory -Force $stato | Out-Null
$sha = (& git -C $Worktree rev-parse HEAD)
$sito = "http://127.0.0.1:$PortaSito"
$area = "http://127.0.0.1:$PortaArea"
$api = "http://127.0.0.1:$PortaApi"

$copiaAmbiente = Save-Ambiente
try {
  # Configurazione: quella di sviluppo, con database, bucket, porte e indirizzi del collaudo.
  $variabili = Get-VariabiliEnv -Percorso (Join-Path $script:Radice '.env')
  foreach ($nome in $variabili.Keys) { [Environment]::SetEnvironmentVariable($nome, $variabili[$nome]) }

  $env:DATABASE_URL = Get-UrlDatabaseCollaudo -Database $Database
  $env:S3_BUCKET_PUBLIC = "$PrefissoBucket-public"
  $env:S3_BUCKET_PRIVATE = "$PrefissoBucket-private"
  $env:API_HOST = '127.0.0.1'
  $env:API_PORT = "$PortaApi"
  $env:CORS_ORIGINS = "$sito,$area"
  $env:SITE_URL = $sito
  $env:NEXT_PUBLIC_API_URL = $api
  $env:NEXT_PUBLIC_SITE_URL = $sito
  Remove-Item Env:API_URL -ErrorAction SilentlyContinue
  # Programmi che puliscono PDF e MP4 (QPDF_PATH, FFMPEG_PATH, FFPROBE_PATH): passano dal .env; se mancano, valgono i nomi nel PATH, e qpdf si cerca dove l'ha messo HO-032.
  if (-not $env:QPDF_PATH -and -not (Get-Command qpdf -ErrorAction SilentlyContinue) -and (Test-Path -LiteralPath 'C:/Program Files/qpdf 12.4.2/bin/qpdf.exe')) {
    $env:QPDF_PATH = 'C:/Program Files/qpdf 12.4.2/bin/qpdf.exe'
  }
  foreach ($programma in @(@('QPDF_PATH', 'qpdf'), @('FFMPEG_PATH', 'ffmpeg'), @('FFPROBE_PATH', 'ffprobe'))) {
    $percorso = [Environment]::GetEnvironmentVariable($programma[0])
    if (-not $percorso) { $percorso = $programma[1] }
    if (-not (Get-Command $percorso -ErrorAction SilentlyContinue)) {
      Write-Host "   ATTENZIONE: $($programma[0]) non punta a un programma eseguibile: i caricamenti di PDF e video nel collaudo potrebbero fallire."
    }
  }

  # Compilazioni: l'area incorpora gli indirizzi, quindi la tracciatura li include. `next build` non vuole NODE_ENV.
  $traccia = Join-Path $stato 'compilazione.txt'
  $attesa = "$sha|$sito|$area|$api"
  $aggiornata = (Test-Path -LiteralPath $traccia) -and ((Get-Content -LiteralPath $traccia -Raw).Trim() -eq $attesa)
  if ($RiCompila -or -not $aggiornata) {
    Write-Passo 'Compilazione di sito e area (alcuni minuti)'
    Remove-Item -LiteralPath $traccia -ErrorAction SilentlyContinue
    Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
    Push-Location $Worktree
    try {
      & pnpm exec turbo run build --filter=@amoris/web --filter=@amoris/admin --force --env-mode=loose *> (Join-Path $stato 'compilazione.log')
      if ($LASTEXITCODE -ne 0) { throw "Compilazione non riuscita: vedi $stato\compilazione.log" }
    }
    finally { Pop-Location }
    Set-Content -LiteralPath $traccia -Value $attesa
    Write-Host '   Compilazione riuscita.'
  }
  else { Write-Host 'Compilazioni già aggiornate per questo commit e questi indirizzi: le tengo.' }

  # Avvio staccato, come lo strumento di sviluppo: API (con NODE_ENV di sviluppo), sito, area.
  $env:NODE_ENV = 'development'
  Start-Process -WindowStyle Hidden -WorkingDirectory (Join-Path $Worktree 'apps\api') cmd -ArgumentList '/c', "pnpm start > `"$stato\api-$PortaApi.log`" 2>&1"
  Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
  Start-Process -WindowStyle Hidden -WorkingDirectory (Join-Path $Worktree 'apps\web') cmd -ArgumentList '/c', "pnpm exec next start -p $PortaSito -H 127.0.0.1 > `"$stato\sito-$PortaSito.log`" 2>&1"
  Start-Process -WindowStyle Hidden -WorkingDirectory (Join-Path $Worktree 'apps\admin') cmd -ArgumentList '/c', "pnpm exec next start -p $PortaArea -H 127.0.0.1 > `"$stato\area-$PortaArea.log`" 2>&1"
}
finally { Restore-Ambiente -Copia $copiaAmbiente }

# Attesa: l'API deve rispondere 200 su /health/ready; sito e area, una risposta HTTP qualunque.
$controlli = @(
  [pscustomobject]@{ Nome = 'API'; Indirizzo = "$api/health/ready"; Atteso = 200 },
  [pscustomobject]@{ Nome = 'sito'; Indirizzo = "$sito/"; Atteso = 0 },
  [pscustomobject]@{ Nome = 'area'; Indirizzo = "$area/admin"; Atteso = 0 }
)
$deadline = (Get-Date).AddSeconds($TimeoutSecondi)
$ultimi = @{}
$pronti = @{}
while ((Get-Date) -lt $deadline -and $pronti.Count -lt $controlli.Count) {
  foreach ($controllo in $controlli) {
    if ($pronti.ContainsKey($controllo.Nome)) { continue }
    try {
      $risposta = Invoke-WebRequest -Uri $controllo.Indirizzo -SkipHttpErrorCheck -MaximumRedirection 0 -TimeoutSec 5
      $ultimi[$controllo.Nome] = [int]$risposta.StatusCode
      if ($controllo.Atteso -eq 0 -or [int]$risposta.StatusCode -eq $controllo.Atteso) { $pronti[$controllo.Nome] = $true }
    }
    catch { }
  }
  if ($pronti.Count -lt $controlli.Count) { Start-Sleep -Seconds 2 }
}
foreach ($controllo in $controlli) {
  $codice = if ($ultimi.ContainsKey($controllo.Nome)) { $ultimi[$controllo.Nome] } else { 'nessuna risposta' }
  Write-Host "   $($controllo.Nome): $codice"
}
if ($pronti.Count -lt $controlli.Count) { throw "Non tutti i servizi sono pronti (l'API deve rispondere 200 su /health/ready): vedi i log in $stato" }
Write-Host "Collaudo acceso: sito $sito, area $area/admin, API $api. Log in $stato."
