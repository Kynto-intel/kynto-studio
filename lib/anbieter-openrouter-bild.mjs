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

/**
 * Welches Seitenverhaeltnis ein Modell statt des gewuenschten nimmt.
 *
 * Der Grund: Jedes Modell laesst andere Verhaeltnisse zu, und OpenRouter
 * sagt vorher nicht welche - nachgesehen am 05.09.2026, kein einziges der
 * 52 Bildmodelle nennt sie in der Modell-Liste. Nur die Ablehnung nennt
 * sie. Also wird sie gelesen.
 *
 * Aufgefallen an gpt-image-2 und dem Format "Feed": 4:5 lehnt OpenAI ab,
 * erlaubt sind dort nur 1:1, 3:2, 2:3, 4:3, 3:4, 16:9, 9:16, 21:9. Ein
 * Fehler statt eines Bildes waere die schlechteste Antwort - das naechste
 * Verhaeltnis nehmen und mittig auf das Zielmass beschneiden ist genau das,
 * was resize.ps1 ohnehin tut.
 */
const ersatzVerhaeltnis = new Map();

/** Liest die erlaubten Werte aus der Ablehnung. Leer, wenn keine dastehen. */
function erlaubteAus(meldung) {
  const treffer = /accepted:\s*([^.]+)/i.exec(String(meldung || ''));
  if (!treffer) return [];
  return treffer[1]
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d+:\d+$/.test(s));
}

/** Das naechstgelegene der erlaubten Verhaeltnisse. */
function naechstes(gewuenscht, erlaubte) {
  const wert = (v) => {
    const [b, h] = v.split(':').map(Number);
    return b / h;
  };
  const ziel = wert(gewuenscht);
  return erlaubte
    .slice()
    .sort((a, b) => Math.abs(wert(a) - ziel) - Math.abs(wert(b) - ziel))[0] || null;
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

  const gewuenscht = seitenverhaeltnis(breite, hoehe);

  async function versuch(verhaeltnis) {
    const koerper = {
      model: modell,
      prompt,
      aspect_ratio: verhaeltnis,
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

    return { ok: antwort.ok, status: antwort.status, text: await antwort.text() };
  }

  // Weiss man vom letzten Mal schon, dass dieses Modell das gewuenschte
  // Verhaeltnis nicht nimmt, gar nicht erst danach fragen.
  let verhaeltnis = ersatzVerhaeltnis.get(`${modell}|${gewuenscht}`) || gewuenscht;
  let lauf = await versuch(verhaeltnis);

  // Abgelehnt, aber die Ablehnung nennt die erlaubten Werte? Dann das
  // naechstgelegene nehmen. Ein 400 kostet nichts, der zweite Anlauf ist
  // der einzige, der abgerechnet wird.
  if (!lauf.ok && lauf.status === 400) {
    const erlaubte = erlaubteAus(lauf.text);
    const ersatz = erlaubte.length ? naechstes(verhaeltnis, erlaubte) : null;
    if (ersatz && ersatz !== verhaeltnis) {
      ersatzVerhaeltnis.set(`${modell}|${gewuenscht}`, ersatz);
      verhaeltnis = ersatz;
      lauf = await versuch(verhaeltnis);
    }
  }

  if (!lauf.ok) {
    throw new Error(deuteFehler(lauf.status, lauf.text, modell));
  }

  let daten;
  try {
    daten = JSON.parse(lauf.text);
  } catch {
    throw new Error(`OpenRouter lieferte kein JSON: ${kurz(lauf.text)}`);
  }

  const erstes = daten?.data?.[0];
  if (!erstes?.b64_json) {
    throw new Error(`OpenRouter lieferte kein Bild: ${kurz(lauf.text)}`);
  }

  return {
    bytes: Buffer.from(erstes.b64_json, 'base64'),
    typ: erstes.media_type || 'image/png',
    kosten: daten?.usage?.cost ?? null,
    // Was wirklich gerendert wurde. Weicht es ab, steht es im Sidecar -
    // sonst wundert man sich spaeter ueber den Beschnitt.
    verhaeltnis,
    verhaeltnisGewuenscht: gewuenscht,
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
