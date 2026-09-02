// Der Stil-Block. EINE Quelle fuer alle Anbieter.
// Wird an jeden Prompt gehaengt, damit die Bilder nicht "random" aussehen.
// Beispielhafter Standard - jeder ueberschreibt ihn mit seinem eigenen Stil.

import fs from 'node:fs';
import { datenPfad } from './konfig.mjs';

const DATEI = datenPfad('stil-block.txt');

/**
 * Startvorlage, absichtlich neutral gehalten.
 *
 * Sie zeigt den Aufbau, der sich bewaehrt hat - Atmosphaere, dann eine
 * feste Palette, dann eine Negativliste - und ist bewusst NICHT der Stil
 * irgendeiner Marke. Wer die App installiert, soll hier seinen eigenen
 * Look eintragen, nicht den eines Fremden geerbt bekommen.
 *
 * Der eigene Block steht in daten/stil-block.txt und gewinnt immer. Diese
 * Konstante wird nur gebraucht, wenn es die Datei noch nicht gibt, wenn sie
 * unlesbar ist, oder wenn man in der App auf Zuruecksetzen geht.
 */
export const STANDARD_STIL = [
  'STYLE AND ATMOSPHERE: cinematic, photoreal, natural light, shallow depth',
  'of field, fine surface texture, calm and grounded mood.',
  'COLOR PALETTE (one fixed family, so a whole feed looks like one hand):',
  'one muted base tone carrying every image, plus exactly ONE warm accent',
  'colour for highlights; desaturated and consistent, never candy-bright,',
  'never a different palette per image.',
  'NEGATIVE: no text, no lettering, no watermarks, no logos, no distorted',
  'hands, no modern clutter, no oversaturated colours, no stock-photo look.',
].join(' ');

/** Wo die Datei liegt - fuer die Anzeige in der Oberflaeche. */
export const STIL_DATEI = DATEI;

/**
 * Legt die Datei mit dem Standardtext an, falls sie fehlt.
 * Dadurch gibt es sie von Anfang an und laesst sich auch in einem
 * beliebigen Texteditor bearbeiten, nicht nur in der App.
 */
export function stelleDateiSicher() {
  try {
    if (!fs.existsSync(DATEI)) fs.writeFileSync(DATEI, STANDARD_STIL, 'utf8');
  } catch {
    // Nicht schreibbar - die App laeuft trotzdem mit dem Standard
  }
  return DATEI;
}

/**
 * Liest den Stil-Block.
 *
 * Wird bei JEDEM Prompt frisch gelesen, nicht zwischengespeichert. Dadurch
 * greift eine Aenderung sofort - egal ob sie in der App oder direkt in der
 * Datei gemacht wurde, und ohne den Server neu zu starten.
 */
export function ladeStil() {
  try {
    if (fs.existsSync(DATEI)) {
      const inhalt = fs.readFileSync(DATEI, 'utf8').trim();
      if (inhalt) return inhalt;
    }
  } catch {
    // Datei kaputt oder nicht lesbar -> Standard verwenden
  }
  return STANDARD_STIL;
}

/**
 * Speichert einen geaenderten Stil-Block.
 * Leerer Text setzt zurueck auf den Standard - die Datei bleibt bestehen
 * und enthaelt dann wieder den Standardtext, damit sie nie verschwindet.
 */
export function speichereStil(text) {
  const sauber = String(text || '').trim() || STANDARD_STIL;
  fs.writeFileSync(DATEI, sauber, 'utf8');
  return sauber;
}

/**
 * Baut den vollstaendigen Prompt.
 * mitStil=false laesst den Block weg (nur fuer Tests).
 */
export function bauePrompt(motiv, mitStil = true) {
  const kern = String(motiv || '').trim();
  if (!mitStil) return kern;
  return `${kern.replace(/[.\s]+$/, '')}. ${ladeStil()}`;
}