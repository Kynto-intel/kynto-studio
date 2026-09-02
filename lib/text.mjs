// Text auf Bild. Kapselt den Aufruf von text.ps1, wie format.mjs es fuer
// resize.ps1 tut - sonst muss niemand wissen, dass PowerShell im Spiel ist.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { APP } from './konfig.mjs';

const execFileAsync = promisify(execFile);
const SKRIPT = path.join(APP, 'skripte', 'text.ps1');

/** Fuellt fehlende Felder einer Ebene mit brauchbaren Vorgaben auf. */
export function normalisiere(ebene = {}) {
  return {
    text: String(ebene.text || ''),
    schrift: ebene.schrift || 'Bebas Neue',
    groesse: Number(ebene.groesse) || 0.085,
    farbe: ebene.farbe || '#F2F2F2',
    akzentFarbe: ebene.akzentFarbe || '#8B1A1A',
    x: ebene.x == null ? 0.5 : Number(ebene.x),
    y: ebene.y == null ? 0.76 : Number(ebene.y),
    ausrichtung: ebene.ausrichtung || 'mitte',
    zeilenabstand: Number(ebene.zeilenabstand) || 1.05,
    versalien: Boolean(ebene.versalien),
    kontur: {
      breite: Number(ebene.kontur?.breite) || 0,
      farbe: ebene.kontur?.farbe || '#000000',
    },
    schatten: {
      versatz: Number(ebene.schatten?.versatz) || 0,
      farbe: ebene.schatten?.farbe || '#000000',
    },
  };
}

/**
 * Rendert Textebenen auf ein Bild.
 *
 * maxHoehe > 0 rendert kleiner - fuer die Vorschau. Weil alle Masse relativ
 * zur Bildhoehe sind, sieht das Ergebnis identisch aus, nur in weniger Pixeln.
 *
 * @returns {Promise<Buffer>} die fertige PNG-Datei als Bytes
 */
export async function rendere({ quellDatei, ebenen, maxHoehe = 0 }) {
  const liste = (Array.isArray(ebenen) ? ebenen : [ebenen]).map(normalisiere);
  if (!liste.some((e) => e.text.trim())) {
    throw new Error('Kein Text angegeben.');
  }

  const kennung = randomUUID();
  const ebenenDatei = path.join(os.tmpdir(), `kynto-text-${kennung}.json`);
  const zielDatei = path.join(os.tmpdir(), `kynto-text-${kennung}.png`);

  fs.writeFileSync(ebenenDatei, JSON.stringify(liste), 'utf8');
  try {
    const argumente = [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', SKRIPT,
      '-Quelle', quellDatei,
      '-Ziel', zielDatei,
      '-EbenenDatei', ebenenDatei,
    ];
    if (maxHoehe > 0) argumente.push('-MaxHoehe', String(maxHoehe));

    await execFileAsync('powershell.exe', argumente, {
      windowsHide: true, maxBuffer: 2 * 1024 * 1024,
    });
    return fs.readFileSync(zielDatei);
  } finally {
    for (const d of [ebenenDatei, zielDatei]) {
      if (fs.existsSync(d)) fs.unlinkSync(d);
    }
  }
}

/**
 * Freien Dateinamen fuer die Textfassung finden.
 * bild.png -> bild_text.png -> bild_text2.png -> ...
 * Das Original wird nie ueberschrieben.
 */
export function freierName(quellDatei) {
  const ordner = path.dirname(quellDatei);
  const endung = path.extname(quellDatei);
  const basis = path.basename(quellDatei, endung);

  let versuch = path.join(ordner, `${basis}_text.png`);
  let nummer = 2;
  while (fs.existsSync(versuch)) {
    versuch = path.join(ordner, `${basis}_text${nummer}.png`);
    nummer += 1;
  }
  return versuch;
}
