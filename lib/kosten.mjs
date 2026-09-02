// Kostenverfolgung.
//
// Abgerechnet wird in Dollar, und zwar mit dem Wert, den OpenRouter nach
// jedem Lauf selbst zurueckmeldet. Es wird nichts geschaetzt und nichts
// hochgerechnet - was hier steht, ist bezahlt worden.
//
// Zusaetzlich wird je Modell der Durchschnittspreis mitgeschrieben. Damit
// kann die Oberflaeche vor dem naechsten Lauf einen belastbaren Preis
// anzeigen, statt aus einer Preistabelle zu raten.

import fs from 'node:fs';
import { datenPfad } from './konfig.mjs';

const ZAEHLER_DATEI = datenPfad('verbrauch.json');

/**
 * Der heutige Tag - nach der Uhr des Rechners, nicht nach UTC.
 *
 * toISOString() liefert UTC. In Mitteleuropa heisst das: zwischen
 * Mitternacht und 02:00 zaehlt die App noch auf den Vortag, und wer nachts
 * arbeitet sieht unter "Heute" den Verbrauch von gestern. Gemessen am
 * 03.09.2026 um 00:40.
 */
function heute() {
  const d = new Date();
  const zweistellig = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${zweistellig(d.getMonth() + 1)}-${zweistellig(d.getDate())}`;
}

function lade() {
  try {
    if (fs.existsSync(ZAEHLER_DATEI)) {
      return JSON.parse(fs.readFileSync(ZAEHLER_DATEI, 'utf8'));
    }
  } catch {
    // kaputt -> frisch anfangen
  }
  return {};
}

/** Was wurde heute ueber dieses Werkzeug verbraucht? */
export function stand() {
  const daten = lade();
  const tag = heute();
  const eintrag = { bilder: 0, clips: 0, dollar: 0, chatDollar: 0, ...(daten[tag] || {}) };

  // Summe ueber alles, damit man den Gesamtverbrauch im Blick hat
  let gesamt = 0;
  let gesamtChat = 0;
  for (const [schluessel, wert] of Object.entries(daten)) {
    if (schluessel.startsWith('__')) continue;
    gesamt += Number(wert.dollar) || 0;
    gesamtChat += Number(wert.chatDollar) || 0;
  }

  return {
    tag,
    ...eintrag,
    dollar: Number(eintrag.dollar.toFixed(4)),
    chatDollar: Number((eintrag.chatDollar || 0).toFixed(4)),
    gesamtDollar: Number(gesamt.toFixed(4)),
    gesamtChatDollar: Number(gesamtChat.toFixed(4)),
  };
}

/**
 * Gemessene Durchschnittspreise je Modell, aus echten Laeufen.
 * Zuverlaessiger als jede Schaetzung.
 */
export function gemessen() {
  return lade().__modelle || {};
}

/**
 * Bucht einen Lauf auf den heutigen Tag.
 *
 * `chat` trennt die Gespraechskosten heraus. Sie zaehlen in dieselbe
 * Tagessumme - es ist dasselbe Guthaben - aber man will sehen koennen,
 * welcher Teil aufs Reden und welcher aufs Rendern ging. Ein Bild kostet
 * so viel wie hundert Gespraechszuege; ohne die Trennung sieht ein Tag mit
 * viel Chat aus wie ein Tag mit einem halben Bild.
 */
export function buche({ bilder = 0, clips = 0, dollar = 0, modell = null, chat = false }) {
  const daten = lade();
  const tag = heute();

  if (modell && dollar > 0) {
    daten.__modelle = daten.__modelle || {};
    const m = daten.__modelle[modell] || { summe: 0, laeufe: 0 };
    m.summe += dollar;
    m.laeufe += Math.max(1, bilder + clips || 1);
    m.schnitt = Number((m.summe / m.laeufe).toFixed(6));
    daten.__modelle[modell] = m;
  }

  const e = { bilder: 0, clips: 0, dollar: 0, chatDollar: 0, ...(daten[tag] || {}) };
  e.bilder += bilder;
  e.clips += clips;
  e.dollar += dollar;
  if (chat) e.chatDollar = (e.chatDollar || 0) + dollar;
  daten[tag] = e;

  // Nur die letzten 180 Tage behalten, Modell-Messwerte bleiben dauerhaft.
  const tage = Object.keys(daten).filter((k) => !k.startsWith('__')).sort().slice(-180);
  const knapp = {};
  for (const t of tage) knapp[t] = daten[t];
  if (daten.__modelle) knapp.__modelle = daten.__modelle;

  fs.writeFileSync(ZAEHLER_DATEI, JSON.stringify(knapp, null, 2), 'utf8');
  return stand();
}
