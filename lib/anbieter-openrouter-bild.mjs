// ANBIETER: OpenRouter - BILDER.
// Video liegt bewusst in einer eigenen Datei: anbieter-openrouter-video.mjs
//
// Kennt keine Dateisystem-Pfade. Bekommt Prompt und optional ein
// Referenzbild als Bytes, liefert Bild-Bytes zurueck.

import { schluessel } from './konfig.mjs';

export const KANN_REFERENZ = true;

const ENDPUNKT = 'https://openrouter.ai/api/v1/images';
const KOPF_TITEL = 'Kynto Studio';

/** Seitenverhaeltnis aus Breite und Hoehe, in der Form die OpenRouter erwartet. */
function seitenverhaeltnis(breite, hoehe) {
  const teiler = (a, b) => (b ? teiler(b, a % b) : a);
  const t = teiler(breite, hoehe);
  return `${breite / t}:${hoehe / t}`;
}

/** Bytes zu einer Data-URI, wie sie input_references erwartet. */
export function alsDataUri(bytes, typ = 'image/png') {
  return `data:${typ};base64,${Buffer.from(bytes).toString('base64')}`;
}

/**
 * Erzeugt ein Bild.
 *
 * referenzBild ist optional. Ist es leer, geht nur der Text raus.
 * Ist es gesetzt, haengt es als input_references am selben Aufruf.
 * Es gibt bewusst KEINEN zweiten Code-Pfad und keinen Schalter:
 * Feld leer heisst ohne, Bild drin heisst mit.
 *
 * @param {object} arg
 * @param {string} arg.prompt
 * @param {string} arg.modell        OpenRouter-Modell-ID
 * @param {number} arg.breite
 * @param {number} arg.hoehe
 * @param {Buffer|null} arg.referenzBild
 * @param {string} arg.referenzTyp   MIME-Typ des Referenzbildes
 * @returns {Promise<{bytes: Buffer, typ: string, kosten: number|null}>}
 */
export async function erzeugeBild({
  prompt, modell, breite, hoehe, referenzBild = null, referenzTyp = 'image/png',
}) {
  const key = schluessel('OPENROUTER_API_KEY');
  if (!key) throw new Error('OPENROUTER_API_KEY ist nicht gesetzt.');

  const koerper = {
    model: modell,
    prompt,
    aspect_ratio: seitenverhaeltnis(breite, hoehe),
    n: 1,
    output_format: 'png',
  };

  if (referenzBild) {
    koerper.input_references = [{
      type: 'image_url',
      image_url: { url: alsDataUri(referenzBild, referenzTyp) },
    }];
  }

  const antwort = await fetch(ENDPUNKT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'X-Title': KOPF_TITEL,
    },
    body: JSON.stringify(koerper),
  });

  const text = await antwort.text();

  if (!antwort.ok) {
    throw new Error(deuteFehler(antwort.status, text, modell));
  }

  let daten;
  try {
    daten = JSON.parse(text);
  } catch {
    throw new Error(`OpenRouter lieferte kein JSON: ${kurz(text)}`);
  }

  const erstes = daten?.data?.[0];
  if (!erstes?.b64_json) {
    throw new Error(`OpenRouter lieferte kein Bild: ${kurz(text)}`);
  }

  return {
    bytes: Buffer.from(erstes.b64_json, 'base64'),
    typ: erstes.media_type || 'image/png',
    kosten: daten?.usage?.cost ?? null,
  };
}

/** Aus dem Rohfehler eine Meldung machen, mit der man etwas anfangen kann. */
function deuteFehler(status, text, modell) {
  let meldung = kurz(text);
  try {
    const j = JSON.parse(text);
    meldung = j?.error?.message || meldung;
  } catch {
    // Rohtext behalten
  }

  if (status === 402) {
    return `Guthaben aufgebraucht. Unter https://openrouter.ai/settings/credits aufladen. (${meldung})`;
  }
  if (status === 401) {
    return `OpenRouter-Schluessel wird abgelehnt. Neu setzen und start.ps1 neu starten. (${meldung})`;
  }
  if (status === 404) {
    return `Modell "${modell}" gibt es bei OpenRouter nicht mehr. Katalog aktualisieren. (${meldung})`;
  }
  if (status === 429) {
    return `OpenRouter drosselt gerade. Kurz warten. (${meldung})`;
  }
  return `OpenRouter HTTP ${status}: ${meldung}`;
}

function kurz(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > 300 ? `${t.slice(0, 300)}...` : t;
}

/** Kontostand, fuer die Anzeige in der Seitenleiste. */
export async function guthaben() {
  const key = schluessel('OPENROUTER_API_KEY');
  if (!key) return null;
  try {
    const antwort = await fetch('https://openrouter.ai/api/v1/credits', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!antwort.ok) return null;
    const d = (await antwort.json())?.data;
    if (!d) return null;
    return {
      geladen: d.total_credits,
      verbraucht: d.total_usage,
      uebrig: Number((d.total_credits - d.total_usage).toFixed(4)),
    };
  } catch {
    return null;
  }
}
