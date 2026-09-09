# Datei in den Windows-Papierkorb legen - nicht endgueltig loeschen.
#
# Warum nicht Remove-Item: das loescht sofort und unwiderruflich. Der
# Papierkorb ist der Ort, an dem Felix ohnehin nachsieht, wenn er etwas
# vermisst, und Wiederherstellen geht dort mit Rechtsklick. Ein eigener
# Papierkorb-Ordner in daten/ waere ein zweiter, den niemand kennt.
#
# Die Funktion dafuer steckt in Microsoft.VisualBasic - das ist kein
# Notbehelf, sondern der offizielle Weg: das .NET-Framework selbst bietet
# keinen anderen Zugriff auf den Papierkorb.

param(
  [Parameter(Mandatory = $true)][string]$Pfad
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Pfad -PathType Leaf)) {
  Write-Error "Datei nicht gefunden: $Pfad"
  exit 1
}

Add-Type -AssemblyName Microsoft.VisualBasic

# OnlyErrorDialogs: kein Fortschrittsfenster, aber Fehler werden gemeldet.
# SendToRecycleBin: genau das, worum es hier geht.
[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile(
  $Pfad,
  [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,
  [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin
)

Write-Output 'ok'
