// Live-Preise von OpenRouter.
//
// Die Preise stehen in der Modell-Liste und aendern sich, wenn OpenRouter
// nachjustiert. Deshalb werden sie geholt statt eingetippt.
//
// FALLE: `pricing.image` ist der Preis fuer ein EINGABE-Bild, nicht fuer ein
// erzeugtes. Wer den nimmt, bekommt bei gemini-3-pro-image 0,000002 $ heraus -
// offensichtlich falsch. Der richtige Wert ist `image_output`, der Preis je
// AUSGABE-Token. Ein Bild in 1024er Groesse sind rund 1.290 Ausgabe-Token.
//
// Video liefert OpenRouter gar keinen Preis - dort bleibt nur messen.

import fs from 'node:fs';
import { datenPfad } from './konfig.mjs';

const QUELLEN = {
  bild: 'https://openrouter.ai/api/v1/models?output_modalities=image',
  video: 'https://openrouter.ai/api/v1/models?output_modalities=video',
};

/** Ausgabe-Token eines Bildes in 1024er Groesse. Nur ein Richtwert. */
export const TOKEN_PRO_BILD = 1290;

/** Wie lange ein geholter Preis als frisch gilt. */
const FRISCH_MS = 30 * 60 * 1000;

/**
 * Knappe Frist, gleicher Grund wie beim Guthaben: "verbunden, aber ohne
 * Internet" laesst fetch sonst in die Zeitueberschreitung des Systems
 * laufen, und /api/start haengt daran.
 */
const FRIST_MS = 4000;

/** Wo der letzte bekannte Stand liegt. */
const DATEI = datenPfad('preise.json');

const speicher = { bild: null, video: null };

/**
 * Den letzten Stand von der Platte holen.
 *
 * Ohne das war der Zwischenspeicher rein fluechtig: jeder Neustart leerte
 * ihn, und ein Start ohne Netz hatte gar keine Preise mehr - obwohl sie
 * gestern bekannt waren. Die gemessenen Preise ueberleben ohnehin in
 * verbrauch.json; hier geht es um die Schaetzung fuer Modelle, die noch
 * nie gelaufen sind.
 */
function vonPlatte() {
  try {
    const roh = JSON.parse(fs.readFileSync(DATEI, 'utf8'));
    for (const art of ['bild', 'video']) {
      if (roh[art]?.karte) speicher[art] = { karte: roh[art].karte, zeit: roh[art].zeit || 0 };
    }
  } catch {
    // Fehlt oder ist kaputt: dann eben ohne. Ein unlesbarer Preisspeicher
    // darf den Start nicht aufhalten.
  }
}
vonPlatte();

function aufPlatte() {
  try {
    fs.writeFileSync(DATEI, `${JSON.stringify(speicher, null, 2)}\n`, 'utf8');
  } catch {
    // Stumm. Der Preis gilt fuer diesen Lauf trotzdem.
  }
}

async function hole(art) {
  const antwort = await fetch(QUELLEN[art], {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(FRIST_MS),
  });
  if (!antwort.ok) throw new Error(`OpenRouter antwortete mit ${antwort.status}`);
  const roh = (await antwort.json()).data || [];

  const karte = {};
  for (const m of roh) {
    const proToken = Number(m.pricing?.image_output || 0);
    karte[m.id] = {
      proAusgabeToken: proToken || null,
      // Schaetzung, ausdruecklich als solche gekennzeichnet.
      schaetzungProBild: proToken ? proToken * TOKEN_PRO_BILD : null,
    };
  }
  return karte;
}

/**
 * Preise fuer eine Gattung. Liefert aus dem Zwischenspeicher, solange er
 * frisch ist. Faellt die Abfrage aus, kommt der letzte bekannte Stand
 * zurueck statt eines Fehlers - die App soll deshalb nicht stehenbleiben.
 */
export async function fuer(art) {
  const jetzt = Date.now();
  const alt = speicher[art];
  if (alt && jetzt - alt.zeit < FRISCH_MS) return alt.karte;

  try {
    const karte = await hole(art);
    speicher[art] = { karte, zeit: jetzt };
    aufPlatte();
    return karte;
  } catch {
    return alt?.karte || {};
  }
}

/**
 * Wie alt der Stand ist, den `fuer()` gerade liefert.
 *
 * Damit die Oberflaeche sagen kann, dass eine Zahl von gestern ist, statt
 * sie als aktuell auszugeben. `frisch: false` heisst: der letzte Versuch
 * ist ausgefallen, das hier ist der letzte bekannte Stand.
 */
export function stand() {
  const jetzt = Date.now();
  const ergebnis = {};
  for (const art of ['bild', 'video']) {
    const a = speicher[art];
    ergebnis[art] = a
      ? { zeit: a.zeit, frisch: jetzt - a.zeit < FRISCH_MS, modelle: Object.keys(a.karte).length }
      : { zeit: null, frisch: false, modelle: 0 };
  }
  return ergebnis;
}

/** Erzwingt ein Neuladen, egal wie frisch der Stand ist. */
export async function aktualisiere(art) {
  speicher[art] = null;
  return fuer(art);
}
