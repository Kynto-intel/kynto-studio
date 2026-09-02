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
