// Der Stil-Block. EINE Quelle fuer alle Anbieter.
// Wird an jeden Prompt gehaengt, damit die Bilder nicht "random" aussehen.
// Beispielhafter Standard - jeder ueberschreibt ihn mit seinem eigenen Stil.

import fs from 'node:fs';
import { datenPfad } from './konfig.mjs';

const DATEI = datenPfad('stil-block.txt');

export const STANDARD_STIL = [
  'STYLE AND ATMOSPHERE: cinematic, photoreal, epic scale, extreme detail;',
  'wild and untamed mood with heavy mist, stormy clouds and deep dramatic',
  'shadows; high-contrast chiaroscuro lighting with sparse flecks of warm',
  'golden light breaking through onto wet textures.',
  'COLOR PALETTE (one fixed family, so a whole feed looks like one hand):',
  'deep near-black charcoal (#1A1A1A) as the dominant base shadow color in',
  'every image, plus warm gold (#C9A24B) as the only light and highlight',
  'accent color in every image; additionally ONE secondary dominant tone',
  'depending on the scene: dark muted forest moss green (#2C3527) for',
  'nature, forest and outdoor scenes, OR warm aged leather brown (#4A3728)',
  'for clothing, wood, texture and product scenes; never both secondary',
  'tones at full strength in the same image; a small amount of warm pale',
  'beige (#D9CBB4) only as an occasional light highlight (mist, paper,',
  'bright surfaces), used sparingly, never as a dominant tone;',
  'desaturated, earthy and raw, never bright or colourful.',
  'NEGATIVE: no text, no lettering, no watermarks, no runes or inscriptions,',
  'no modern objects, no neon or candy colours, no cheerful daylight,',
  'no clean studio look, no bright or cheerful green meadows, no blue tones,',
  'no teal tones, no midnight blue, no slate grey as a dominant color.',
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