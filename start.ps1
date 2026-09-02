<#
  Kynto Studio starten.

  Holt die Schluessel aus dem User-Bereich der Umgebungsvariablen und gibt
  sie an den Node-Prozess weiter - so muss nach dem Setzen eines neuen
  Schluessels nichts neu gestartet werden ausser diesem Skript.
#>
[CmdletBinding()]
param(
  [switch]$OhneBrowser
)

$ErrorActionPreference = 'Stop'
$hier = Split-Path -Parent $MyInvocation.MyCommand.Path

foreach ($name in @('OPENROUTER_API_KEY')) {
  $wert = [Environment]::GetEnvironmentVariable($name, 'User')
  if ($wert) {
    Set-Item -Path "Env:$name" -Value $wert
    Write-Host "$name gefunden" -ForegroundColor DarkGray
  }
  else {
    # Kein Grund zur Panik: eine .env neben der App wird vom Server selbst
    # gelesen. Nur wenn beides fehlt, laeuft nachher nichts.
    Write-Host "$name nicht in der Umgebung - .env wird geprueft" -ForegroundColor DarkGray
  }
}

# Port und Host stehen in studio.config.json und sind aenderbar. Frueher
# stand hier 4890 fest - wer den Port umgestellt hat, bekam ein Browserfenster
# auf einer Adresse, auf der nichts lauscht. Faellt die Datei aus, bleibt es
# beim Standard.
$port = 4890
$gastgeber = '127.0.0.1'
$konfigDatei = Join-Path $hier 'studio.config.json'
if (Test-Path $konfigDatei) {
  try {
    # Nicht Get-Content: PowerShell 5.1 liest BOM-lose Dateien als ANSI,
    # dann kommen Umlaute in Pfaden kaputt an.
    $konfig = [System.IO.File]::ReadAllText($konfigDatei, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
    if ($konfig.port) { $port = [int]$konfig.port }
    if ($konfig.host) { $gastgeber = [string]$konfig.host }
  }
  catch {
    Write-Host "studio.config.json ist fehlerhaft, nehme $($gastgeber):$port" -ForegroundColor DarkYellow
  }
}

# Auf 0.0.0.0 laesst sich nichts oeffnen - im Browser muss localhost stehen.
$anzeigeHost = if ($gastgeber -eq '0.0.0.0') { '127.0.0.1' } else { $gastgeber }
$url = "http://${anzeigeHost}:$port"
if (-not $OhneBrowser) {
  Start-Job -ScriptBlock {
    Start-Sleep -Milliseconds 1200
    Start-Process $using:url
  } | Out-Null
}

Write-Host ""
Write-Host "Kynto Studio startet auf $url" -ForegroundColor Cyan
Write-Host "Beenden mit Strg+C" -ForegroundColor DarkGray
Write-Host ""

& node (Join-Path $hier 'server.mjs')
