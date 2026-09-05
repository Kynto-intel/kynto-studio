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
 * Vorne kuerzen, aber nie mitten in einer Werkzeug-Folge anfangen.
 */
function kuerze(nachrichten) {
  let liste = Array.isArray(nachrichten) ? nachrichten.filter(Boolean) : [];
  if (liste.length > MAX_NACHRICHTEN) {
    liste = liste.slice(-MAX_NACHRICHTEN);
    while (liste.length && liste[0].role === 'tool') liste.shift();
  }
  return liste;
}

/**
 * Antworten ohne Aufruf wegwerfen.
 *
 * Eine tool-Zeile, zu der weiter oben kein passender tool_call steht, macht
 * den GESAMTEN Verlauf ungueltig - jede weitere Anfrage kommt mit HTTP 400
 * zurueck, egal mit welchem Modell, und lasst sich durch Weiterschreiben
 * nicht mehr heilen. Das Gespraech ist dann tot, bis jemand die Datei
 * loescht.
 *
 * Am 05.09.2026 genau so passiert: nach einem Vorschlag schnitt das
 * Speichern den Aufruf weg, der Browser hing seine Antwort trotzdem an -
 * und ab da ging nichts mehr. Deshalb wird hier geprueft und nicht nur
 * darauf vertraut, dass die Paare stimmen.
 */
function ohneVerwaiste(liste) {
  const bekannt = new Set();
  const sauber = [];
  for (const n of liste) {
    if (n.role === 'tool') {
      if (!bekannt.has(n.tool_call_id)) continue;
      sauber.push(n);
      continue;
    }
    for (const a of n.tool_calls || []) bekannt.add(a.id);
    sauber.push(n);
  }
  return sauber;
}

/**
 * Hinten alles wegwerfen, was auf eine Antwort wartet, die nie kam.
 *
 * Bricht das Fenster mitten in einem Vorschlag ab, bleibt ein Aufruf ohne
 * Ergebnis zurueck - auch damit lehnt die Schnittstelle ab.
 */
function ohneOffene(liste) {
  for (let i = liste.length - 1; i >= 0; i--) {
    const n = liste[i];
    if (!n.tool_calls?.length) continue;
    const beantwortet = new Set(
      liste.slice(i + 1).filter((z) => z.role === 'tool').map((z) => z.tool_call_id),
    );
    if (n.tool_calls.some((a) => !beantwortet.has(a.id))) return liste.slice(0, i);
  }
  return liste;
}

/**
 * Ein Verlauf, den die Schnittstelle annimmt.
 *
 * Gilt fuer die Platte und fuer alles, was zum Modell rausgeht. Nichts, was
 * aus dem Browser kommt, geht ungeprueft weiter - der Browser haelt seinen
 * eigenen Stand, und der kann schief sein.
 */
export function heile(nachrichten) {
  return ohneOffene(ohneVerwaiste(kuerze(nachrichten)));
}

/**
 * Derselbe Verlauf fuer den Browser - aber MIT einem offenen Aufruf.
 *
 * Der Unterschied ist Absicht. Auf der Platte hat ein unbeantworteter
 * Aufruf nichts verloren: schliesst das Fenster jetzt, beantwortet ihn nie
 * jemand. Der Browser dagegen beantwortet ihn im naechsten Atemzug - er
 * zeigt gerade die Vorschlagskarte. Bekaeme er die gekuerzte Fassung,
 * haenge er seine Antwort an einen Aufruf, den er nicht mehr hat. Genau so
 * entsteht die verwaiste Zeile von oben.
 */
export function fuerBrowser(nachrichten) {
  return ohneVerwaiste(kuerze(nachrichten));
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
