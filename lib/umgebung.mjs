// Schluessel aus einer .env-Datei neben der App laden.
//
// Warum ueberhaupt: Umgebungsvariablen sind unter Windows ueber
// [Environment]::SetEnvironmentVariable zu setzen, unter Linux und macOS
// ganz anders - und wer die App frisch klont, will nicht erst lernen, wie
// sein System das macht. Eine Datei versteht jeder.
//
// Die Datei bleibt optional. Wer seine Schluessel lieber im System stehen
// hat, aendert nichts und merkt von diesem Modul nichts.
//
// Bewusst kein dotenv-Paket: die App kommt ohne eine einzige Abhaengigkeit
// aus, und das Format ist ein Dutzend Zeilen.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = path.dirname(fileURLToPath(import.meta.url));

/** Erwarteter Ort der Datei: neben server.mjs, nicht im lib-Ordner. */
export const ENV_DATEI = path.resolve(hier, '..', '.env');

/** Welche Namen aus der Datei kamen - fuer die Anzeige "woher stammt der Schluessel". */
export const AUS_DATEI = new Set();

/**
 * Eine Zeile zerlegen. Unterstuetzt wird genau so viel, wie ein Mensch
 * beim Eintippen erwartet:
 *
 *   OPENROUTER_API_KEY=sk-or-v1-...
 *   export OPENROUTER_API_KEY="sk-or-v1-..."
 *   # Kommentar
 *
 * Ein `=` im Wert bleibt erhalten - getrennt wird nur am ersten.
 */
function zeileLesen(roh) {
  const zeile = roh.trim();
  if (!zeile || zeile.startsWith('#')) return null;

  const ohneExport = zeile.startsWith('export ') ? zeile.slice(7).trim() : zeile;
  const trenn = ohneExport.indexOf('=');
  if (trenn < 1) return null;

  const name = ohneExport.slice(0, trenn).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return null;

  let wert = ohneExport.slice(trenn + 1).trim();

  // Anfuehrungszeichen abstreifen, aber nur paarweise - sonst zerlegt man
  // Schluessel, die zufaellig mit einem Zeichen anfangen, das so aussieht.
  const erste = wert[0];
  if ((erste === '"' || erste === "'") && wert.endsWith(erste) && wert.length > 1) {
    wert = wert.slice(1, -1);
  }

  return [name, wert];
}

/**
 * Liest die Datei und setzt fehlende Werte in process.env.
 *
 * **Eine echte Umgebungsvariable gewinnt.** Das ist die Regel, die jeder
 * von dotenv kennt, und sie ist die richtige: wer beim Start bewusst etwas
 * mitgibt, will nicht von einer Datei ueberstimmt werden. Damit daraus kein
 * Raetsel wird, zeigen Studio und `status` an, woher der Schluessel kam.
 */
export function ladeEnvDatei() {
  if (!fs.existsSync(ENV_DATEI)) return;

  let inhalt;
  try {
    inhalt = fs.readFileSync(ENV_DATEI, 'utf8');
  } catch (fehler) {
    console.warn(`.env konnte nicht gelesen werden: ${fehler.message}`);
    return;
  }

  // Ein BOM wuerde sonst am ersten Namen kleben und ihn unbrauchbar machen.
  if (inhalt.charCodeAt(0) === 0xfeff) inhalt = inhalt.slice(1);

  for (const roh of inhalt.split(/\r?\n/)) {
    const paar = zeileLesen(roh);
    if (!paar) continue;
    const [name, wert] = paar;
    if (process.env[name]) continue;
    if (!wert) continue;
    process.env[name] = wert;
    AUS_DATEI.add(name);
  }
}
