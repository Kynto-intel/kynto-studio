// Alte Fassungen der Texte, die den Ton der Bilder bestimmen.
//
// Betroffen sind drei Dateien: der Stil-Block fuer Bilder, der fuer Clips
// und die Regie. Alle drei sind je EINE Datei, alle drei werden im Betrieb
// geaendert, und alle drei entscheiden, wie jedes kuenftige Bild aussieht.
// Wer sich darin verschreibt, hatte bis 7.9.2026 keinen Weg zurueck.
//
// Der Ablauf ist bewusst herum: Die AKTIVE Datei bleibt, wo sie ist -
// daten/stil-block.txt und so weiter -, weil stil.mjs und regie.mjs sie bei
// jedem Prompt frisch lesen. Archiviert wird der ALTE Stand, kurz bevor er
// ueberschrieben wird. Damit ist die Reihenfolge in daten/text-verlauf/
// automatisch die Geschichte der Datei, und die aelteste Datei dort ist die
// Fassung, mit der alles anfing.
//
// Was hier NICHT passiert: zurueckspielen. Die Dateien sind Klartext und
// liegen offen - wer eine alte Fassung will, kopiert sie im Editor zurueck
// ins Feld. Ein Wiederherstellen-Knopf waere ein zweiter Weg, den Stil-Block
// zu aendern, und der erste ist schon einer zu viel gewesen.

import fs from 'node:fs';
import path from 'node:path';
import { datenPfad } from './konfig.mjs';

const ORDNER = datenPfad('text-verlauf');

/** Zeitstempel nach der Uhr dieses Rechners, sortierbar und lesbar. */
function stempel() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
    + `_${z(d.getHours())}-${z(d.getMinutes())}-${z(d.getSeconds())}`;
}

/**
 * Ein Dateiname, den es noch nicht gibt.
 *
 * Der Zeitstempel geht nur bis zur Sekunde. Zwei Aenderungen innerhalb
 * derselben Sekunde bekaemen denselben Namen, und die zweite wuerde die
 * erste ueberschreiben - ausgerechnet in dem Ordner, der nichts verlieren
 * soll. Gemessen beim ersten Trockenlauf am 7.9.2026, genau so passiert.
 */
function freierName(basis) {
  let ziel = path.join(ORDNER, `${basis}.txt`);
  let n = 2;
  while (fs.existsSync(ziel)) {
    ziel = path.join(ORDNER, `${basis}-${n}.txt`);
    n += 1;
  }
  return ziel;
}

/**
 * Den bisherigen Inhalt einer Datei wegsichern.
 *
 * Passiert nur, wenn sich wirklich etwas aendert - sonst fuellt jedes
 * Speichern ohne Aenderung den Ordner mit identischen Kopien. Und nur,
 * wenn es die Datei ueberhaupt schon gibt: beim allerersten Anlegen ist
 * nichts zu retten.
 *
 * Fehler bleiben stumm. Ein Archiv, das nicht geschrieben werden kann, darf
 * kein Speichern verhindern - der neue Text ist dem Menschen wichtiger als
 * die Kopie des alten.
 */
export function sichereAlteFassung(datei, neuerInhalt) {
  try {
    if (!fs.existsSync(datei)) return false;
    const alt = fs.readFileSync(datei, 'utf8');
    if (alt.trim() === String(neuerInhalt || '').trim()) return false;

    if (!fs.existsSync(ORDNER)) fs.mkdirSync(ORDNER, { recursive: true });
    const name = path.basename(datei, path.extname(datei));

    // Steht derselbe Text schon als juengste Fassung da, reicht das. Das
    // trifft genau einen Fall: die Ausgangsfassung vom Start und die erste
    // echte Aenderung danach - sonst waere der Ordner mit einem Doppel
    // eroeffnet.
    const juengste = fassungen(name)[0];
    if (juengste) {
      const vorhanden = fs.readFileSync(path.join(ORDNER, juengste), 'utf8');
      if (vorhanden.trim() === alt.trim()) return false;
    }

    fs.writeFileSync(freierName(`${name}_${stempel()}`), alt, 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Den JETZIGEN Stand als Ausgangsfassung wegsichern, falls es noch gar
 * keine gibt.
 *
 * Ohne das entstuende die erste Kopie erst beim ersten Speichern - wer nie
 * wieder etwas aendert, haette nie eine. Genau die Fassung, die heute
 * funktioniert, waere dann die einzige, von der es keine Sicherung gibt.
 * Laeuft beim Start und tut danach nichts mehr.
 */
export function sichereAusgangsfassung(datei) {
  try {
    if (!fs.existsSync(datei)) return false;
    const name = path.basename(datei, path.extname(datei));
    if (fassungen(name).length) return false;

    if (!fs.existsSync(ORDNER)) fs.mkdirSync(ORDNER, { recursive: true });
    fs.copyFileSync(datei, freierName(`${name}_${stempel()}_ausgang`));
    return true;
  } catch {
    return false;
  }
}

/** Alle aufbewahrten Fassungen einer Datei, neueste zuerst. */
export function fassungen(name) {
  try {
    if (!fs.existsSync(ORDNER)) return [];
    return fs.readdirSync(ORDNER)
      .filter((f) => f.startsWith(`${name}_`) && f.endsWith('.txt'))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/** Wo die Fassungen liegen - fuer die Anzeige in der Oberflaeche. */
export const VERLAUF_ORDNER = ORDNER;
