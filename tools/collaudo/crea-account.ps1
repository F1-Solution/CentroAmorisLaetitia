# Crea un account sintetico nel solo database di collaudo, con la password chiesta a terminale e mai stampata.
#Requires -Version 7.3
[CmdletBinding()]
param(
  # Indirizzo sintetico: solo @example.invalid.
  [Parameter(Mandatory)][string]$Indirizzo,
  [Parameter(Mandatory)][string]$Nome,
  # `editor` è Redazione.
  [Parameter(Mandatory)][ValidateSet('editor', 'amministrazione')][string]$Ruolo,
  [string]$Database = 'amoris_collaudo',
  # Controlla tutto senza chiedere la password né creare nulla.
  [Alias('WhatIf')][switch]$Simula
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'comune.ps1')

Assert-RadiceDiSviluppo
Assert-ContenitoriPronti
Initialize-NomiDiSviluppo
if ($Indirizzo -cnotmatch '^[a-z0-9._-]+@example\.invalid\z') { throw 'L''indirizzo deve essere in minuscolo e finire in @example.invalid.' }
if ($Nome.Trim().Length -eq 0) { throw 'Il nome non può essere vuoto.' }
$url = Get-UrlDatabaseCollaudo -Database $Database
if (-not (Get-DatabaseEsiste $Database)) { throw 'Il database di collaudo non esiste: esegui prima tools\collaudo\crea.ps1.' }

if ($Simula) {
  Write-Host "Simulazione: controlli superati; creerei l'account con ruolo $Ruolo nel database di collaudo, chiedendo la password. Nessuna scrittura."
  return
}

$segreta = Read-Host -AsSecureString "Password nuova per $Indirizzo (almeno 12 caratteri)"
$copiaAmbiente = Save-Ambiente
try {
  # Lo strumento accetta i dati solo dalle variabili d'ambiente (apps/api/src/accounts/localAccount.ts): restano nel processo e si ripristinano alla fine.
  $env:DATABASE_URL = $url
  $env:ACCOUNT_EMAIL = $Indirizzo
  $env:ACCOUNT_NAME = $Nome
  $env:ACCOUNT_ROLE = $Ruolo
  $env:ACCOUNT_PASSWORD = [System.Net.NetworkCredential]::new('', $segreta).Password
  Push-Location $script:Radice
  try {
    & pnpm --filter '@amoris/api' account:create
    if ($LASTEXITCODE -ne 0) { throw "account:create non riuscito (codice $LASTEXITCODE)." }
  }
  finally { Pop-Location }
}
finally { Restore-Ambiente -Copia $copiaAmbiente }
