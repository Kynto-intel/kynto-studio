// Loeschen, aber nicht endgueltig: die Datei geht in den Windows-Papierkorb.
//
// Bis 9.9.2026 gab es in der App gar keinen Loeschknopf. Aufgeraeumt wurde im
// Explorer - und danach fehlten Vorlagen ihre Bilder, weil niemand die App
// gefragt hatte, was an einer Datei noch haengt.
//
// Warum der Windows-Papierkorb und nicht ein eigener Ordner unter daten/:
// Der Papierkorb ist der Ort, an dem man ohnehin nachsieht, wenn etwas fehlt,
// und Wiederherstellen geht dort mit Rechtsklick. Ein zweiter Papierkorb, den
// nur diese App kennt, waere ein Versteck - und braeuchte eine Frist, ein
// Aufraeumen und eine eigene Ansicht, um nicht heimlich vollzulaufen.
//
// Das Sidecar geht mit. Ein Bild ohne seinen Prompt ist halb geloescht, und
// eine Sidecar-Datei ohne ihr Bild ist Muell, den niemand findet.
//
// Was hier NICHT passiert: Ordner loeschen. Nur einzelne Dateien, und nur
// innerhalb der Wurzel - die Pruefung dafuer macht der Aufrufer mit
// absolut().

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { APP } from './konfig.mjs';
import { pruefeInnerhalb } from './pfade.mjs';

const execFileAsync = promisify(execFile);
const SKRIPT = path.join(APP, 'skripte', 'papierkorb.ps1');

/** Eine Datei in den Papierkorb legen. Wirft, wenn es nicht geht. */
async function inDenPapierkorb(datei) {
  await execFileAsync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', SKRIPT, '-Pfad', datei,
  ], { windowsHide: true, maxBuffer: 1024 * 1024 });
}

/**
 * Bild oder Clip loeschen, mitsamt Sidecar.
 *
 * @param {string} vollerPfad  absoluter Pfad, schon durch absolut() gegangen
 * @returns {Promise<{datei: string, sidecar: boolean}>}
 */
export async function loesche(vollerPfad) {
  // Zweite Pruefung, obwohl der Aufrufer schon geprueft hat. Loeschen ist
  // die einzige Sache in dieser App, die nicht rueckgaengig zu machen ist,
  // wenn sie danebengeht - hier lohnt der Guertel zum Hosentraeger.
  const voll = pruefeInnerhalb(vollerPfad);

  if (!fs.existsSync(voll)) throw new Error('Die Datei gibt es nicht mehr.');
  if (!fs.statSync(voll).isFile()) throw new Error('Nur einzelne Dateien, keine Ordner.');

  await inDenPapierkorb(voll);

  // Erst das Bild, dann das Sidecar - in dieser Reihenfolge. Geht das Bild
  // schief, bleibt beides liegen und der Zustand ist noch heil.
  let sidecarWeg = false;
  const sidecar = `${voll}.json`;
  if (fs.existsSync(sidecar)) {
    try {
      await inDenPapierkorb(sidecar);
      sidecarWeg = true;
    } catch {
      // Das Bild ist weg, das Sidecar nicht - unschoen, aber harmlos:
      // eine verwaiste .json faellt nirgends auf und blockiert nichts.
    }
  }

  return { datei: path.basename(voll), sidecar: sidecarWeg };
}
