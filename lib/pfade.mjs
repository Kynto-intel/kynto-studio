// Pfad-Sicherheit. Jeder Schreib- und Lesezugriff geht hier durch.
// Ausserhalb von WURZEL passiert nichts, egal was der Browser schickt.

import path from 'node:path';
import fs from 'node:fs';
import { WURZEL, ORDNER } from './konfig.mjs';

/**
 * Prueft, ob ein Pfad innerhalb der konfigurierten Wurzel liegt.
 * Wirft, wenn nicht. Loest vorher Symlinks und '..' auf.
 */
export function pruefeInnerhalb(zielPfad) {
  const voll = path.resolve(zielPfad);
  const wurzel = path.resolve(WURZEL);
  const drin = voll === wurzel || voll.startsWith(wurzel + path.sep);
  if (!drin) {
    throw new Error(`Zugriff verweigert: "${voll}" liegt ausserhalb von ${wurzel}`);
  }
  return voll;
}

/** Ordner-Definition anhand ihrer id. */
export function ordnerNach(id) {
  // Frisch installiert ist die Liste leer. Ohne diesen Fall bekaeme man
  // "Unbekannter Ordner: null" - richtig, aber niemand weiss, was zu tun ist.
  if (!ORDNER.length) {
    throw new Error('Noch kein Ordner eingerichtet. In der Seitenleiste auf '
      + '"Ordner einstellen" und einen Ordner anlegen, in den gespeichert wird.');
  }
  const o = ORDNER.find((x) => x.id === id);
  if (!o) throw new Error(`Unbekannter Ordner: ${id}`);
  return o;
}

/** Legt einen Ordner an, falls er fehlt. Nur innerhalb der Wurzel. */
export function stelleOrdnerSicher(zielPfad) {
  const voll = pruefeInnerhalb(zielPfad);
  if (!fs.existsSync(voll)) fs.mkdirSync(voll, { recursive: true });
  return voll;
}

/**
 * Wandelt einen absoluten Pfad in die wurzel-relative Form um, die
 * der Browser sieht. Der Browser kennt nie absolute Pfade.
 */
export function relativ(absolut) {
  return path.relative(WURZEL, absolut).split(path.sep).join('/');
}

/** Umgekehrter Weg: relative Angabe aus dem Browser -> geprüfter absoluter Pfad. */
export function absolut(relativerPfad) {
  if (typeof relativerPfad !== 'string' || !relativerPfad.trim()) {
    throw new Error('Leerer Pfad');
  }
  return pruefeInnerhalb(path.join(WURZEL, relativerPfad));
}

/** Dateinamen von allem befreien, was im Explorer Aerger macht. */
export function saubererName(roh, ersatz = 'bild') {
  const sauber = String(roh || '')
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
  return sauber || ersatz;
}
