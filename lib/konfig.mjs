// Zentrale Konfiguration. Einzige Stelle, an der Pfade, Port und
// Schluessel-Namen stehen. Kein anderes Modul liest process.env direkt.
//
// Alles Persoenliche steht in studio.config.json neben dieser App - siehe
// studio.config.beispiel.json. Fehlt die Datei, wird der Ordner ueber der
// App als Wurzel genommen und die Ordnerliste bleibt leer: wer die App zum
// ersten Mal startet, legt seine Ordner selbst an. Frueher wurde hier ein
// Satz Standardordner erzeugt - das legte fremden Leuten ungefragt Ordner
// auf die Platte, die sie nie wollten.
//
// WURZEL, ORDNER und FORMATE sind bewusst `let` und keine Konstanten: Die
// Oberflaeche kann die Ordner zur Laufzeit aendern. Weil ES-Module lebende
// Bindungen exportieren, sehen alle anderen Module die neuen Werte sofort -
// ohne Neustart und ohne dass sie etwas davon wissen muessen.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ladeEnvDatei, ENV_DATEI, AUS_DATEI } from './umgebung.mjs';

// Ganz oben, vor allem anderen: eine .env neben der App fuellt fehlende
// Umgebungsvariablen auf. Muss vor dem ersten schluessel()-Aufruf laufen.
ladeEnvDatei();

const hier = path.dirname(fileURLToPath(import.meta.url));

/** Ordner der App selbst. */
export const APP = path.resolve(hier, '..');

/**
 * Ordner fuer alles, was die App im Betrieb selbst schreibt: Verlauf,
 * Verbrauch, eigener Stil-Block. Steht bewusst getrennt vom Code, damit
 * der Hauptordner uebersichtlich bleibt und ein einzelner Eintrag in der
 * .gitignore reicht.
 */
export const DATEN = path.join(APP, 'daten');

/** Legt den Datenordner an, falls er fehlt. */
export function datenPfad(datei) {
  if (!fs.existsSync(DATEN)) fs.mkdirSync(DATEN, { recursive: true });
  return path.join(DATEN, datei);
}

const KONFIG_DATEI = path.join(APP, 'studio.config.json');

/**
 * Ordner, die im Raster erscheinen. Reihenfolge = Reihenfolge der Filter.
 *
 * Bewusst leer. Die App legt von sich aus keinen einzigen Ordner an - jeder
 * richtet sich selbst ein, was er braucht, ueber "Ordner einstellen" in der
 * Seitenleiste. Solange die Liste leer ist, zeigt das Raster einen Hinweis
 * statt Bildern, und Erzeugen lehnt mit einer klaren Meldung ab.
 */
export const STANDARD_ORDNER = [];

/**
 * genW/genH = was das Modell rendert, zielW/zielH = was die Plattform braucht.
 * Die Seitenverhaeltnisse sind absichtlich identisch, damit nur skaliert und
 * nicht beschnitten werden muss.
 */
function standardFormate(zielId, pinId) {
  return {
    feed:   { label: 'Feed 4:5',      genW: 1024, genH: 1280, zielW: 1080, zielH: 1350, ordner: zielId, suffix: '1080x1350' },
    story:  { label: 'Story 9:16',    genW: 1080, genH: 1920, zielW: 1080, zielH: 1920, ordner: zielId, suffix: '1080x1920' },
    square: { label: 'Quadrat 1:1',   genW: 1024, genH: 1024, zielW: 1080, zielH: 1080, ordner: zielId, suffix: '1080x1080' },
    pin:    { label: 'Pinterest 2:3', genW: 1024, genH: 1536, zielW: 1000, zielH: 1500, ordner: pinId,  suffix: '1000x1500' },
    roh:    { label: 'Roh (unbeschnitten)', genW: 1024, genH: 1024, zielW: 0, zielH: 0, ordner: zielId, suffix: 'roh' },
  };
}

function ladeKonfig() {
  try {
    if (fs.existsSync(KONFIG_DATEI)) {
      return JSON.parse(fs.readFileSync(KONFIG_DATEI, 'utf8'));
    }
  } catch (fehler) {
    console.warn(`studio.config.json ist fehlerhaft, nutze Standardwerte: ${fehler.message}`);
  }
  return {};
}

/** Wurzel fuer alle Datei-Zugriffe. Ausserhalb wird nie gelesen oder geschrieben. */
export let WURZEL;
export let ORDNER;
export let FORMATE;
export let PORT;
export let HOST;

/** Baut die abgeleiteten Werte aus einer rohen Konfiguration. */
function uebernehmen(konfig) {
  WURZEL = path.resolve(konfig.wurzel || path.join(APP, '..'));
  PORT = Number(konfig.port) || 4890;
  HOST = konfig.host || '127.0.0.1';

  const roh = konfig.ordner?.length ? konfig.ordner : STANDARD_ORDNER;
  ORDNER = roh.map((o) => ({ ...o, pfad: path.resolve(WURZEL, o.unterordner) }));

  const zielId = ORDNER.find((o) => o.schreibbar)?.id || ORDNER[0]?.id || null;
  const pinId = ORDNER.find((o) => /pin/i.test(o.id))?.id || zielId;
  FORMATE = konfig.formate || standardFormate(zielId, pinId);

  // Zeigt ein Format auf einen Ordner, den es nicht mehr gibt, landen Bilder
  // sonst im Nichts. Deshalb still auf den ersten schreibbaren umbiegen.
  // Ist noch gar kein Ordner eingerichtet, bleibt das Ziel null - dann
  // greift beim Erzeugen die Meldung aus ordnerNach().
  const bekannt = new Set(ORDNER.map((o) => o.id));
  for (const f of Object.values(FORMATE)) {
    if (!bekannt.has(f.ordner)) f.ordner = zielId;
  }
}

uebernehmen(ladeKonfig());

/** Die rohe Konfiguration, wie sie in der Datei steht. */
export function rohKonfig() {
  const konfig = ladeKonfig();
  return {
    wurzel: WURZEL,
    port: PORT,
    host: HOST,
    ordner: (konfig.ordner?.length ? konfig.ordner : STANDARD_ORDNER)
      .map(({ id, label, hinweis, schreibbar, unterordner }) => ({
        id, label, hinweis, schreibbar, unterordner,
      })),
    formate: FORMATE,
  };
}

/**
 * Schreibt eine geaenderte Konfiguration und uebernimmt sie sofort.
 * Port und Host bleiben unangetastet - die liessen sich ohne Neustart
 * ohnehin nicht wechseln.
 */
export function speichereKonfig({ wurzel, ordner }) {
  const alt = ladeKonfig();
  const neu = { ...alt };

  if (wurzel) {
    const geprueft = path.resolve(String(wurzel));
    if (!fs.existsSync(geprueft)) throw new Error(`Ordner gibt es nicht: ${geprueft}`);
    if (!fs.statSync(geprueft).isDirectory()) throw new Error('Das ist kein Ordner.');
    neu.wurzel = geprueft;
  }

  if (Array.isArray(ordner)) {
    if (!ordner.length) throw new Error('Mindestens ein Ordner muss bleiben.');
    const ids = new Set();
    neu.ordner = ordner.map((o) => {
      const id = String(o.id || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      if (!id) throw new Error('Jeder Ordner braucht eine Kennung.');
      if (ids.has(id)) throw new Error(`Kennung doppelt vergeben: ${id}`);
      ids.add(id);
      if (!String(o.unterordner || '').trim()) {
        throw new Error(`"${o.label || id}" hat keinen Ordnerpfad.`);
      }
      return {
        id,
        label: String(o.label || id).trim(),
        hinweis: String(o.hinweis || '').trim(),
        schreibbar: Boolean(o.schreibbar),
        unterordner: String(o.unterordner).trim(),
      };
    });
    if (!neu.ordner.some((o) => o.schreibbar)) {
      throw new Error('Mindestens ein Ordner muss beschreibbar sein, sonst kann nichts gespeichert werden.');
    }
  }

  // Formate mitziehen, damit sie nicht auf geloeschte Ordner zeigen.
  //
  // uebernehmen() laeuft bewusst VOR dem Schreiben: es biegt Formate, die ins
  // Leere zeigen, auf den ersten schreibbaren Ordner um - und zwar in dem
  // Objekt, das gleich in der Datei landet. Andersherum stuende in der Datei
  // dauerhaft der kaputte Stand, waehrend im Speicher der richtige laeuft.
  // Nach einer frischen Installation faellt genau das auf: vor dem ersten
  // Ordner zeigen die Formate auf gar nichts.
  neu.formate = FORMATE;
  uebernehmen(neu);
  neu.formate = FORMATE;

  fs.writeFileSync(KONFIG_DATEI, `${JSON.stringify(neu, null, 2)}\n`, 'utf8');
  return rohKonfig();
}

/** Entwuerfe rendern auf 75 % Kantenlaenge -> deutlich guenstiger. */
export const KLEIN_FAKTOR = 0.75;

export const BILD_ENDUNGEN = ['.png', '.jpg', '.jpeg', '.webp'];
export const VIDEO_ENDUNGEN = ['.mp4', '.webm', '.mov'];

/** Schluessel werden nur hier gelesen und verlassen den Server nie. */
export function schluessel(name) {
  return process.env[name] || '';
}

/**
 * Woher ein Schluessel stammt - nur die Herkunft, nie der Wert.
 *
 * Steht in beiden Quellen etwas, gewinnt die Umgebungsvariable. Ohne diese
 * Anzeige sucht man sich dumm, warum ein frisch in die .env geschriebener
 * Schluessel nicht greift.
 */
export function schluesselQuelle(name) {
  if (!process.env[name]) return null;
  return AUS_DATEI.has(name) ? 'datei' : 'umgebung';
}

/**
 * Alles, was die Oberflaeche ueber den Schluessel wissen darf: ob einer da
 * ist, woher er kam, wo die Datei liegen wuerde. **Nie der Wert selbst** -
 * der verlaesst den Server nicht.
 */
export function schluesselStand() {
  return {
    quelle: schluesselQuelle('OPENROUTER_API_KEY'),
    envDatei: ENV_DATEI,
    envVorhanden: fs.existsSync(ENV_DATEI),
  };
}

/** Fuer die Oberflaeche: ist der Anbieter einsatzbereit? */
export function anbieterBereit() {
  return {
    openrouter: Boolean(schluessel('OPENROUTER_API_KEY')),
  };
}
