<#
  Zuschneiden und Skalieren auf ein Zielmass.
  Mittig auf das Zielverhaeltnis beschneiden, dann exakt skalieren.

  Bewusst .NET System.Drawing statt Python/PIL - Python ist auf diesem
  Rechner nicht installiert, und so braucht die App keine npm-Pakete.

  Aufruf:
    powershell -File resize.ps1 -Quelle in.jpg -Ziel out.png -Breite 1080 -Hoehe 1350
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Quelle,
  [Parameter(Mandatory = $true)][string]$Ziel,
  [Parameter(Mandatory = $true)][int]$Breite,
  [Parameter(Mandatory = $true)][int]$Hoehe
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Image]::FromFile($Quelle)
try {
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

  $bmp = New-Object System.Drawing.Bitmap($Breite, $Hoehe)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  try {
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($src, (New-Object System.Drawing.Rectangle(0, 0, $Breite, $Hoehe)),
      $x, $y, $cropW, $cropH, [System.Drawing.GraphicsUnit]::Pixel)
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

Write-Output "$Breite`x$Hoehe"
