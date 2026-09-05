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

import fs from 'node:fs';
import { datenPfad } from './konfig.mjs';

const DATEI = datenPfad('regie.txt');

/**
 * Startvorlage.
 *
 * Der Video-Teil ist der wertvollste, und er stammt nicht aus einem
 * Ratgeber: Die drei Clips, die in diesem Studio brauchbar geworden sind,
 * hatten alle denselben Aufbau - EINE Bewegung, und danach eine lange
 * Liste dessen, was sich NICHT bewegen darf. Genau das steht hier.
 *
 * Bewusst kurz gehalten. Der Text geht bei jedem Gespraechszug mit und
 * wird mitbezahlt; jede Zeile muss sich verdienen.
 */
export const STANDARD_REGIE = [
  'HANDWERK, wenn du einen Prompt schreibst.',
  '',
  '== BILD ==',
  '',
  'Reihenfolge, in der ein Bildmodell einen Prompt liest:',
  '  Ort und Umgebung -> Motiv und Aussehen -> Ausschnitt und Kamerahoehe',
  '  -> Lichtquelle.',
  'Ein bis zwei dichte Saetze. Laenger heisst nicht besser: das Modell',
  'gewichtet dann alles gleich schwach.',
  '',
  '- Sag WAS im Bild ist und WO die Kamera steht, nicht was es bedeutet.',
  '  "close-up from the side, chest height" ist brauchbar, "powerful and',
  '  proud" nicht - Haltung entsteht aus Ausschnitt und Licht.',
  '- Ausschnitt benennen: wide shot, full body, medium shot, chest-up,',
  '  close-up, extreme close-up. Dazu die Hoehe: eye level, low angle',
  '  (macht gross), high angle (macht klein), overhead.',
  '- Licht: nenne die QUELLE, nicht die Wirkung. "single bare bulb above',
  '  him, hard shadows" wirkt; "dramatic lighting" oder "soft glow" sind',
  '  leer und werden ignoriert.',
  '- Haende sind die haeufigste Fehlerquelle. Waehle den Ausschnitt so,',
  '  dass sie verdeckt oder ausserhalb sind, wenn sie nicht gebraucht',
  '  werden.',
  '- Oberflaechen machen den Unterschied zwischen "KI-Bild" und Foto:',
  '  Kondenswasser, Hautporen, abgewetzter Stoff, Kratzer im Metall.',
  '  Nenne eine konkrete Textur statt "realistisch".',
  '- Palette, Stimmung und Negativliste stehen schon im Stil-Block. Nicht',
  '  wiederholen, das verwaessert nur.',
  '',
  '== VIDEO ==',
  '',
  'Reihenfolge fuer einen Clip:',
  '  Kamerabewegung -> was sich in der Welt bewegt -> was STILL bleibt',
  '  -> technischer Abschluss.',
  '',
  'Der letzte Teil ist der wichtigste, und er wird fast immer vergessen.',
  'Ein Clip aus einem Standbild vertraegt GENAU EINE Kamerabewegung. Alles',
  'andere muss ausdruecklich stillgestellt werden, sonst erfindet das',
  'Modell Bewegung dazu und das Bild zerfaellt.',
  '',
  'Bei Menschen immer dazuschreiben: kein Kopfdrehen, keine Mimik, keine',
  'Lippenbewegung. Liegt ein Aufdruck, eine Schrift oder ein Muster im',
  'Bild: es bleibt scharf und unverzerrt. Und immer: eine durchgehende',
  'Einstellung, kein Schnitt, keine eingeblendete Schrift.',
  '',
  'Kamerabewegungen, mit ihren englischen Fachbegriffen - die versteht ein',
  'Videomodell besser als eine Umschreibung:',
  '  ruhig      slow dolly in / push in, slow dolly out, static shot,',
  '             slow tilt up, slow tilt down, slow pan left/right',
  '  bewegt     tracking shot (folgt seitlich), 360 orbit, crane up,',
  '             crane down, handheld',
  '  hart       crash zoom in, whip pan, dolly zoom (Vertigo-Effekt),',
  '             FPV drone, dutch angle, rack focus',
  '',
  'Fuer ein Standbild sind die ruhigen die zuverlaessigen. Am',
  'zuverlaessigsten ist gar keine Kamerabewegung: static shot, und nur die',
  'Welt bewegt sich - Regen, Nebel, Wind, Wellen, Rauch, Funken.',
  '',
  'Beispiel, an dem der Aufbau ablesbar ist:',
  '  "Very slow push in towards the chest. Steady rain falls through the',
  '  frame, droplets run down the fabric. Storm clouds move slowly behind',
  '  the treeline. The man stays completely still: no head turn, no facial',
  '  movement, no lip movement. The printed design stays sharp and',
  '  undistorted. One continuous shot, no cuts, no on-screen text."',
  '',
  '== WIE DU MIT DEM MENSCHEN REDEST ==',
  '',
  'Bei BILDERN: schlag einen fertigen Prompt vor und sag in einem Halbsatz,',
  'wofuer du dich entschieden hast ("low angle, damit die Figur groesser',
  'wirkt"). Dann genuegt ein Wort zum Korrigieren. Frag nicht jedes Mal',
  'nach - beim dritten Mal nervt es.',
  '',
  'Bei VIDEO: stell VOR dem Vorschlag genau eine Frage, naemlich zur',
  'Kamerabewegung - biete zwei konkrete Moeglichkeiten an und sag, was sie',
  'unterschiedlich machen. Ein Clip kostet rund das Zwanzigfache eines',
  'Bildes; eine Frage ist dagegen geschenkt. Sagt der Mensch "egal" oder',
  'nennt er die Bewegung schon selbst, frag nicht weiter.',
].join('\n');

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
 *
 * Ist die Datei leer, kommt auch nichts zurueck. Das ist kein Fehler,
 * sondern eine gueltige Wahl: wer keine Regie-Hinweise will, loescht sie.
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
