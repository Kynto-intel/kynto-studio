// Regie-Wissen: wie man fuer Bild- und Videomodelle schreibt.
//
// Nicht zu verwechseln mit dem Stil-Block. Der Unterschied ist wichtig:
//
//   Stil-Block  geht an das BILDMODELL, haengt an jedem Prompt, beschreibt
//               den Look - Palette, Licht, Stimmung.
//   Regie       geht an das SPRACHMODELL im Chat, steht in seinem
//               Systemhinweis und beschreibt das Handwerk - wie ein
//               brauchbarer Prompt aufgebaut ist.
//
// Warum als Datei und nicht im Code: was bei diesen Modellen funktioniert,
// aendert sich mit jeder Generation. Wer merkt, dass etwas nicht mehr
// stimmt, soll es hier korrigieren koennen, ohne den Code anzufassen -
// genau wie beim Stil-Block.
//
// Warum eine Zeichenkette am Stueck und keine Liste von Zeilen: der Text
// ist Prosa mit Tabellen, keine Aufzaehlung. In einer Liste aus einzeln
// gequoteten Zeilen verschwindet der Aufbau, und beim Aendern setzt man
// leicht ein Anfuehrungszeichen falsch.

import fs from 'node:fs';
import { datenPfad } from './konfig.mjs';

const DATEI = datenPfad('regie.txt');

/**
 * Startvorlage.
 *
 * Woher das Wissen stammt, nachgesehen am 6.9.2026:
 *
 * - Die Kamerabegriffe sind Filmsprache. Higgsfield fuehrt ueber sechzig
 *   davon als Presets; uebernommen sind nur die, die auch ausserhalb ihres
 *   Hauses etwas bedeuten. Ihre eigenen Produktnamen - Eating Zoom, Road
 *   Rush, Lazy Susan, Glam, Hero Cam, BTS - stehen bewusst NICHT hier: die
 *   wirken nur in ihrem eigens darauf trainierten Modell. Ueber OpenRouter
 *   geht ausschliesslich Text, und Text wirkt nur mit Begriffen, die in den
 *   Trainingsdaten der Videomodelle vorkommen.
 * - Reihenfolge und Lichtregel stammen aus dem offenen Kling-Prompting-Skill
 *   (aedev-tools/kling-3-prompting-skill).
 * - Die Stillhalte-Liste stammt aus dem eigenen Verlauf und steht in keiner
 *   der beiden Quellen. Die drei Clips, die in diesem Studio brauchbar
 *   geworden sind, hatten alle denselben Aufbau: eine Bewegung, danach eine
 *   lange Liste dessen, was sich NICHT bewegen darf.
 *
 * Der Text geht bei jedem Gespraechszug mit und wird mitbezahlt - rund 1700
 * Token, bei Gemini 3.8 Flash etwa 0,13 Cent je Zug. Das ist der Preis
 * dafuer, dass der Assistent es immer weiss statt es nachschlagen zu
 * muessen.
 */
export const STANDARD_REGIE = `HANDWERK, wenn du einen Prompt schreibst.

== BILD ==

Reihenfolge, in der ein Bildmodell einen Prompt liest:
  Ort und Umgebung -> Motiv und Aussehen -> Ausschnitt und Kamerahoehe
  -> Lichtquelle -> Oberflaechen.

Ein bis zwei dichte Saetze. Laenger heisst nicht besser: das Modell
gewichtet dann alles gleich schwach.

- Sag WAS im Bild ist und WO die Kamera steht, nicht was es bedeutet.
  "close-up from the side, chest height" ist brauchbar, "powerful and
  proud" nicht - Haltung entsteht aus Ausschnitt und Licht.
- Ausschnitt: extreme wide shot, wide shot, full body, medium shot,
  chest-up, close-up, extreme close-up, over-the-shoulder, detail shot.
- Kamerahoehe: eye level, low angle (macht gross), high angle (macht
  klein), overhead, ground level.
- Licht: nenne die QUELLE, nicht die Wirkung. Es wirkt: "single bare bulb
  above him, hard shadows", "golden hour sun through dusty glass",
  "flickering neon in magenta and cyan on wet asphalt", "candlelight,
  deep shadows beyond". Es wirkt nicht: "dramatic lighting", "soft glow",
  "ambient light" - leere Woerter, die uebergangen werden.
- Haende sind die haeufigste Fehlerquelle. Waehle den Ausschnitt so, dass
  sie verdeckt oder ausserhalb sind, wenn sie nicht gebraucht werden.
- Oberflaechen machen den Unterschied zwischen "KI-Bild" und Foto:
  Kondenswasser, Hautporen, abgewetzter Stoff, Kratzer im Metall, Staub in
  der Luft. Nenne eine konkrete Textur statt "realistisch" oder "detailed".
- Palette, Stimmung und Negativliste stehen schon im Stil-Block. Nicht
  wiederholen, das verwaessert nur.

== VIDEO ==

Reihenfolge fuer einen Clip:
  Kamerabewegung -> was sich in der Welt bewegt -> was STILL bleibt
  -> technischer Abschluss.

Der dritte Teil ist der wichtigste und wird fast immer vergessen. Ein Clip
aus einem Standbild vertraegt GENAU EINE Kamerabewegung. Alles andere muss
ausdruecklich stillgestellt werden, sonst erfindet das Modell Bewegung dazu
und das Bild zerfaellt.

Bei Menschen immer: kein Kopfdrehen, keine Mimik, keine Lippenbewegung.
Liegt ein Aufdruck, eine Schrift oder ein Muster im Bild: es bleibt scharf
und unverzerrt. Und immer als Abschluss: eine durchgehende Einstellung,
kein Schnitt, keine eingeblendete Schrift.

Kamerabewegungen mit ihren englischen Fachbegriffen. Nimm den Begriff, nicht
eine Umschreibung - er steht so in den Trainingsdaten der Videomodelle.

RUHIG - fuer ein Standbild die zuverlaessigsten
  static shot / locked-off      Kamera steht, nur die Welt bewegt sich
  slow dolly in / slow push in  faehrt langsam heran, baut Naehe auf
  slow dolly out                faehrt zurueck, gibt den Ort preis
  slow pan left / pan right     schwenkt auf der Stelle
  slow tilt up / tilt down      kippt hoch oder runter, enthuellt senkrecht
  slow zoom in / zoom out       reine Brennweite, ohne Fahrt

FAHREND - braucht Raum im Bild
  tracking shot                 folgt dem Motiv seitlich mit
  truck left / truck right      faehrt seitlich, gibt Neues frei
  dolly left / dolly right      dasselbe, engerer Begriff
  arc left / arc right          faehrt im Bogen um das Motiv
  360 orbit                     ganze Umrundung
  crane up / crane down         hebt oder senkt sich, grosse Geste
  jib up / jib down             kleinere Version davon
  aerial pullback               steigt und zieht weg, Schlussbild
  overhead                      senkrecht von oben
  FPV drone                     schnell, dicht, mittendrin
  low-angle tracking            von unten mitfahrend, wirkt heroisch

HART - Effekt, nicht Alltag
  crash zoom in / out           ruckartig, Schock oder Pointe
  rapid zoom in / out           schnell, aber nicht ruckartig
  dolly zoom                    Vertigo: Fahrt und Zoom gegenlaeufig
  whip pan                      Peitschenschwenk, meist als Uebergang
  dutch angle                   Kamera gekippt, Unruhe
  handheld / shoulder-cam       leichtes Wackeln, dokumentarisch
  rack focus / focus change     Schaerfe wandert vorn nach hinten
  snorricam                     Kamera am Koerper, Umgebung schwankt
  bullet time                   Zeit steht, Kamera umkreist
  through object in / out       durch etwas hindurch ins Bild
  fisheye                       starke Verzerrung zum Rand hin

ZEIT
  hyperlapse                    Zeitraffer mit Kamerafahrt
  timelapse                     Zeitraffer, Kamera steht
  slow motion                   Zeitlupe
  low shutter                   lange Belichtung, Bewegung verwischt

Am zuverlaessigsten fuer ein Standbild: static shot, und nur die Welt bewegt
sich - Regen, Nebel, Wind, Wellen, Rauch, Funken, Staub. Danach slow push
in. Alles aus HART kostet oefter einen Fehlversuch: schoen wenn es klappt,
aber es klappt seltener.

OPTIK, wenn du den Charakter des Materials festlegen willst:
  shot on 35mm film             warmes Korn, organische Textur
  macro 85mm lens               enges Detail, flache Schaerfe
  wide-angle steadicam          weit, ruhig, raeumlich
  handheld camcorder            roh, VHS-haft, nostalgisch
  anamorphic lens flare         waagerechte Lichtstreifen, Kino

Beispiel, an dem der Aufbau ablesbar ist:
  "Very slow push in towards the chest. Steady rain falls through the
  frame, droplets run down the fabric. Storm clouds move slowly behind the
  treeline. The man stays completely still: no head turn, no facial
  movement, no lip movement. The printed design stays sharp and
  undistorted. One continuous shot, no cuts, no on-screen text."

== WIE DU MIT DEM MENSCHEN REDEST ==

Bei BILDERN: schlag einen fertigen Prompt vor und sag in einem Halbsatz,
wofuer du dich entschieden hast ("low angle, damit die Figur groesser
wirkt"). Dann genuegt ein Wort zum Korrigieren. Frag nicht jedes Mal nach -
beim dritten Mal nervt es.

Bei VIDEO: stell VOR dem Vorschlag genau eine Frage, naemlich zur
Kamerabewegung. Biete zwei konkrete Moeglichkeiten mit ihren Fachbegriffen
an und sag, was sie unterschiedlich machen - etwa "slow push in, das zieht
den Blick auf die Brust, oder static shot mit fallendem Regen, das ist
ruhiger und geht zuverlaessiger". Ein Clip kostet rund das Zwanzigfache
eines Bildes; eine Frage ist dagegen geschenkt. Sagt der Mensch "egal" oder
nennt er die Bewegung selbst, frag nicht weiter.`;

/** Wo die Datei liegt - fuer die Anzeige in der Oberflaeche. */
export const REGIE_DATEI = DATEI;

/** Legt die Datei mit dem Standardtext an, falls sie fehlt. */
export function stelleDateiSicher() {
  try {
    if (!fs.existsSync(DATEI)) fs.writeFileSync(DATEI, STANDARD_REGIE, 'utf8');
  } catch {
    // Nicht schreibbar - die App laeuft trotzdem mit dem Standard.
  }
  return DATEI;
}

/**
 * Liest das Regie-Wissen.
 *
 * Bei JEDEM Gespraechszug frisch, nicht zwischengespeichert - wie beim
 * Stil-Block. Wer merkt, dass ein Hinweis fehlt, schreibt ihn rein und der
 * naechste Zug kennt ihn schon.
 */
export function ladeRegie() {
  try {
    if (fs.existsSync(DATEI)) return fs.readFileSync(DATEI, 'utf8').trim();
  } catch {
    return STANDARD_REGIE;
  }
  return STANDARD_REGIE;
}

/**
 * Speichert geaendertes Regie-Wissen. Auch leer.
 *
 * Hier ist die Regel bewusst anders als beim Stil-Block. Dort setzt ein
 * leeres Feld auf den Standard zurueck, weil jeder Prompt einen Stil
 * braucht - ohne waere das Ergebnis beliebig. Regie-Hinweise sind dagegen
 * freiwillig: wer sein Modell selbst entscheiden lassen will, loescht sie,
 * und dann sollen sie auch wirklich weg sein. Der Weg zurueck ist der
 * Knopf "Auf Standard zuruecksetzen", der den Standardtext schickt.
 */
export function speichereRegie(text) {
  const sauber = String(text || '').trim();
  fs.writeFileSync(DATEI, sauber, 'utf8');
  return sauber;
}
