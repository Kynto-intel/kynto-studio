# Kynto Studio – Arbeitsanleitung

Lokales Bild- und Video-Studio. Node ohne Abhaengigkeiten, HTTP-Server auf
127.0.0.1, Browser-Oberflaeche ohne Build-Schritt. Bilder und Videos laufen
ueber OpenRouter, bezahlt wird pro Lauf mit eigenem Schluessel.

Die Oberflaeche, der Code, die Kommentare und die Commit-Nachrichten sind
**deutsch**. Das ist keine Uebergangsloesung – wer hier etwas anfasst,
schreibt weiter deutsch. Ein Sprachdatei-Umbau waere ein eigenes Vorhaben.

---

## REGEL NULL: Claude erzeugt keine Bilder und keine Videos. Nie.

Kein Bild, kein Clip. Nicht zum Testen, nicht "nur eins", nicht "ganz klein",
nicht um einen Fehler nachzustellen, nicht weil ein Umbau sonst ungeprueft
bleibt. **Erzeugt wird ausschliesslich, wenn Felix selbst klickt.**

Das heisst konkret: kein Aufruf von `POST /api/erzeugen` und
`POST /api/animieren`, weder gegen die laufende App noch gegen eine
Testkopie, weder von Hand noch aus einem Skript. Auch nicht `lib/auftrag-*`
direkt aufrufen. Auch nicht mit fremdem Schluessel oder fremdem Modell.

**Ein Aufruf, den ich fuer einen Fehlerfall halte, ist keiner.** Am 6.9.2026
sind so zweimal 63 ct verbrannt: `POST /api/animieren` sollte an "Modell
nimmt kein Standbild" und an der Tagesgrenze scheitern, war aber beide Male
gueltig – OpenRouter hat gerendert und abgerechnet. Der Server wurde mitten
im Lauf abgeschossen, es kam nichts zurueck. **1,26 $ fuer nichts.** Wenn
nicht mit Sicherheit feststeht, dass ein Aufruf vor dem Anbieter abbricht,
wird er nicht abgeschickt.

Was stattdessen geht: alles ohne Anbieter. Server starten, Routen abklopfen,
`/api/schaetzung`, Fehler VOR dem Anbieter (leeres Motiv, erfundenes Modell),
Tagesbremse mit vorbelegtem `daten/verbrauch.json`, Oberflaeche im Browser,
`text_aufs_bild` (rendert lokal, kostet nichts), Chat ueber Ollama (lokal).

Bleibt der Erfolgsfall ungeprueft, steht das so in der Notiz – "nicht
geprueft, weil es Geld kostet" ist ein vollstaendiger Satz.

---

## Starten und pruefen

```powershell
.\start.ps1              # startet Server + Browser auf http://127.0.0.1:4890
.\start.ps1 -OhneBrowser # nur Server
node server.mjs          # roh, ohne Schluessel aus dem User-Bereich
```

Es gibt **keine package.json, keine Tests, keinen Linter, keinen Build**. Das
ist Absicht. Wer eine Abhaengigkeit einfuehren will, fragt vorher.

Geprueft wird von Hand im Browser. Erzeugen und Animieren pruefe ich gar
nicht – siehe Regel Null. Beim Chat gilt: lokal ueber Ollama kostenlos, ueber
OpenRouter **nicht** nebenbei, erst fragen.

---

## Aufbau

```
server.mjs      NUR Routing. Keine Fachlogik, keine Ausnahme. Bis 6.9.2026
                stand die Gespraechsschleife hier, "weil sie Werkzeuge und
                Strom verbindet" - sie tut es nicht, `sende` ist jetzt ein
                Rueckruf. Wer hier wieder Logik anlegt, legt sie falsch an.
lib/            ein Modul, eine Aufgabe. Nichts weiss mehr, als es braucht.
web/            die Oberflaeche, ES-Module direkt im Browser
skripte/        PowerShell fuer System.Drawing
aenderungen/    eine Notiz je Aenderung - was, warum, wie geprueft.
                Git-ignoriert: Arbeitsmaterial, nicht Teil des Repos
plaene/         was noch nicht gebaut ist, eine Datei je Vorhaben
daten/          Laufzeitdaten, git-ignoriert, wird beim Start angelegt
```

### lib/ – wer macht was

| Modul | Aufgabe |
|---|---|
| `konfig.mjs` | Pfade, Port, Formate, Schluessel. **Einzige Stelle, die `process.env` liest.** `WURZEL`, `ORDNER`, `FORMATE` sind `let` – die Oberflaeche aendert sie zur Laufzeit, alle Module sehen es sofort (lebende ES-Bindungen) |
| `pfade.mjs` | Pfad-Sicherheit. **Jeder** Lese- und Schreibzugriff geht durch `absolut()` / `pruefeInnerhalb()`. Ausserhalb von `WURZEL` passiert nichts |
| `umgebung.mjs` | `.env` neben der App lesen. Umgebungsvariable schlaegt Datei |
| `bibliothek.mjs` | Bestand einsammeln, suchen, Datei ausliefern |
| `sidecar.mjs` | `bild.png` → `bild.png.json`. Kein zentraler Index, damit Umbenennen und Verschieben im Explorer nichts kaputtmacht |
| `stil.mjs` | ZWEI Stil-Bloecke, Bild und Video, `bauePrompt()` / `bauePromptVideo()`. Wird bei **jedem** Prompt neu gelesen. Bewegung gehoert NICHT hinein, die steht im Prompt |
| `regie.mjs` | Handwerkswissen fuer den Assistenten in `daten/regie.txt`. Geht in den Systemhinweis, nicht in den Bild-Prompt — nicht mit dem Stil-Block verwechseln |
| `vorlagen.mjs` | gespeicherte Läufe in `daten/vorlagen.json`. Speichert nur Zeichenketten — die Pfadprüfung passiert vorher in der Route |
| `kosten.mjs` | Verbrauch buchen, gemessene Modellpreise mitschreiben |
| `preise.mjs` | Live-Preise von OpenRouter, 30 Min Zwischenspeicher |
| `modelle-bild/-video/-chat.mjs` | reine Kataloge + Nachladen. **Keine** Aufruf-Logik |
| `anbieter-openrouter-*.mjs` | die Aufrufe. Kennen kein Dateisystem, bekommen Bytes, liefern Bytes |
| `ollama.mjs` | lokaler Chat. Erkennung, Katalog und Aufruf in EINER Datei - Ausnahme zur Trennung unten, begruendet im Kopf der Datei. Laeuft Ollama nicht, ist die Liste leer und niemand merkt etwas |
| `auftrag-bild.mjs` | ein Bildauftrag ganz: Bremse, Modell, Ordner, Referenz, Prompt, Rendern, Sidecar, Buchung, Verlauf. Kennt kein HTTP |
| `auftrag-video.mjs` | dasselbe fuer Clips. Zwei Dateien, weil Dauer, Aufloesung und Rohschreiben anders laufen |
| `gespraech.mjs` | Systemhinweis + Werkzeugschleife. Schickt Ereignisse ueber den Rueckruf `sende`, kennt weder `req` noch `res` |
| `werkzeuge.mjs` | was der Assistent darf. Siehe unten |
| `format.mjs`, `text.mjs`, `schriften.mjs` | die drei PowerShell-Kapseln |
| `verlauf.mjs` | Verlauf + Server-Sent-Events an offene Fenster |
| `chatverlauf.mjs` | Gespraech in `daten/chat.json` |

### web/ – wer macht was

`studio.js` verdrahtet nur und hat selbst keine Fachlogik. `api.js` ist die
einzige Stelle, die `fetch` kennt. Danach: `raster.js` (Galerie),
`erzeugen.js` (Komponist unten), `chat.js` (Leiste rechts), `detail.js`,
`texteditor.js` + `vorschau.js`, `verlauf.js` (eine SSE-Verbindung fuer die
ganze App - **hier nie frueh aussteigen**, an dem einen `message`-Empfaenger
haengt auch das Nachladen der Galerie) + `verlauf-fenster.js`, `ordner.js`,
`vorlagen.js`, `referenz.js`,
`auswahl.js` (eigene Menues), `merker.js` (localStorage), `symbole.js`,
`regie.js` (der Regie-Text, gezeichnet in die Einstellungen).

`vorlagen.js` zeichnet die Vorlagen-Karten, das Bearbeiten-Formular und
haelt die Namenszeile (`benennung()`), die auch der Komponist und die
Detailansicht benutzen. Ein anderes Referenzbild wird NICHT ueber einen
eigenen Bildwaehler gesucht, sondern ueber die Galerie: studio.js faengt
den naechsten Klick darin einmalig ab und schickt ihn an die Vorlage.
Native `prompt()`- oder `confirm()`-Fenster kommen in dieser App nirgends
vor - alles bleibt in der Seite.

**Das Raster hat den Bestand und beliebig viele Sonderansichten**
(derzeit `vorlagen` und `einstellungen`); `raster.js` haelt den Zustand.
Sie sind bewusst keine Fenster: ein Dialog ueber der Galerie waere ein
zweiter Ort, an dem etwas steht, und man muesste ihn zumachen, bevor es
weitergeht. `raster.js` kennt die Module nicht - studio.js meldet sie mit
`meldeAnsicht(id, { label, symbol, zahl?, lade?, zeichne })` an. Eine neue
Ansicht ist damit ein Modul plus drei Zeilen in studio.js.

**Die Seitenleiste hat vier Zonen**, von oben nach unten:

1. `#ordnerListe` - die Ordner des Nutzers. Hier steht nur, was auch auf der
   Platte liegt.
2. `#systemListe`, nach "Ordner einstellen" - Ansichten, mit denen man
   arbeitet (die Vorlagen).
3. `.fuss` - OpenRouter, Guthaben, Verbrauch. Laesst sich ueber `#fussKnopf`
   zuklappen und startet zugeklappt; der Stand steht in `localStorage` unter
   `kynto-fuss-zu`.
4. `#untenListe`, ganz zuletzt - was die App selbst betrifft (die
   Einstellungen). Steht seit 6.9.2026 UNTER dem Fuss, an der Stelle, wo
   frueher der Verlaufs-Knopf sass.

Gesteuert ueber `platz: 'oben'|'unten'` in `meldeAnsicht`. **Genau EIN
`margin-top: auto` in dieser Spalte** - es haengt am `.fuss`. Zwei solche
Angaben teilen sich den freien Platz und schieben beide Bloecke in die Mitte;
`.verlauf-knopf` traegt noch eins, das ist aber totes CSS, seit der Knopf aus
dem HTML raus ist.

**Der Verlauf hat zwei Zeichenwege.** `verlauf-fenster.js` kann ins eigene
Fenster (`oeffne()`, die Markierung dafuer steht noch im HTML) und ueber
`zeichneIn(ziel)` in die Einstellungen, wo er als dritter Reiter sitzt.
Benutzt wird derzeit nur der zweite.

Module reden ueber Rueckruf-Setzer miteinander (`setzeKlickZiel`,
`setzeAenderungsZiel`), nicht ueber Direktzugriffe. Bitte so lassen.

---

## Die Regeln, die nicht verhandelbar sind

**1. Nichts kostet Geld ohne Klick.**
Der Assistent darf teure Werkzeuge (`bild_erzeugen`, `video_erzeugen`) nur
*vorschlagen*. `werkzeuge.fuehreAus` hat fuer sie **keinen** Ausfuehrungspfad
– die Weigerung steht im Code, nicht nur im Systemhinweis. Ausgeloest wird
ausschliesslich ueber `POST /api/erzeugen` und `POST /api/animieren`,
denselben Weg wie der Knopf unten. Beide reichen an `lib/auftrag-*` weiter,
und dort sitzt die Bremse – nicht in der Route. Es darf nie einen zweiten
Weg zum Erzeugen geben.

**2. Die KI waehlt kein Modell.**
Kein Werkzeug hat ein Modell-Feld. Lassen Modell, Format, Clip-Dauer oder
Aufloesung in einem Request weg, gilt `konfig.STANDARD` – also das, was der
Mensch in der App eingestellt hat. Das gilt fuer den Assistenten wie fuer
jedes fremde Skript. Deshalb stehen diese Werte auf dem Server und nicht in
`merker.js`: sonst wuesste nur ein Browserfenster davon.

**3. Nichts ausserhalb der Wurzel.**
Kein `fs`-Aufruf ohne `absolut()` oder `pruefeInnerhalb()` davor.

**4. Die App legt keine Ordner an, die niemand wollte.**
Ohne Konfiguration startet sie mit leerer Galerie und einem Hinweis. Ordner
entstehen nur ueber "Ordner einstellen" oder wenn ein eingerichteter
schreibbarer Ordner fehlt.

**5. Der Schluessel bleibt auf dem Server.**
Er wird nie an den Browser geschickt, und es gibt kein Eingabefeld dafuer.
`.env` und `daten/` sind git-ignoriert – das bleibt so.

**6. Anzahl faengt immer bei 1 an.**
`merker.js` merkt sich Modell, Format und Haken ueber den Reload. Die Anzahl
ausdruecklich nicht, sonst kostet ein vergessenes "6×" das Sechsfache. Die
eine Ausnahme ist eine geladene Vorlage: die zeigt ihr "3×" in der Liste an,
der Klick ist bewusst, und der Preis steht sofort in der Schaetzung.

**7. Es gibt genau eine Bremse.**
`kosten.pruefe(art)` sitzt in `/api/erzeugen`, `/api/animieren` und vor
jedem Chat-Zug. Ein vierter Weg, der Geld ausgibt, darf nicht entstehen -
und wenn doch, geht er durch dieselbe Pruefung. Die Grenzen stehen in
`studio.config.json` unter `grenzen`, pro Tag, leer heisst aus.

**8. Eine Vorlage fuellt nur Felder.**
`erzeugen.ladeVorlage` setzt Motiv, Modell, Format, Haken und Referenz - und
loest nichts aus. Sonst waere sie ein zweiter Weg zum Erzeugen, und Regel 1
haette ein Loch.

---

## Stil im Code

- **Deutsche Namen**, auch fuer Funktionen und Variablen: `erzeugeBild`,
  `bestandFuerAnsicht`, `halteFest`. Keine Mischung.
- **Keine Umlaute in Kommentaren und Bezeichnern** – `ue`, `oe`, `ae`, `ss`.
  In Oberflaechentexten (HTML, Meldungen fuer den Menschen) dagegen schon.
- **Kommentare erklaeren das Warum**, nie das Was. Besonders dort, wo etwas
  ein Notbehelf fuer eine echte Macke ist. Davon gibt es einige, und sie
  haben Stunden gekostet – vor dem Anfassen lesen.
- Jede Datei beginnt mit einem Kopfkommentar: was macht sie, was macht sie
  bewusst nicht.
- Keine Frameworks, kein Build, keine Abhaengigkeiten.
- Commit-Nachrichten deutsch, eine Zeile, sagen was sich **fuer den Nutzer**
  aendert – nicht welche Funktion umbenannt wurde. Beispiele im Log.

---

## Fallen, die schon Zeit gekostet haben

- **Bildmodelle fehlen in der Modell-Liste.** OpenRouters `/api/v1/models`
  gibt sie nur mit `?output_modalities=image` aus. Gleiches fuer Video.
- **`pricing.image` ist der falsche Preis** – das ist der Preis fuer ein
  *Eingabe*-Bild. Richtig ist `image_output` × ~1290 Token je 1024er Bild
  (`preise.TOKEN_PRO_BILD`). Fuer Video liefert OpenRouter gar keinen Preis,
  dort hilft nur messen.
- **Tagesgrenze nach lokaler Uhr**, nicht `toISOString()`. Sonst zaehlt die
  App zwischen Mitternacht und 02:00 noch auf gestern.
- **PowerShell 5.1 liest BOM-lose Dateien als ANSI.** Deshalb in `start.ps1`
  `[System.IO.File]::ReadAllText(..., UTF8)` statt `Get-Content` – sonst
  kommen Umlaute in Pfaden kaputt an.
- **Nur Modelle mit `tools` in `supported_parameters`** taugen fuer den Chat.
  Ohne Werkzeuge kann der Assistent nichts ausser reden.
- **Werkzeugbeschreibungen allein reichen nicht.** Sie sagen, was ein
  Werkzeug tut, nicht bei welcher Frage man es zieht. Ohne den Abschnitt
  "WANN DU WAS AUFRUFST" im Systemhinweis antworten schwaechere Modelle aus
  dem Nichts: gemessen 6.9.2026 hat `gemma4:12b` "wie viele Bilder habe ich"
  frei erfunden. Mit der Zuordnung ruft dasselbe Modell beim ersten Anlauf
  sauber auf. Wer ein Werkzeug ergaenzt, ergaenzt dort eine Zeile.
- **OpenRouter verraet nichts ueber Bild- und Clip-Masse.** Kein einziges der
  52 Bild- und 28 Videomodelle nennt in der Modell-Liste, welche
  Seitenverhaeltnisse, Dauern oder Aufloesungen es annimmt (nachgesehen
  05.09.2026); die Beschreibungen sind abgeschnitten. Beim Seitenverhaeltnis
  liest `anbieter-openrouter-bild.mjs` die erlaubten Werte deshalb aus der
  Ablehnung. Fuer Dauer und Aufloesung stehen feste Listen in
  `konfig.VIDEO_DAUERN` / `VIDEO_AUFLOESUNGEN` - ohne Selbstkorrektur, weil
  ein Clip zu teuer ist, um den Fall zum Ausprobieren zu rendern.
- **Zwei Text-Renderer, die identisch bleiben muessen:** `web/vorschau.js`
  zeichnet sofort im Browser, `skripte/text.ps1` rendert die Wahrheit auf dem
  Server. Gleicher Umbruch, gleiche relative Masse, gleicher Rand von 6 %.
  Wer einen aendert, aendert beide.
- **Kein `cache-control` ausser `no-store`** fuer web/-Dateien, sonst zeigt
  der Browser nach jeder CSS-Aenderung den alten Stand.
- **`web/studio.css` und `web/raster.js` haengen zusammen:** `MIN_KACHEL` und
  `ABSTAND` muessen zu `grid-template-columns` und `gap` passen.

---

## Bekannte Baustellen

- **Nur Windows.** `format.mjs`, `text.mjs` und `schriften.mjs` rufen
  PowerShell mit System.Drawing. Portierung heisst: diese drei ersetzen,
  sonst nichts.
- **Video ist Beta.** Fehlerpfade geprueft, Erfolgsfall kaum gelaufen.
- **Schriften kommen vom System.** Was fehlt, faellt aus dem Menue, statt
  still ersetzt zu werden.
- **Einplatzig.** Keine Anmeldung, kein Mehrbenutzerbetrieb. Nicht ins Netz
  haengen.

---

## Beim Aendern

- Neue Fachlogik gehoert in `lib/`, nicht in `server.mjs`.
- Neuer Anbieter: `lib/anbieter-openrouter-bild.mjs` als Vorlage nehmen,
  Katalog getrennt in ein `modelle-*.mjs`. Ausnahme: `ollama.mjs` haelt
  beides, weil der Katalog dort drei Zeilen ist - "frag den Dienst, was
  installiert ist" - und keine gepflegte Datenliste.
- Neue Route: Eintrag in `routen` in `server.mjs`, Aufruf in `web/api.js`.
- Alles, was Geld kostet oder Dateien schreibt, wandert in den Verlauf
  (`verlauf.halteFest`) – mit `quelle`, damit man sieht, wer es ausgeloest hat.
- README ist die Aussenansicht des Projekts. Wer ein Verhalten aendert, das
  dort beschrieben ist, aendert es dort mit.
- Bei einer groesseren Sache kommt eine Notiz in `aenderungen/` dazu — siehe
  den naechsten Abschnitt.

---

## Notiz in `aenderungen/` — Pflicht, aber nicht fuer alles

Der Ordner ist **git-ignoriert**. Die Notizen sind die Uebergabe zwischen
Arbeitssitzungen - wer nach einer Pause weitermacht, liest hier nach, was
zuletzt passiert ist und warum. Sie gehen niemanden ausserhalb etwas an;
nach aussen sprechen die Commit-Nachrichten und das README.

**Jede groessere Sache bekommt eine eigene `.md` in `aenderungen/`.** Immer
eine neue Datei, nie an eine bestehende angehaengt: eine Aenderung, eine
Datei. Dazu eine Zeile oben in `aenderungen/README.md`. Der Aufbau — die
fuenf Abschnitte — steht dort.

Ohne Aufforderung machen, nicht erst wenn jemand danach fragt.

**Wann eine Notiz faellig ist** — eins davon reicht:

- eine neue Funktion, die der Mensch in der App sieht (Vorlagen, Text auf
  Bild, das Verlaufsfenster)
- ein neues Modul in `lib/` oder `web/`
- eine neue Route oder ein geaendertes API-Verhalten
- eine neue Datei unter `daten/`
- eine der Regeln oben wird beruehrt oder kommt dazu
- ein Umbau, der ueber drei, vier Dateien geht

Was noch nicht gebaut ist, gehoert nicht hierher, sondern nach `plaene/` -
eine Datei je Vorhaben. Wird es gebaut, wandert der Plan raus und die Notiz
tritt an seine Stelle: Plaene und Wirklichkeit gehen auseinander, und die
Notiz sagt, was wirklich herausgekommen ist.

**Wann nicht** — dafuer reicht die Commit-Zeile:

- Tippfehler, Wortdreher, ein Satz im README
- ein Abstand im CSS, eine Farbe, eine Beschriftung
- ein Einzeiler-Fehler, der nichts am Verhalten der App aendert
- Umbenennen ohne Wirkung nach aussen

Im Zweifel schreiben. Eine Notiz zu viel kostet fuenf Minuten, eine fehlende
kostet spaeter eine Stunde Suchen.

**Warum ueberhaupt:** Ein Diff sagt, *was* sich geaendert hat. Nie, *warum*.
Nach zwei Wochen ist genau das die Frage — und dann steht in
`web/erzeugen.js +146` nichts mehr drin, was weiterhilft.
