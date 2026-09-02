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
    const text = daten.error?.message || `HTTP ${antwort.status}`;
    // 402 heisst Guthaben leer, nicht kaputter Schluessel - das immer wieder
    // zu verwechseln hat hier schon Zeit gekostet.
    if (antwort.status === 402) throw new Error(`OpenRouter-Guthaben aufgebraucht: ${text}`);
    if (antwort.status === 401) throw new Error(`OpenRouter-Schluessel abgelehnt: ${text}`);

    // "Provider returned error" heisst fast immer: das Modell kommt mit den
    // Werkzeugen oder dem laengeren Verlauf nicht zurecht. Gemessen bei
    // guenstigen Modellen, die "tools" zwar als Faehigkeit melden, aber bei
    // sieben Werkzeugen aussteigen. Das ist nichts, was der Nutzer an sich
    // selbst suchen sollte - deshalb steht die Erklaerung in der Meldung.
    if (werkzeuge.length && /provider returned error/i.test(text)) {
      throw new Error(`Das Modell "${modell}" kommt mit den Werkzeugen nicht zurecht `
        + '- oben ein anderes waehlen. Kleine Modelle scheitern hier oft.');
    }
    throw new Error(`OpenRouter: ${text}`);
  }

  const wahl = daten.choices?.[0];
  if (!wahl?.message) throw new Error('OpenRouter lieferte keine Nachricht zurueck.');

  return {
    nachricht: wahl.message,
    kosten: typeof daten.usage?.cost === 'number' ? daten.usage.cost : null,
    modell: daten.model || modell,
  };
}
