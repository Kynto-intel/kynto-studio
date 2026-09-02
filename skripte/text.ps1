<#
  Textebenen auf ein Bild rendern.

  Einzige Render-Quelle fuer Text - Vorschau und Endergebnis kommen aus
  demselben Code, nur in unterschiedlicher Groesse. Deshalb sind alle
  Positionen und Groessen RELATIV (0..1) zur Bildhoehe angegeben.

  Aufruf:
    powershell -File text.ps1 -Quelle in.png -Ziel out.png -EbenenDatei ebenen.json [-MaxHoehe 700]

  Ebenen-JSON (Liste):
    [{ "text": "...", "schrift": "Bebas Neue", "groesse": 0.08,
       "farbe": "#E8E8E8", "akzentFarbe": "#8B0000",
       "x": 0.5, "y": 0.75, "ausrichtung": "mitte",
       "zeilenabstand": 1.1, "versalien": true,
       "kontur": { "breite": 0.004, "farbe": "#000000" },
       "schatten": { "versatz": 0.004, "farbe": "#000000" } }]

  Auszeichnung: *Wort* wird in akzentFarbe gesetzt, die Sternchen selbst
  erscheinen nicht im Bild.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Quelle,
  [Parameter(Mandatory = $true)][string]$Ziel,
  [Parameter(Mandatory = $true)][string]$EbenenDatei,
  [int]$MaxHoehe = 0
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

# Meldet, WO es gescheitert ist - sonst kommt beim Aufrufer nur die nackte
# Ausnahme an und man sucht die Zeile von Hand.
trap {
  Write-Error ("text.ps1 Zeile {0}: {1}`n  {2}" -f `
      $_.InvocationInfo.ScriptLineNumber, $_.Exception.Message, $_.InvocationInfo.Line.Trim())
  exit 1
}

# EIN Textformat fuer Messen und Zeichnen - sonst driften Position und
# Breite auseinander. GenericTypographic misst nachfolgende Leerzeichen mit
# Breite 0, dann kleben beim Zeichnen alle Woerter aneinander
# ("SIESAGTEN:STUR"). MeasureTrailingSpaces zaehlt sie mit.
$script:TextFormat = ([System.Drawing.StringFormat]::GenericTypographic).Clone()
$script:TextFormat.FormatFlags = $script:TextFormat.FormatFlags -bor `
  [System.Drawing.StringFormatFlags]::MeasureTrailingSpaces

function ConvertTo-Farbe([string]$hex, $standard = [System.Drawing.Color]::White) {
  if (-not $hex) { return $standard }
  try { return [System.Drawing.ColorTranslator]::FromHtml($hex) } catch { return $standard }
}

# Zerlegt Text mit Akzent-Auszeichnung in farbige Stuecke.
#
# Zwei Schreibweisen, weil viele intuitiv zu Anfuehrungszeichen greifen:
#   *Wort*        - Sternchen
#   "Wort"        - gerade Anfuehrungszeichen
#   typografische Anfuehrungszeichen (deutsch und franzoesisch) ebenso
# Die Auszeichnungszeichen selbst erscheinen nicht im Bild.
#
# ArrayList statt @(), weil PowerShell verschachtelte Arrays beim Zurueckgeben
# entrollt - dann kaeme die Zeilenstruktur flach wieder an.
function Split-Auszeichnung([string]$roh) {
  $stuecke = New-Object System.Collections.ArrayList

  # Erst alle typografischen Anfuehrungszeichen auf das gerade Zeichen
  # bringen. Die Codepunkte stehen als \u-Escape, damit die Quelldatei rein
  # ASCII bleibt: PowerShell 5.1 liest .ps1 ohne BOM als ANSI, echte
  # Sonderzeichen waeren im Muster zerstoert.
  #   201C 201D = obere Anfuehrungszeichen
  #   201E      = tiefes Anfuehrungszeichen
  #   00AB 00BB = franzoesische Form
  $rest = $roh
  foreach ($code in 0x201C, 0x201D, 0x201E, 0x00AB, 0x00BB) {
    $rest = $rest.Replace([string][char]$code, '"')
  }

  # Danach reicht ein reines ASCII-Muster: *Wort* oder "Wort".
  # Doppelte Anfuehrungszeichen ("" ... "") fangen die + mit ab.
  $muster = '^(.*?)(?:\*([^\*]+)\*|"+([^"]+)"+)(.*)$'

  while ($rest -match $muster) {
    $vorne = $Matches[1]
    $treffer = @($Matches[2], $Matches[3]) | Where-Object { $_ } | Select-Object -First 1
    $hinten = $Matches[4]

    if ($vorne) { [void]$stuecke.Add(@{ text = $vorne; akzent = $false }) }
    if ($treffer) { [void]$stuecke.Add(@{ text = [string]$treffer; akzent = $true }) }
    $rest = $hinten
  }

  if ($rest) { [void]$stuecke.Add(@{ text = $rest; akzent = $false }) }
  if ($stuecke.Count -eq 0) { [void]$stuecke.Add(@{ text = ''; akzent = $false }) }
  return , $stuecke
}

# Bricht Stuecke auf Zeilen um, ohne Woerter zu zerschneiden.
function Split-Zeilen($grafik, $stuecke, $schriftart, [float]$maxBreite) {
  $zeilen = New-Object System.Collections.ArrayList
  $aktuell = New-Object System.Collections.ArrayList
  $breite = 0.0

  $format = $script:TextFormat

  foreach ($stueck in $stuecke) {
    # An Leerzeichen trennen, die Trenner behalten
    $worte = [regex]::Split([string]$stueck.text, '(\s+)') | Where-Object { $_ -ne '' }
    foreach ($wort in $worte) {
      $istLeerzeichen = $wort -match '^\s+$'
      $mass = [float]$grafik.MeasureString([string]$wort, $schriftart, [int][Math]::Ceiling($maxBreite), $format).Width

      if (-not $istLeerzeichen -and ($breite + $mass) -gt $maxBreite -and $aktuell.Count -gt 0) {
        [void]$zeilen.Add($aktuell)
        $aktuell = New-Object System.Collections.ArrayList
        $breite = 0.0
      }
      # Kein Leerzeichen an den Zeilenanfang
      if ($istLeerzeichen -and $aktuell.Count -eq 0) { continue }

      [void]$aktuell.Add(@{ text = $wort; akzent = $stueck.akzent; breite = $mass })
      $breite += $mass
    }
  }
  if ($aktuell.Count -gt 0) { [void]$zeilen.Add($aktuell) }
  return , $zeilen
}

$ebenen = Get-Content $EbenenDatei -Raw -Encoding UTF8 | ConvertFrom-Json
$src = [System.Drawing.Image]::FromFile($Quelle)

try {
  # Fuer die Vorschau kleiner rendern - alles ist relativ, das Ergebnis
  # sieht deshalb identisch aus, nur in weniger Pixeln.
  $skala = 1.0
  if ($MaxHoehe -gt 0 -and $src.Height -gt $MaxHoehe) { $skala = $MaxHoehe / $src.Height }
  $breite = [int]([Math]::Round($src.Width * $skala))
  $hoehe = [int]([Math]::Round($src.Height * $skala))

  $bmp = New-Object System.Drawing.Bitmap($breite, $hoehe, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  try {
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.DrawImage($src, (New-Object System.Drawing.Rectangle(0, 0, $breite, $hoehe)))

    $format = $script:TextFormat

    foreach ($e in $ebenen) {
      if (-not $e.text) { continue }

      $schriftName = if ($e.schrift) { $e.schrift } else { 'Segoe UI' }
      $groesse = [float]($hoehe * [double]$(if ($e.groesse) { $e.groesse } else { 0.08 }))
      if ($groesse -lt 6) { $groesse = 6 }

      try { $schriftart = New-Object System.Drawing.Font($schriftName, $groesse, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel) }
      catch { $schriftart = New-Object System.Drawing.Font('Segoe UI', $groesse, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel) }

      $text = if ($e.versalien) { $e.text.ToUpper() } else { $e.text }
      $stuecke = Split-Auszeichnung $text

      # Alle Rechenwerte hart als float festlegen. Ohne das liefert ein
      # if-Ausdruck gelegentlich ein Object[] zurueck, und jedes spaetere +
      # scheitert mit "op_Addition".
      [float]$rand = $breite * 0.06
      [float]$maxBreite = $breite - (2 * $rand)
      $zeilen = Split-Zeilen $g $stuecke $schriftart $maxBreite

      [float]$zeilenAbstand = 1.1
      if ($e.zeilenabstand) { [float]$zeilenAbstand = [double]$e.zeilenabstand }
      [float]$zeilenHoehe = $groesse * $zeilenAbstand
      [float]$gesamtHoehe = $zeilenHoehe * [int]$zeilen.Count

      [float]$relX = 0.5
      if ($null -ne $e.x) { [float]$relX = [double]$e.x }
      [float]$relY = 0.75
      if ($null -ne $e.y) { [float]$relY = [double]$e.y }

      [float]$mitteX = $breite * $relX
      [float]$startY = ($hoehe * $relY) - ($gesamtHoehe / 2)

      # Auch senkrecht innerhalb des Bildes bleiben.
      [float]$obenGrenze = $rand
      [float]$untenGrenze = $hoehe - $rand - $gesamtHoehe
      if ($untenGrenze -lt $obenGrenze) { [float]$untenGrenze = $obenGrenze }
      if ($startY -lt $obenGrenze) { [float]$startY = $obenGrenze }
      if ($startY -gt $untenGrenze) { [float]$startY = $untenGrenze }

      $farbe = ConvertTo-Farbe $e.farbe ([System.Drawing.Color]::White)
      $akzent = ConvertTo-Farbe $e.akzentFarbe $farbe
      $pinsel = New-Object System.Drawing.SolidBrush($farbe)
      $pinselAkzent = New-Object System.Drawing.SolidBrush($akzent)

      [float]$konturBreite = 0
      if ($e.kontur -and $e.kontur.breite) { [float]$konturBreite = $breite * [double]$e.kontur.breite }
      $konturFarbe = [System.Drawing.Color]::Black
      if ($e.kontur) { $konturFarbe = ConvertTo-Farbe $e.kontur.farbe ([System.Drawing.Color]::Black) }

      [float]$schattenVersatz = 0
      if ($e.schatten -and $e.schatten.versatz) { [float]$schattenVersatz = $breite * [double]$e.schatten.versatz }
      $schattenFarbe = [System.Drawing.Color]::Black
      if ($e.schatten) { $schattenFarbe = ConvertTo-Farbe $e.schatten.farbe ([System.Drawing.Color]::Black) }

      [float]$y = $startY
      foreach ($zeile in $zeilen) {
        [float]$zeilenBreite = 0
        foreach ($w in $zeile) { [float]$zeilenBreite = $zeilenBreite + [float]$w.breite }

        # Das BILD ist die Grenze, nicht die Ziehposition.
        # Links und rechts sitzen am Bildrand (abzueglich Rand), die Mitte
        # folgt der Ziehposition. Bewusst if/else statt switch: switch kann
        # in PowerShell mehrere Werte ausgeben, dann wird $x ein Array.
        if ($e.ausrichtung -eq 'links') {
          [float]$x = $rand
        }
        elseif ($e.ausrichtung -eq 'rechts') {
          [float]$x = $breite - $rand - $zeilenBreite
        }
        else {
          [float]$x = $mitteX - ($zeilenBreite / 2)
        }

        # Nichts laeuft aus dem Bild - egal wohin gezogen wurde.
        [float]$links = $rand
        [float]$rechts = $breite - $rand - $zeilenBreite
        if ($rechts -lt $links) { [float]$rechts = $links }
        if ($x -lt $links) { [float]$x = $links }
        if ($x -gt $rechts) { [float]$x = $rechts }

        foreach ($w in $zeile) {
          $punkt = New-Object System.Drawing.PointF -ArgumentList $x, $y

          # ALLES ueber GraphicsPath zeichnen - Schatten, Kontur und Fuellung.
          #
          # Frueher lief die Fuellung ueber DrawString, die Kontur ueber
          # GraphicsPath. Die beiden setzen den Ursprung unterschiedlich
          # (DrawString rechnet den internen Zeilenabstand der Schrift mit
          # ein), dadurch sass der Servertext rund 15 % der Schriftgroesse
          # tiefer als die Browser-Vorschau - sichtbar als Nachrucken, sobald
          # die genaue Fassung ankam. GraphicsPath setzt den Ursprung an die
          # Oberkante des Geviert, genau wie Canvas mit textBaseline "top".

          if ($schattenVersatz -gt 0) {
            # Koordinaten VORHER ausrechnen: In PowerShell bindet das Komma
            # staerker als das Plus, deshalb wuerde PointF($x + $v, $y + $v)
            # als $x + ($v, $y) + $v gelesen werden - Zahl plus Array.
            [float]$sx = $x + $schattenVersatz
            [float]$sy = $y + $schattenVersatz
            $sPunkt = New-Object System.Drawing.PointF -ArgumentList $sx, $sy
            $sPfad = New-Object System.Drawing.Drawing2D.GraphicsPath
            $sPfad.AddString([string]$w.text, $schriftart.FontFamily, [int]$schriftart.Style, $groesse, $sPunkt, $format)
            $sPinsel = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(150, $schattenFarbe))
            $g.FillPath($sPinsel, $sPfad)
            $sPinsel.Dispose()
            $sPfad.Dispose()
          }

          $pfad = New-Object System.Drawing.Drawing2D.GraphicsPath
          $pfad.AddString([string]$w.text, $schriftart.FontFamily, [int]$schriftart.Style, $groesse, $punkt, $format)

          if ($konturBreite -gt 0) {
            $stift = New-Object System.Drawing.Pen($konturFarbe, $konturBreite)
            $stift.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
            $g.DrawPath($stift, $pfad)
            $stift.Dispose()
          }

          $fuellung = $pinsel
          if ($w.akzent) { $fuellung = $pinselAkzent }
          $g.FillPath($fuellung, $pfad)
          $pfad.Dispose()

          [float]$x = $x + [float]$w.breite
        }
        [float]$y = $y + $zeilenHoehe
      }

      $pinsel.Dispose(); $pinselAkzent.Dispose(); $schriftart.Dispose()
    }
  }
  finally { $g.Dispose() }

  $ordner = Split-Path -Parent $Ziel
  if ($ordner -and -not (Test-Path $ordner)) { New-Item -ItemType Directory -Path $ordner -Force | Out-Null }
  $bmp.Save($Ziel, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
finally { $src.Dispose() }

Write-Output "$breite`x$hoehe"
