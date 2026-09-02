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

/**
 * Holt die Textmodelle, die Werkzeug-Aufrufe beherrschen.
 *
 * Ohne diese Faehigkeit kann ein Modell im Chat nichts tun ausser reden -
 * deshalb kommen die anderen gar nicht erst in die Auswahl.
 */
export async function modelle() {
  const key = schluessel('OPENROUTER_API_KEY');
  if (!key) return [];

  const antwort = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!antwort.ok) throw new Error(`Modell-Liste nicht erreichbar: HTTP ${antwort.status}`);

  const { data = [] } = await antwort.json();
  return data
    .filter((m) => m.supported_parameters?.includes('tools'))
    .map((m) => {
      const rein = Number(m.pricing?.prompt) * 1e6;
      const raus = Number(m.pricing?.completion) * 1e6;
      return {
        id: m.id,
        name: m.name || m.id,
        gruppe: (m.id.split('/')[0] || 'andere'),
        anbieter: 'openrouter',
        // Preis je Million Zeichen, damit die Groessenordnung sichtbar wird.
        notiz: Number.isFinite(rein) && rein > 0
          ? `${rein.toFixed(2)} $ / ${raus.toFixed(2)} $ je 1M`
          : 'kostenlos',
        preisRein: Number.isFinite(rein) ? rein : null,
      };
    })
    .sort((a, b) => (a.preisRein ?? 1e9) - (b.preisRein ?? 1e9));
}
