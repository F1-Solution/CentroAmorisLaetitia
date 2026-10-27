# Esegue sul collaudo la prova dell'anteprima e 1E-19 (HO-035) con l'account di Redazione; la password si chiede a terminale.
#Requires -Version 7.3
[CmdletBinding()]
param(
  [string]$Database = 'amoris_collaudo',
  [string]$Indirizzo = 'redazione@example.invalid',
  [ValidateRange(3300, 3399)][int]$PortaSito = 3300,
  [ValidateRange(3300, 3399)][int]$PortaApi = 3302
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'comune.ps1')

Assert-RadiceDiSviluppo
Assert-ContenitoriPronti
Initialize-NomiDiSviluppo
if ($Indirizzo -cnotmatch '^[a-z0-9._-]+@example\.invalid\z') { throw 'L''indirizzo deve finire in @example.invalid.' }
$url = Get-UrlDatabaseCollaudo -Database $Database
if (-not (Get-DatabaseEsiste $Database)) { throw 'Il database di collaudo non esiste.' }

$segreta = Read-Host -AsSecureString "Password di $Indirizzo"
$copiaAmbiente = Save-Ambiente
try {
  $env:DATABASE_URL = $url
  $env:API = "http://127.0.0.1:$PortaApi"
  $env:SITO = "http://127.0.0.1:$PortaSito"
  $env:QA_EMAIL = $Indirizzo
  $env:QA_PASSWORD = [System.Net.NetworkCredential]::new('', $segreta).Password
  Push-Location $script:Radice
  try {
    & pnpm exec tsx tests/visual/prova-anteprima.ts
    $esitoAnteprima = $LASTEXITCODE
    & pnpm exec tsx tests/visual/prova-1e-19.ts
    $esito1e19 = $LASTEXITCODE
  }
  finally { Pop-Location }
  Write-Host "Esito: prova dell'anteprima codice $esitoAnteprima, 1E-19 codice $esito1e19 (0 = riuscita)."
  if ($esitoAnteprima -ne 0 -or $esito1e19 -ne 0) { throw 'Almeno una prova non è riuscita.' }
}
finally { Restore-Ambiente -Copia $copiaAmbiente }
