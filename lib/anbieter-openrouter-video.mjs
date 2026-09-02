// ANBIETER: OpenRouter - VIDEO.
// Bewusst getrennt von anbieter-openrouter-bild.mjs: anderer Endpunkt,
// anderer Ablauf. Video laeuft asynchron - erst ein Auftrag, dann Nachfragen.
//
// UNGEPRUEFT: Dieser Weg konnte noch nicht gegen einen erfolgreichen Lauf
// getestet werden, weil das OpenRouter-Guthaben leer ist. Die Fehlerpfade
// sind geprueft, der Erfolgsfall nicht.

import { schluessel } from './konfig.mjs';

export const KANN_REFERENZ = true;

const ENDPUNKT = 'https://openrouter.ai/api/v1/videos';
const KOPF_TITEL = 'Kynto Studio';

/** Wie oft und wie lange nachgefragt wird, bis ein Clip fertig ist. */
const NACHFRAGE_MS = 5000;
const HOECHSTDAUER_MS = 10 * 60 * 1000;

function seitenverhaeltnis(breite, hoehe) {
  const teiler = (a, b) => (b ? teiler(b, a % b) : a);
  const t = teiler(breite, hoehe);
  return `${breite / t}:${hoehe / t}`;
}

function alsDataUri(bytes, typ = 'image/png') {
  return `data:${typ};base64,${Buffer.from(bytes).toString('base64')}`;
}

const warte = (ms) => new Promise((f) => { setTimeout(f, ms); });

/**
 * Erzeugt einen Clip.
 *
 * startBild ist optional. Ohne Bild ist es Text-zu-Video, mit Bild wird
 * daraus Bild-zu-Video - dasselbe Muster wie beim Bild-Anbieter, ein
 * Aufrufweg, kein Schalter.
 *
 * Achtung: OpenRouter dokumentiert die Referenz als erreichbare HTTP(S)-URL.
 * Hier wird eine Data-URI geschickt, weil lokale Dateien nicht oeffentlich
 * erreichbar sind. Lehnt ein Modell das ab, sagt die Fehlermeldung es.
 */
export async function erzeugeVideo({
  prompt, modell, breite, hoehe, dauer = 5, aufloesung = '1080p',
  startBild = null, startBildTyp = 'image/png', beiFortschritt = () => {},
}) {
  const key = schluessel('OPENROUTER_API_KEY');
  if (!key) throw new Error('OPENROUTER_API_KEY ist nicht gesetzt.');

  const kopf = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'X-Title': KOPF_TITEL,
  };

  const koerper = {
    model: modell,
    prompt,
    aspect_ratio: seitenverhaeltnis(breite, hoehe),
    resolution: aufloesung,
    duration: dauer,
  };

  if (startBild) {
    koerper.frame_images = [{
      type: 'image_url',
      frame_type: 'first_frame',
      image_url: { url: alsDataUri(startBild, startBildTyp) },
    }];
  }

  const auftrag = await fetch(ENDPUNKT, {
    method: 'POST', headers: kopf, body: JSON.stringify(koerper),
  });
  const auftragText = await auftrag.text();
  if (!auftrag.ok) throw new Error(deuteFehler(auftrag.status, auftragText, modell));

  let job;
  try {
    job = JSON.parse(auftragText);
  } catch {
    throw new Error(`OpenRouter lieferte kein JSON: ${kurz(auftragText)}`);
  }

  const nachfrageUrl = job.polling_url || `${ENDPUNKT}/${job.id}`;
  if (!job.id && !job.polling_url) {
    throw new Error(`Kein Auftrag zurueckbekommen: ${kurz(auftragText)}`);
  }

  // Nachfragen, bis fertig oder die Hoechstdauer erreicht ist.
  const start = Date.now();
  let stand = job;
  while (stand.status !== 'completed' && stand.status !== 'failed') {
    if (Date.now() - start > HOECHSTDAUER_MS) {
      throw new Error(`Clip war nach ${HOECHSTDAUER_MS / 60000} Minuten nicht fertig (Auftrag ${job.id}).`);
    }
    await warte(NACHFRAGE_MS);
    beiFortschritt({ status: stand.status, sekunden: Math.round((Date.now() - start) / 1000) });

    const nachfrage = await fetch(nachfrageUrl, { headers: kopf });
    const nachfrageText = await nachfrage.text();
    if (!nachfrage.ok) throw new Error(deuteFehler(nachfrage.status, nachfrageText, modell));
    try {
      stand = JSON.parse(nachfrageText);
    } catch {
      throw new Error(`Nachfrage lieferte kein JSON: ${kurz(nachfrageText)}`);
    }
  }

  if (stand.status === 'failed') {
    throw new Error(`Clip fehlgeschlagen: ${stand.error?.message || kurz(JSON.stringify(stand))}`);
  }

  const url = stand.unsigned_urls?.[0];
  if (!url) throw new Error(`Kein Clip in der Antwort: ${kurz(JSON.stringify(stand))}`);

  const datei = await fetch(url, { headers: kopf });
  if (!datei.ok) throw new Error(`Clip nicht abholbar: HTTP ${datei.status}`);

  return {
    bytes: Buffer.from(await datei.arrayBuffer()),
    typ: datei.headers.get('content-type') || 'video/mp4',
    kosten: stand.usage?.cost ?? null,
    dauer: Math.round((Date.now() - start) / 1000),
  };
}

function deuteFehler(status, text, modell) {
  let meldung = kurz(text);
  try {
    meldung = JSON.parse(text)?.error?.message || meldung;
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
  if (status === 429) return `OpenRouter drosselt gerade. Kurz warten. (${meldung})`;
  return `OpenRouter HTTP ${status}: ${meldung}`;
}

function kurz(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > 300 ? `${t.slice(0, 300)}...` : t;
}
