// Metadaten je Bild als Sidecar-JSON neben der Bilddatei.
// Bewusst kein zentraler Index: Verschieben oder Umbenennen im Explorer
// darf nichts kaputt machen, und der Prompt bleibt beim Bild.

import fs from 'node:fs';
import path from 'node:path';
import { pruefeInnerhalb } from './pfade.mjs';

/** Pfad des Sidecars zu einer Bilddatei: bild.png -> bild.png.json */
export function sidecarPfad(bildPfad) {
  return `${bildPfad}.json`;
}

export const LEER = {
  prompt: '',
  motiv: '',
  stilBlock: '',
  mitStil: true,
  anbieter: '',
  modell: '',
  format: '',
  erstellt: '',
  referenzBild: null,
  eltern: null,
  version: 1,
  favorit: false,
  freigegeben: false,
  szene: null,
  caption: '',
  kosten: null,
};

/** Liest das Sidecar. Fehlt es, kommt ein leerer Satz zurueck. */
export function lies(bildPfad) {
  const p = sidecarPfad(pruefeInnerhalb(bildPfad));
  if (!fs.existsSync(p)) return { ...LEER };
  try {
    return { ...LEER, ...JSON.parse(fs.readFileSync(p, 'utf8')) };
  } catch {
    // Kaputtes JSON soll die Galerie nicht lahmlegen
    return { ...LEER };
  }
}

/** Steht in dem Satz ueberhaupt etwas drin, das sich zu speichern lohnt? */
function hatInhalt(daten) {
  return Object.entries(daten).some(([feld, wert]) => {
    if (feld === 'version' || feld === 'mitStil') return false; // haben immer einen Standard
    if (wert === null || wert === '' || wert === false) return false;
    return true;
  });
}

/**
 * Schreibt das Sidecar vollstaendig.
 *
 * Ist nichts drin, wird auch nichts angelegt - sonst liegt neben jedem
 * Bild, das jemand selbst in den Ordner legt, eine leere JSON-Datei herum.
 */
export function schreibe(bildPfad, daten) {
  const p = sidecarPfad(pruefeInnerhalb(bildPfad));
  const inhalt = { ...LEER, ...daten };

  if (!hatInhalt(inhalt)) {
    if (fs.existsSync(p)) fs.unlinkSync(p);   // alte leere Datei aufraeumen
    return inhalt;
  }

  fs.writeFileSync(p, JSON.stringify(inhalt, null, 2), 'utf8');
  return inhalt;
}

/** Aendert einzelne Felder, laesst den Rest stehen. */
export function aktualisiere(bildPfad, aenderungen) {
  return schreibe(bildPfad, { ...lies(bildPfad), ...aenderungen });
}

/** Loescht das Sidecar mit, wenn ein Bild geloescht wird. */
export function entferne(bildPfad) {
  const p = sidecarPfad(pruefeInnerhalb(bildPfad));
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

/** Zieht das Sidecar mit um, wenn die Bilddatei umbenannt wird. */
export function benenneUm(altPfad, neuPfad) {
  const alt = sidecarPfad(pruefeInnerhalb(altPfad));
  const neu = sidecarPfad(pruefeInnerhalb(neuPfad));
  if (fs.existsSync(alt)) fs.renameSync(alt, neu);
}

/**
 * Verfolgt die Versionskette nach oben: v3 -> v2 -> v1.
 * Gibt die Kette vom Original bis zum uebergebenen Bild zurueck.
 */
export function kette(bildPfad, wurzelOrdner) {
  const glieder = [];
  let aktuell = bildPfad;
  const gesehen = new Set();
  while (aktuell && !gesehen.has(aktuell)) {
    gesehen.add(aktuell);
    glieder.unshift(aktuell);
    const meta = lies(aktuell);
    if (!meta.eltern) break;
    const elternPfad = path.join(wurzelOrdner, meta.eltern);
    if (!fs.existsSync(elternPfad)) break;
    aktuell = elternPfad;
  }
  return glieder;
}
