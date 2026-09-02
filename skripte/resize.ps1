<#
  Zuschneiden und Skalieren.

  Zwei Betriebsarten:
    -Breite/-Hoehe   mittig auf das Zielverhaeltnis beschneiden, dann exakt
                     skalieren. Fuer Plattformformate, wo das Mass zaehlt.
    -MaxKante        proportional verkleinern, nichts beschneiden. Fuer
                     Vorschauen und fuer Bilder, die ein Modell ansehen
                     soll - dort waere ein Beschnitt verfaelschend, weil
                     genau am Rand die Fehler sitzen.

  Bewusst .NET System.Drawing statt Python/PIL - Python ist auf diesem
  Rechner nicht installiert, und so braucht die App keine npm-Pakete.

  Aufruf:
    powershell -File resize.ps1 -Quelle in.jpg -Ziel out.png -Breite 1080 -Hoehe 1350
    powershell -File resize.ps1 -Quelle in.png -Ziel klein.png -MaxKante 768
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Quelle,
  [Parameter(Mandatory = $true)][string]$Ziel,
  [int]$Breite = 0,
  [int]$Hoehe = 0,
  [int]$MaxKante = 0
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if ($MaxKante -le 0 -and ($Breite -le 0 -or $Hoehe -le 0)) {
  throw 'Entweder -Breite und -Hoehe angeben, oder -MaxKante.'
}

$src = [System.Drawing.Image]::FromFile($Quelle)
try {
  if ($MaxKante -gt 0) {
    # Proportional, ohne Beschnitt. Kleine Bilder bleiben, wie sie sind -
    # hochrechnen bringt keine Bildinformation dazu.
    $faktor = [Math]::Min(1.0, $MaxKante / [Math]::Max($src.Width, $src.Height))
    $zielB = [Math]::Max(1, [int]($src.Width * $faktor))
    $zielH = [Math]::Max(1, [int]($src.Height * $faktor))
    $quellRechteck = New-Object System.Drawing.Rectangle(0, 0, $src.Width, $src.Height)
  }
  else {
    $zielB = $Breite
    $zielH = $Hoehe
    $zielRatio = $Breite / $Hoehe
    $srcRatio = $src.Width / $src.Height

    if ($srcRatio -gt $zielRatio) {
      $cropW = [int]($src.Height * $zielRatio)
      $cropH = $src.Height
    }
    else {
      $cropW = $src.Width
      $cropH = [int]($src.Width / $zielRatio)
    }
    $x = [int](($src.Width - $cropW) / 2)
    $y = [int](($src.Height - $cropH) / 2)
    $quellRechteck = New-Object System.Drawing.Rectangle($x, $y, $cropW, $cropH)
  }

  $bmp = New-Object System.Drawing.Bitmap($zielB, $zielH)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  try {
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($src, (New-Object System.Drawing.Rectangle(0, 0, $zielB, $zielH)),
      $quellRechteck.X, $quellRechteck.Y, $quellRechteck.Width, $quellRechteck.Height,
      [System.Drawing.GraphicsUnit]::Pixel)
  }
  finally { $g.Dispose() }

  $ordner = Split-Path -Parent $Ziel
  if ($ordner -and -not (Test-Path $ordner)) {
    New-Item -ItemType Directory -Path $ordner -Force | Out-Null
  }
  $bmp.Save($Ziel, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
finally { $src.Dispose() }

Write-Output "$zielB`x$zielH"
