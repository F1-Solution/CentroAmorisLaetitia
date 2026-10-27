# Ferma sito, area e API del collaudo: chiude i processi in ascolto sulle tre porte (solo 3300-3399) la cui riga di comando,
# o quella di un loro antenato, contiene il percorso della copia di lavoro del collaudo.
#Requires -Version 7.3
[CmdletBinding()]
param(
  [int]$PortaSito = 3300,
  [int]$PortaArea = 3301,
  [int]$PortaApi = 3302,
  [string]$Worktree = 'C:\work\amoris-collaudo'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'comune.ps1')

$porte = @($PortaSito, $PortaArea, $PortaApi)
foreach ($porta in $porte) {
  if ($porta -lt 3300 -or $porta -gt 3399) { throw 'Le porte del collaudo stanno fra 3300 e 3399: mi rifiuto di toccare le altre.' }
}
$Worktree = Get-PercorsoCompleto $Worktree
if ((Split-Path -Leaf $Worktree) -cnotmatch '^amoris-collaudo([-.][a-z0-9]+)*\z') {
  throw 'La cartella del collaudo deve chiamarsi amoris-collaudo o amoris-collaudo-<suffisso>.'
}

function Test-ProcessoDelCollaudo {
  # Vero se la riga di comando del processo o di uno dei suoi antenati contiene il percorso del collaudo.
  param([int]$ProcessoId)
  $cercati = @($Worktree, ($Worktree -replace '\\', '/'))
  $corrente = $ProcessoId
  for ($livello = 0; $livello -lt 6 -and $corrente -gt 0; $livello++) {
    $processo = Get-CimInstance Win32_Process -Filter "ProcessId = $corrente" -ErrorAction SilentlyContinue
    if (-not $processo) { return $false }
    foreach ($percorso in $cercati) {
      if ($processo.CommandLine -and $processo.CommandLine.IndexOf($percorso, [StringComparison]::OrdinalIgnoreCase) -ge 0) { return $true }
    }
    $corrente = [int]$processo.ParentProcessId
  }
  return $false
}

$fermati = 0
$estranei = 0
foreach ($porta in $porte) {
  $processi = @(Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
  foreach ($id in $processi) {
    if (Test-ProcessoDelCollaudo -ProcessoId $id) {
      # taskkill /T chiude anche i processi figli (cmd, pnpm, node).
      & taskkill /PID $id /T /F *> $null
      $fermati++
    }
    else { $estranei++ }
  }
}

Start-Sleep -Seconds 2
$ancoraAccese = @($porte | Where-Object { Test-PortaInAscolto $_ })
Write-Host "Processi fermati: $fermati. Processi sulle porte non del collaudo (non toccati): $estranei. Porte ancora in ascolto: $($ancoraAccese.Count)."
if ($ancoraAccese.Count -gt 0) { throw 'Alcune porte sono ancora in ascolto.' }
