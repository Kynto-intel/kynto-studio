// ANBIETER: OpenRouter - GESPRAECH mit Werkzeug-Aufrufen.
//
// Kennt weder Dateisystem noch Werkzeuge. Bekommt Nachrichten und ein
// Werkzeug-Schema, liefert die Antwort des Modells zurueck - entweder Text
// oder die Bitte, Werkzeuge aufzurufen. Was dann passiert, entscheidet
// server.mjs, nicht dieses Modul.
//
// Bewusst ohne Datenstrom: die Schleife braucht ohnehin die vollstaendige
// Antwort, bevor sie ein Werkzeug ausfuehren kann. Ein halb angekommener
// Werkzeug-Aufruf ist wertlos. Die Oberflaeche bekommt den Fortschritt
// stattdessen ueber Server-Sent-Events, ein Ereignis je Schritt.

import { schluessel } from './konfig.mjs';

const ENDPUNKT = 'https://openrouter.ai/api/v1/chat/completions';
const KOPF_TITEL = 'Kynto Studio';

/** Wie viele Runden Werkzeug-Aufruf und Antwort hoechstens laufen duerfen. */
export const MAX_RUNDEN = 8;

/**
 * Eine Runde Gespraech.
 *
 * @param {object} arg
 * @param {Array}  arg.nachrichten  vollstaendiger Verlauf im OpenAI-Format
 * @param {string} arg.modell       Textmodell-ID
 * @param {Array}  arg.werkzeuge    Werkzeug-Schema, darf leer sein
 * @returns {Promise<{nachricht: object, kosten: number|null, modell: string}>}
 */
export async function frage({ nachrichten, modell, werkzeuge = [] }) {
  const key = schluessel('OPENROUTER_API_KEY');
  if (!key) throw new Error('OPENROUTER_API_KEY ist nicht gesetzt.');

  const koerper = {
    model: modell,
    messages: nachrichten,
    // usage.include liefert die tatsaechlichen Kosten zurueck, statt sie
    // aus Tokenpreisen hochrechnen zu muessen.
    usage: { include: true },
  };
  if (werkzeuge.length) {
    koerper.tools = werkzeuge;
    koerper.tool_choice = 'auto';
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

  const roh = await antwort.text();
  let daten;
  try {
    daten = JSON.parse(roh);
  } catch {
    throw new Error(`OpenRouter antwortete kein JSON (HTTP ${antwort.status}): ${roh.slice(0, 200)}`);
  }

  if (!antwort.ok || daten.error) {
    // `message` ist bei durchgereichten Anbieterfehlern nur "Provider
    // returned error" - nichtssagend. Der brauchbare Text steht in
    // metadata.raw, dort steht auch, ob es eine Drosselung ist.
    const roher = daten.error?.metadata?.raw;
    const text = daten.error?.message || `HTTP ${antwort.status}`;
    const genau = typeof roher === 'string' && roher.trim() ? roher : text;

    // 402 heisst Guthaben leer, nicht kaputter Schluessel - das immer wieder
    // zu verwechseln hat hier schon Zeit gekostet.
    if (antwort.status === 402) throw new Error(`OpenRouter-Guthaben aufgebraucht: ${text}`);
    if (antwort.status === 401) throw new Error(`OpenRouter-Schluessel abgelehnt: ${text}`);

    // Drosselung ZUERST pruefen, und zwar am Statuscode.
    //
    // Vorher stand die Werkzeug-Erklaerung weiter oben und fing jeden
    // "Provider returned error" ab - auch die 429. Dann stand da, das
    // Modell komme mit den Werkzeugen nicht zurecht, obwohl es schlicht
    // gedrosselt war. Gemessen an glm-5.2:free am 05.09.2026: HTTP 429,
    // "temporarily rate-limited upstream". Eine falsche Erklaerung ist
    // schlimmer als gar keine - man sucht an der falschen Stelle.
    if (antwort.status === 429) {
      const sekunden = Number(daten.error?.metadata?.retry_after_seconds) || 0;
      const gleich = sekunden ? ` In etwa ${sekunden} Sekunden wieder.` : '';
      const gratis = modell.endsWith(':free')
        ? ' Bei Gratis-Modellen teilen sich alle Nutzer ein Kontingent, das '
          + 'passiert dort staendig - ein bezahltes ist hier zuverlaessiger.'
        : '';
      throw new Error(`"${modell}" ist gerade gedrosselt, nicht kaputt.${gleich}${gratis}`);
    }

    // Erst wenn es keine Drosselung ist, ist die Werkzeug-Erklaerung die
    // wahrscheinliche: guenstige Modelle melden "tools" als Faehigkeit und
    // steigen bei sieben Werkzeugen trotzdem aus.
    if (werkzeuge.length && /provider returned error/i.test(text)) {
      throw new Error(`Das Modell "${modell}" kommt mit den Werkzeugen nicht zurecht `
        + `- oben ein anderes waehlen. Kleine Modelle scheitern hier oft. (${genau})`);
    }
    throw new Error(`OpenRouter: ${genau}`);
  }

  const wahl = daten.choices?.[0];
  if (!wahl?.message) throw new Error('OpenRouter lieferte keine Nachricht zurueck.');

  return {
    nachricht: wahl.message,
    kosten: typeof daten.usage?.cost === 'number' ? daten.usage.cost : null,
    modell: daten.model || modell,
  };
}
