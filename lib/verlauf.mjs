// Live-Verlauf: was passiert gerade, und wer hat es ausgeloest.
//
// Jede Aktion landet hier - egal ob sie im Browser angeklickt oder
// Claude sie ueber die Kommandozeile ausloest. Die Oberflaeche haengt per
// Server-Sent Events dran und sieht es sofort, ohne zu pollen.

import fs from 'node:fs';
import { datenPfad } from './konfig.mjs';

const DATEI = datenPfad('verlauf.json');
const HOECHSTZAHL = 200;

/** Offene Browser-Verbindungen. */
const hoerer = new Set();

let eintraege = lade();

function lade() {
  try {
    if (fs.existsSync(DATEI)) return JSON.parse(fs.readFileSync(DATEI, 'utf8'));
  } catch {
    // kaputt -> frisch anfangen
  }
  return [];
}

function sichere() {
  try {
    fs.writeFileSync(DATEI, JSON.stringify(eintraege.slice(-HOECHSTZAHL), null, 2), 'utf8');
  } catch {
    // Wenn der Verlauf nicht schreibbar ist, soll die App trotzdem laufen
  }
}

/**
 * Haelt einen Vorgang fest.
 *
 * @param {object} e
 * @param {string} e.was      z. B. 'erzeugt', 'umbenannt', 'animiert'
 * @param {string} e.quelle   'studio' (Browser) oder 'claude' (Kommandozeile)
 * @param {string} e.text     eine Zeile Klartext fuer die Anzeige
 * @param {object} [e.details] alles Weitere: Prompt, Modell, Dateien, Kosten
 */
export function halteFest({ was, quelle = 'studio', text, details = {} }) {
  const eintrag = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    zeit: new Date().toISOString(),
    was,
    quelle,
    text,
    details,
  };
  eintraege.push(eintrag);
  if (eintraege.length > HOECHSTZAHL) eintraege = eintraege.slice(-HOECHSTZAHL);
  sichere();
  sende(eintrag);
  return eintrag;
}

function sende(eintrag) {
  const paket = `data: ${JSON.stringify(eintrag)}\n\n`;
  for (const antwort of hoerer) {
    try {
      antwort.write(paket);
    } catch {
      hoerer.delete(antwort);
    }
  }
}

/** Die letzten Eintraege, neueste zuerst. */
export function letzte(anzahl = 40) {
  return eintraege.slice(-anzahl).reverse();
}

/** Haengt einen Browser als Zuhoerer an den Strom. */
export function melde(req, res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    connection: 'keep-alive',
  });
  res.write(': verbunden\n\n');
  hoerer.add(res);

  // Alle 25 Sekunden ein Lebenszeichen, sonst schliessen Zwischenstellen
  // die Verbindung stillschweigend.
  const puls = setInterval(() => {
    try {
      res.write(': puls\n\n');
    } catch {
      clearInterval(puls);
      hoerer.delete(res);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(puls);
    hoerer.delete(res);
  });
}

/** Wie viele Browser hoeren gerade zu? */
export function zuhoerer() {
  return hoerer.size;
}
