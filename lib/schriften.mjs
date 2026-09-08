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

/**
 * Startvorlagen fuer den Text-Editor, alle frei aenderbar.
 *
 * Eine Vorlage ist EINE Textebene - mehr kann der Editor nicht. Deshalb
 * fehlen hier Sachen wie "Zitat mit Quelle" oder "Frage und Antwort": die
 * brauchen zwei Ebenen und damit einen anderen Editor, nicht eine weitere
 * Vorlage.
 *
 * Zwei Masse, die man beim Aendern kennen muss, weil sie NICHT dieselbe
 * Bezugsgroesse haben (siehe text.ps1):
 *   groesse       Anteil der Bild-HOEHE  -> Schriftgroesse in Pixeln
 *   kontur.breite Anteil der Bild-BREITE -> Konturstaerke in Pixeln
 *
 * Auf einem Feed-Bild 1080x1350 ergibt groesse 0.085 also 115 px Schrift,
 * und kontur 0.003 gibt 3,2 px - rund 3 % der Schriftgroesse. Aus der
 * Overlay-Praxis kommt die Faustzahl 8-14 % der Versalhoehe, das waeren
 * eher 6-10 % der Schriftgroesse. Die drei alten Vorlagen bleiben bewusst
 * leiser; die neuen mit "laut" im Zweck sind auf diese Faustzahl gesetzt.
 */
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

  // Laut: Kontur nach der Faustzahl, damit der Text auch auf unruhigem
  // Untergrund und klein in der Vorschau noch steht.
  schlagzeile: {
    label: 'Schlagzeile (laut)',
    schrift: 'Impact',
    groesse: 0.11,
    farbe: '#FFFFFF',
    akzentFarbe: '#8B1A1A',
    x: 0.5,
    y: 0.78,
    ausrichtung: 'mitte',
    zeilenabstand: 0.95,
    versalien: true,
    kontur: { breite: 0.009, farbe: '#000000' },
    schatten: { versatz: 0.007, farbe: '#000000' },
  },

  // Fuer Pins und alles, was klein im Raster gelesen wird: hoch gesetzt,
  // weil Pinterest unten gern eigene Elemente einblendet.
  pin: {
    label: 'Pin-Titel (laut)',
    schrift: 'Bebas Neue',
    groesse: 0.105,
    farbe: '#FFFFFF',
    akzentFarbe: '#C8873A',
    x: 0.5,
    y: 0.2,
    ausrichtung: 'mitte',
    zeilenabstand: 1,
    versalien: true,
    kontur: { breite: 0.008, farbe: '#000000' },
    schatten: { versatz: 0.006, farbe: '#000000' },
  },

  // Dasselbe wie Spruch, nur oben - wenn das Motiv die untere Haelfte
  // fuellt. Spart das Verschieben von Hand.
  spruchOben: {
    label: 'Spruch oben',
    schrift: 'Bebas Neue',
    groesse: 0.085,
    farbe: '#F2F2F2',
    akzentFarbe: '#8B1A1A',
    x: 0.5,
    y: 0.18,
    ausrichtung: 'mitte',
    zeilenabstand: 1.05,
    versalien: true,
    kontur: { breite: 0.005, farbe: '#000000' },
    schatten: { versatz: 0.004, farbe: '#000000' },
  },

  // Viel Text auf wenig Platz. Haettenschweiler ist die schmalste im
  // Bestand - laengere Zeilen brechen spaeter um.
  langerSpruch: {
    label: 'Langer Spruch',
    schrift: 'Haettenschweiler',
    groesse: 0.062,
    farbe: '#F2F2F2',
    akzentFarbe: '#8B1A1A',
    x: 0.5,
    y: 0.74,
    ausrichtung: 'mitte',
    zeilenabstand: 1.1,
    versalien: true,
    kontur: { breite: 0.004, farbe: '#000000' },
    schatten: { versatz: 0.004, farbe: '#000000' },
  },

  zitat: {
    label: 'Zitat',
    schrift: 'Book Antiqua',
    groesse: 0.045,
    farbe: '#E8E8E8',
    akzentFarbe: '#C8873A',
    x: 0.5,
    y: 0.42,
    ausrichtung: 'mitte',
    zeilenabstand: 1.5,
    versalien: false,
    kontur: { breite: 0.0016, farbe: '#000000' },
    schatten: { versatz: 0.004, farbe: '#000000' },
  },

  // Ohne Kontur, dafuer mit kraeftigem Schatten: fuer Bilder, die unten
  // ohnehin dunkel sind. Kontur waere dort nur Dreck im Bild.
  aufDunklem: {
    label: 'Auf dunklem Grund',
    schrift: 'Montserrat Black',
    groesse: 0.07,
    farbe: '#F2F2F2',
    akzentFarbe: '#C8873A',
    x: 0.5,
    y: 0.8,
    ausrichtung: 'mitte',
    zeilenabstand: 1.15,
    versalien: true,
    kontur: { breite: 0, farbe: '#000000' },
    schatten: { versatz: 0.008, farbe: '#000000' },
  },

  // Klein, links unten, aus dem Weg: Kollektionsname, Claim, Handle.
  ecke: {
    label: 'Kleine Ecke',
    schrift: 'Bebas Neue',
    groesse: 0.032,
    farbe: '#D8D8D8',
    akzentFarbe: '#C8873A',
    x: 0.08,
    y: 0.92,
    ausrichtung: 'links',
    zeilenabstand: 1.2,
    versalien: true,
    kontur: { breite: 0, farbe: '#000000' },
    schatten: { versatz: 0.003, farbe: '#000000' },
  },

  // Runen- und Metal-Anmutung. Gotische Schriften sind schlecht lesbar,
  // deshalb bewusst kurz und gross gedacht - nicht fuer ganze Saetze.
  runen: {
    label: 'Rau, kurz',
    schrift: 'Blackcraft',
    groesse: 0.125,
    farbe: '#EDEDED',
    akzentFarbe: '#8B1A1A',
    x: 0.5,
    y: 0.5,
    ausrichtung: 'mitte',
    zeilenabstand: 1.1,
    versalien: false,
    kontur: { breite: 0.0055, farbe: '#000000' },
    schatten: { versatz: 0.006, farbe: '#000000' },
  },

  // Schablone auf Stoff und Metall - passt zum Werkstatt- und
  // Military-Einschlag, ohne ins Gotische zu gehen.
  schablone: {
    label: 'Schablone',
    schrift: 'Stencil',
    groesse: 0.09,
    farbe: '#E8E4DC',
    akzentFarbe: '#8B1A1A',
    x: 0.5,
    y: 0.76,
    ausrichtung: 'mitte',
    zeilenabstand: 1.1,
    versalien: true,
    kontur: { breite: 0.005, farbe: '#000000' },
    schatten: { versatz: 0.005, farbe: '#000000' },
  },
};
