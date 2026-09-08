// Bildformatierung. Kapselt den Aufruf von resize.ps1, damit sonst niemand
// wissen muss, dass hier PowerShell im Spiel ist.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { APP, FORMATE, KLEIN_FAKTOR } from './konfig.mjs';

const execFileAsync = promisify(execFile);
const SKRIPT = path.join(APP, 'skripte', 'resize.ps1');

/** Auf ein Vielfaches von 8 runden - Bildmodelle mögen krumme Masse nicht. */
function auf8(wert) {
  return Math.max(256, Math.round(wert / 8) * 8);
}

/** Seitenverhaeltnis gekuerzt, in der Form die OpenRouter erwartet: "4:5". */
export function verhaeltnis(breite, hoehe) {
  const teiler = (a, b) => (b ? teiler(b, a % b) : a);
  const t = teiler(breite, hoehe) || 1;
  return `${breite / t}:${hoehe / t}`;
}

/**
 * Was der Beschnitt wegnimmt, BEVOR gerendert wird.
 *
 * Die eingerichteten Formate schneiden von sich aus nichts weg - bei allen
 * fuenf ist das Erzeugungsverhaeltnis gleich dem Zielverhaeltnis. Beschnitt
 * entsteht erst, wenn ein Modell das gewuenschte Verhaeltnis ABLEHNT und
 * anbieter-openrouter-bild.mjs das naechstgelegene erlaubte nimmt. Was ein
 * Modell so ersetzt, steht in daten/gelernt.json.
 *
 * resize.ps1 schneidet mittig: ist das Gerenderte hoeher als das Ziel, faellt
 * oben und unten gleich viel weg, ist es breiter, links und rechts. Deshalb
 * gibt es hier je Seite denselben Wert - und deshalb ist der Rat immer
 * derselbe: Wichtiges gehoert in die Mitte.
 *
 * @param {string} formatId
 * @param {string|null} gerendert  z. B. "3:4", oder null wenn nichts bekannt
 * @returns {null|{gewuenscht, gerendert, achse, jeSeite, gesamt}}
 */
export function beschnitt(formatId, gerendert = null) {
  const f = FORMATE[formatId];
  if (!f || !gerendert) return null;

  // Ohne Zielmass wird gar nicht beschnitten - "roh" laesst alles stehen.
  const zielB = f.zielW || f.genW;
  const zielH = f.zielH || f.genH;
  if (!f.zielW) return null;

  const gewuenscht = verhaeltnis(f.genW, f.genH);
  if (gerendert === gewuenscht) return null;

  const [gb, gh] = gerendert.split(':').map(Number);
  if (!gb || !gh) return null;

  const quelle = gb / gh;
  const ziel = zielB / zielH;
  if (Math.abs(quelle - ziel) < 0.0005) return null;

  // Dieselbe Rechnung wie in resize.ps1, nur mit Verhaeltnissen statt Pixeln.
  const anteil = quelle > ziel
    ? 1 - (ziel / quelle)      // zu breit -> links und rechts
    : 1 - (quelle / ziel);     // zu hoch  -> oben und unten

  return {
    gewuenscht,
    gerendert,
    achse: quelle > ziel ? 'seitlich' : 'oben und unten',
    jeSeite: Number((anteil * 50).toFixed(1)),
    gesamt: Number((anteil * 100).toFixed(1)),
  };
}

/** Liefert die Render- und Zielmasse fuer ein Format. */
export function masse(formatId, klein = false) {
  const f = FORMATE[formatId];
  if (!f) throw new Error(`Unbekanntes Format: ${formatId}`);
  return {
    ...f,
    genW: klein ? auf8(f.genW * KLEIN_FAKTOR) : f.genW,
    genH: klein ? auf8(f.genH * KLEIN_FAKTOR) : f.genH,
  };
}

/**
 * Eine kleine Fassung eines Bildes, als Bytes im Speicher.
 *
 * Fuer Bilder, die ein Sprachmodell ansehen soll. Zwei Gruende fuers
 * Verkleinern: ein Bild in voller Groesse waere als Base64 mehrere Megabyte
 * gross und wird nach Zeichen bezahlt - und mehr als etwa 800 Pixel Kante
 * wertet ohnehin kein Modell aus.
 *
 * Bewusst OHNE Beschnitt: gerade am Rand sitzen die Fehler, die man
 * beurteilen will.
 */
export async function kleineFassung(quellDatei, maxKante = 768) {
  const temp = path.join(os.tmpdir(), `kynto-ansicht-${randomUUID()}.png`);
  try {
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', SKRIPT,
        '-Quelle', quellDatei, '-Ziel', temp,
        '-MaxKante', String(maxKante)],
      { windowsHide: true, maxBuffer: 1024 * 1024 },
    );
    return fs.readFileSync(temp);
  } finally {
    fs.existsSync(temp) && fs.unlinkSync(temp);
  }
}

/**
 * Schreibt rohe Bildbytes als fertig formatierte PNG-Datei.
 * Beim Format "roh" wird nichts umgerechnet, die Bytes landen direkt.
 */
export async function schreibeFormatiert({ bytes, zielDatei, zielW, zielH }) {
  if (!zielW || !zielH) {
    fs.writeFileSync(zielDatei, bytes);
    return { breite: null, hoehe: null };
  }

  const temp = path.join(os.tmpdir(), `kynto-${randomUUID()}.img`);
  fs.writeFileSync(temp, bytes);
  try {
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', SKRIPT,
        '-Quelle', temp, '-Ziel', zielDatei,
        '-Breite', String(zielW), '-Hoehe', String(zielH)],
      { windowsHide: true, maxBuffer: 1024 * 1024 },
    );
    return { breite: zielW, hoehe: zielH };
  } finally {
    fs.existsSync(temp) && fs.unlinkSync(temp);
  }
}
