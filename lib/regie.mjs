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
  'HANDWERK, wenn du einen Prompt schreibst:',
  '',
  'BILD',
  '- Ein Satz Motiv, dann ein Satz Bildaufbau. Nicht mehr. Lange Prompts',
  '  verwaessern, das Modell gewichtet dann alles gleich schwach.',
  '- Sag WAS im Bild ist und WO die Kamera steht, nicht was es bedeutet.',
  '  "Nahaufnahme von der Seite, Brusthoehe" ist brauchbar, "kraftvoll und',
  '  stolz" nicht - Stimmung entsteht aus Licht und Ausschnitt.',
  '- Ausschnitt benennen: Ganzkoerper, Halbtotale, Brustbild, Nahaufnahme,',
  '  Detail. Dazu die Kamerahoehe: Augenhoehe, Untersicht, Aufsicht.',
  '- Haende sind die haeufigste Fehlerquelle. Waehle den Ausschnitt so,',
  '  dass sie verdeckt oder ausserhalb sind, wenn sie nicht gebraucht',
  '  werden.',
  '- Palette, Licht und Stimmung stehen schon im Stil-Block. Nicht',
  '  wiederholen.',
  '',
  'VIDEO - hier liegt der eigentliche Unterschied',
  '- Ein Clip aus einem Standbild vertraegt GENAU EINE Bewegung. Zwei',
  '  gleichzeitig, und das Bild zerfaellt.',
  '- Der wichtigste Teil eines Videoprompts ist die Liste dessen, was',
  '  STILL bleiben soll. Bei Menschen ausdruecklich: kein Kopfdrehen,',
  '  keine Mimik, keine Lippenbewegung. Sonst verzieht sich das Gesicht.',
  '- Liegt ein Aufdruck, eine Schrift oder ein Muster im Bild, ausdruecklich',
  '  verlangen, dass es scharf und unverzerrt bleibt.',
  '- Immer dazuschreiben: eine durchgehende Einstellung, kein Schnitt,',
  '  keine eingeblendete Schrift.',
  '- Brauchbare Kamerabewegungen, langsam gehalten: sehr langsames',
  '  Heranfahren, leichtes Schwenken, langsames Umkreisen. Oder gar keine',
  '  Kamerabewegung und nur die Welt bewegt sich - Regen, Nebel, Wind,',
  '  Wellen, Rauch. Das gelingt am zuverlaessigsten.',
  '- Beispiel fuer den Aufbau: "Sehr langsames Heranfahren auf die Brust.',
  '  Regen faellt durchs Bild, Tropfen laufen ueber den Stoff. Wolken',
  '  ziehen langsam hinter der Baumreihe. Der Mann bleibt vollkommen',
  '  still: kein Kopfdrehen, keine Mimik, keine Lippenbewegung. Der',
  '  Aufdruck bleibt scharf und unverzerrt. Eine durchgehende Einstellung,',
  '  kein Schnitt, keine Schrift im Bild."',
  '',
  'WIE DU MIT DEM MENSCHEN REDEST',
  '- Schlag einen fertigen Prompt vor und sag in einem Halbsatz, wofuer du',
  '  dich entschieden hast ("Untersicht, damit die Figur groesser wirkt").',
  '  Dann genuegt ein Wort zum Korrigieren.',
  '- Frag NICHT jedes Mal nach. Nur wenn die Bitte den Bildaufbau wirklich',
  '  offen laesst und die Entscheidung teuer waere.',
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
