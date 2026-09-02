// Das Gespraech ueberlebt das Schliessen des Fensters.
//
// Liegt in daten/chat.json, neben Verlauf und Verbrauch - also im selben
// Ordner, den die .gitignore ausschliesst. Prompts sind persoenlich und
// gehoeren nicht in ein Repository.

import fs from 'node:fs';
import { datenPfad } from './konfig.mjs';

const DATEI = datenPfad('chat.json');

/**
 * Wie viele Nachrichten behalten werden.
 *
 * Nicht aus Platzgruenden - die Datei bliebe klein. Sondern weil bei jedem
 * Zug der GESAMTE Verlauf zum Modell geht und mitbezahlt wird. Ohne Grenze
 * wuerde ein langes Gespraech mit jeder Frage teurer, ohne dass jemand
 * merkt warum.
 */
const MAX_NACHRICHTEN = 60;

/**
 * Schneidet einen Verlauf so zu, dass er wieder gueltig ist.
 *
 * Zwei Regeln der Schnittstelle, gegen die man sonst laeuft:
 *   - Auf jeden Werkzeug-Aufruf MUSS ein Ergebnis folgen. Bricht das
 *     Fenster mitten in einem Vorschlag ab, bleibt ein Aufruf ohne Antwort
 *     zurueck und die naechste Anfrage wird abgelehnt.
 *   - Eine tool-Zeile ohne den zugehoerigen Aufruf davor ist ebenso ungueltig,
 *     was beim Abschneiden vorne passieren kann.
 */
function heile(nachrichten) {
  let liste = Array.isArray(nachrichten) ? nachrichten.filter(Boolean) : [];

  // Vorne kuerzen, aber nie mitten in einer Werkzeug-Folge anfangen.
  if (liste.length > MAX_NACHRICHTEN) {
    liste = liste.slice(-MAX_NACHRICHTEN);
    while (liste.length && liste[0].role === 'tool') liste.shift();
  }

  // Hinten alles wegwerfen, was auf eine Antwort wartet, die nie kam.
  for (let i = liste.length - 1; i >= 0; i--) {
    const n = liste[i];
    if (!n.tool_calls?.length) continue;
    const beantwortet = new Set(
      liste.slice(i + 1).filter((z) => z.role === 'tool').map((z) => z.tool_call_id),
    );
    const offen = n.tool_calls.some((a) => !beantwortet.has(a.id));
    if (offen) {
      liste = liste.slice(0, i);
      break;
    }
  }

  return liste;
}

/** Das gespeicherte Gespraech, schon zurechtgeschnitten. */
export function lies() {
  try {
    if (!fs.existsSync(DATEI)) return [];
    return heile(JSON.parse(fs.readFileSync(DATEI, 'utf8')));
  } catch {
    // Kaputte Datei soll die App nicht aufhalten - lieber ohne Gedaechtnis.
    return [];
  }
}

/** Speichert den Verlauf. Fehler hier duerfen ein Gespraech nie abbrechen. */
export function schreibe(nachrichten) {
  const liste = heile(nachrichten);
  try {
    fs.writeFileSync(DATEI, JSON.stringify(liste, null, 2), 'utf8');
  } catch {
    // Nicht schreibbar: das Gespraech laeuft weiter, nur ohne Gedaechtnis.
  }
  return liste;
}

/** Gespraech verwerfen. */
export function leere() {
  try {
    if (fs.existsSync(DATEI)) fs.unlinkSync(DATEI);
  } catch {
    // egal
  }
  return [];
}
