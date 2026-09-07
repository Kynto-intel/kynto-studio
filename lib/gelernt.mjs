// Was die App aus Ablehnungen gelernt hat - ueber den Neustart hinaus.
//
// OpenRouter sagt im Katalog nicht, welche Seitenverhaeltnisse ein Bildmodell
// annimmt und welche Aufloesungen ein Videomodell. Nachgesehen am 05.09.2026:
// kein einziges der 52 Bildmodelle nennt es. Nur die Ablehnung nennt es, und
// die bekommt man erst, wenn man gefragt hat.
//
// Bis 7.9.2026 stand dieses Wissen in zwei Map-Objekten im Arbeitsspeicher.
// Jeder Neustart hat es weggeworfen, und die App ist danach in denselben
// Fehler gelaufen wie am Tag davor. Beim Bild kostet das einen ueberfluessigen
// Anlauf, beim Video hat es Felix am 6.9. zweimal ratlos vor derselben
// englischen Meldung stehen lassen.
//
// Hier liegt es jetzt in daten/gelernt.json. Klartext, klein, im selben
// Ordner wie Verlauf und Verbrauch - also von der .gitignore erfasst.
//
// Was hier NICHT passiert: raten. Eingetragen wird ausschliesslich, was ein
// Anbieter woertlich abgelehnt hat. Nichts in dieser Datei entsteht aus einer
// Vermutung, und nichts loest von sich aus einen Aufruf aus.

import fs from 'node:fs';
import { datenPfad } from './konfig.mjs';

const DATEI = datenPfad('gelernt.json');

/** Leerer Stand. Frisch installiert weiss die App nichts. */
const LEER = { stand: 1, verhaeltnis: {}, aufloesung: {} };

/**
 * Der geladene Stand.
 *
 * Einmal von der Platte, danach aus dem Speicher: gefragt wird bei JEDEM
 * Bild, und ein Lesevorgang pro Bild waere Arbeit ohne Ertrag - die Datei
 * aendert nur diese App selbst.
 */
let stand = null;

function lade() {
  if (stand) return stand;
  try {
    const roh = JSON.parse(fs.readFileSync(DATEI, 'utf8'));
    stand = {
      stand: 1,
      verhaeltnis: roh?.verhaeltnis && typeof roh.verhaeltnis === 'object' ? roh.verhaeltnis : {},
      aufloesung: roh?.aufloesung && typeof roh.aufloesung === 'object' ? roh.aufloesung : {},
    };
  } catch {
    // Fehlt oder ist kaputt: dann faengt die App wieder bei null an und
    // lernt es beim naechsten Lauf neu. Ein unlesbares Gedaechtnis darf
    // den Start nicht aufhalten - hier steht nichts, was nicht wieder
    // beschaffbar waere.
    stand = { ...LEER, verhaeltnis: {}, aufloesung: {} };
  }
  return stand;
}

function schreibe() {
  try {
    fs.writeFileSync(DATEI, `${JSON.stringify(stand, null, 2)}\n`, 'utf8');
  } catch {
    // Stumm. Die Erkenntnis gilt fuer diesen Lauf trotzdem, sie ueberlebt
    // nur den Neustart nicht. Ein Schreibfehler hier darf niemals ein
    // Bild verhindern, das gerade unterwegs ist.
  }
}

function heute() {
  return new Date().toISOString().slice(0, 10);
}

// --- Seitenverhaeltnis (Bild) ------------------------------------------------

/** Was dieses Modell statt des gewuenschten Verhaeltnisses nimmt. */
export function ersatzVerhaeltnis(modell, gewuenscht) {
  return lade().verhaeltnis[`${modell}|${gewuenscht}`]?.ersatz || null;
}

/** Nach einer Ablehnung: merken, was das Modell stattdessen genommen hat. */
export function merkeVerhaeltnis(modell, gewuenscht, ersatz, erlaubte = []) {
  const s = lade();
  s.verhaeltnis[`${modell}|${gewuenscht}`] = {
    ersatz,
    erlaubte: erlaubte.slice(),
    seit: heute(),
  };
  schreibe();
}

// --- Aufloesung (Video) ------------------------------------------------------

/** Was dieses Modell laut eigener Ablehnung an Aufloesungen annimmt. */
export function bekannteAufloesungen(modell) {
  return lade().aufloesung[modell]?.erlaubte?.slice() || [];
}

/** Nach einer Ablehnung: die genannten Aufloesungen merken. */
export function merkeAufloesungen(modell, erlaubte) {
  if (!erlaubte?.length) return;
  const s = lade();
  s.aufloesung[modell] = { erlaubte: erlaubte.slice(), seit: heute() };
  schreibe();
}

/**
 * Nimmt dieses Modell die eingestellte Aufloesung - soweit bekannt?
 *
 * Drei Antworten, und die dritte ist die wichtige:
 *   true   ist schon einmal gelaufen oder steht in der erlaubten Liste
 *   false  wurde woertlich abgelehnt
 *   null   noch nie probiert - dann wird nichts behauptet
 *
 * Der Vergleich ist bewusst lose ("2k" trifft "2K"), weil die Anbieter die
 * Schreibweise nicht einheitlich halten.
 */
export function nimmtAufloesung(modell, aufloesung) {
  const erlaubt = bekannteAufloesungen(modell);
  if (!erlaubt.length) return null;
  const gleich = (a, b) => String(a).toLowerCase().trim() === String(b).toLowerCase().trim();
  return erlaubt.some((e) => gleich(e, aufloesung));
}

// --- Anzeige -----------------------------------------------------------------

/** Alles Gelernte, fuer die Anzeige. Kopie, damit niemand von aussen schreibt. */
export function alles() {
  const s = lade();
  return JSON.parse(JSON.stringify({ verhaeltnis: s.verhaeltnis, aufloesung: s.aufloesung }));
}

/** Wie viele Eintraege es gibt - fuer eine Zeile in den Einstellungen. */
export function anzahl() {
  const s = lade();
  return Object.keys(s.verhaeltnis).length + Object.keys(s.aufloesung).length;
}

/** Wo die Datei liegt. */
export const GELERNT_DATEI = DATEI;

/** Nur fuer Tests: den geladenen Stand vergessen und neu von der Platte holen. */
export function vergissZwischenspeicher() {
  stand = null;
}
