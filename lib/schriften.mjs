// Schriftliste fuer den Text-Editor.
//
// Kuratiert nach dem, was zu dunklen, wuchtigen Bildern passt - nicht die
// Schriften, sondern die brauchbaren. Beim Start wird gegen das System
// geprueft: Was fehlt, faellt aus dem Menue, statt spaeter beim Rendern
// stillschweigend durch eine Ersatzschrift getauscht zu werden.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const VORSCHLAG = [
  { name: 'Bebas Neue', gruppe: 'Block', notiz: 'schmal, Versalien — der Standard für Sprüche' },
  { name: 'Impact', gruppe: 'Block', notiz: 'der Klassiker, sehr fett' },
  { name: 'Haettenschweiler', gruppe: 'Block', notiz: 'sehr schmal, viel Text auf wenig Platz' },
  { name: 'Franklin Gothic Heavy', gruppe: 'Block', notiz: 'breit und wuchtig' },
  { name: 'Bernard MT Condensed', gruppe: 'Block', notiz: 'schmal mit Serifen-Anklang' },
  { name: 'Montserrat Black', gruppe: 'Block', notiz: 'modern, geometrisch' },
  { name: 'Arial Black', gruppe: 'Block', notiz: 'neutral, immer verfügbar' },

  { name: 'Stencil', gruppe: 'Schablone', notiz: 'militärisch, rau' },
  { name: 'Glaser Stencil D', gruppe: 'Schablone', notiz: 'runder, weniger hart' },

  { name: 'Blackcraft', gruppe: 'Gotisch', notiz: 'dunkel, Metal-Anmutung' },
  { name: 'BlackFlag', gruppe: 'Gotisch', notiz: 'roh, handgezeichnet' },
  { name: 'Blacksword', gruppe: 'Gotisch', notiz: 'geschwungen, klingenhaft' },
  { name: 'Blackadder ITC', gruppe: 'Gotisch', notiz: 'altertümlich, verschnörkelt' },

  { name: 'Georgia', gruppe: 'Serif', notiz: 'ruhig, gut lesbar — für Statements' },
  { name: 'Constantia', gruppe: 'Serif', notiz: 'schlank, elegant' },
  { name: 'Book Antiqua', gruppe: 'Serif', notiz: 'klassisch, warm' },
  { name: 'Garamond', gruppe: 'Serif', notiz: 'zurückhaltend' },
];

let geprueft = null;

/** Fragt die installierten Schriften ab. Faellt bei Fehler auf alle zurueck. */
async function installierte() {
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command',
        'Add-Type -AssemblyName System.Drawing; '
        + '(New-Object System.Drawing.Text.InstalledFontCollection).Families.Name'],
      { windowsHide: true, maxBuffer: 1024 * 1024 },
    );
    return new Set(stdout.split(/\r?\n/).map((z) => z.trim()).filter(Boolean));
  } catch {
    return null;   // Pruefung nicht moeglich -> alles anbieten
  }
}

/** Verfuegbare Schriften, einmal ermittelt und dann gemerkt. */
export async function verfuegbar() {
  if (geprueft) return geprueft;
  const da = await installierte();
  geprueft = da ? VORSCHLAG.filter((s) => da.has(s.name)) : VORSCHLAG;
  return geprueft;
}

/** Startvorlagen fuer den Text-Editor, alle frei aenderbar. */
export const VORLAGEN = {
  spruch: {
    label: 'Spruch',
    schrift: 'Bebas Neue',
    groesse: 0.085,
    farbe: '#F2F2F2',
    akzentFarbe: '#8B1A1A',
    x: 0.5,
    y: 0.76,
    ausrichtung: 'mitte',
    zeilenabstand: 1.05,
    versalien: true,
    kontur: { breite: 0.003, farbe: '#000000' },
    schatten: { versatz: 0.004, farbe: '#000000' },
  },
  statement: {
    label: 'Statement',
    schrift: 'Georgia',
    groesse: 0.052,
    farbe: '#E8E8E8',
    akzentFarbe: '#C8873A',
    x: 0.5,
    y: 0.5,
    ausrichtung: 'mitte',
    zeilenabstand: 1.4,
    versalien: false,
    kontur: { breite: 0, farbe: '#000000' },
    schatten: { versatz: 0.005, farbe: '#000000' },
  },
  einWort: {
    label: 'Ein Wort',
    schrift: 'Impact',
    groesse: 0.16,
    farbe: '#F2F2F2',
    akzentFarbe: '#8B1A1A',
    x: 0.5,
    y: 0.5,
    ausrichtung: 'mitte',
    zeilenabstand: 1,
    versalien: true,
    kontur: { breite: 0.004, farbe: '#000000' },
    schatten: { versatz: 0.006, farbe: '#000000' },
  },
};
