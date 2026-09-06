// Der Stil-Block. EINE Quelle je Gattung, fuer alle Anbieter.
// Wird an jeden Prompt gehaengt, damit nichts "random" aussieht.
// Beispielhafter Standard - jeder ueberschreibt ihn mit seinem eigenen Stil.
//
// Zwei Bloecke, nicht einer: Bild und Video. Bis 6.9.2026 gab es nur den
// fuers Bild, und Clips liefen voellig ohne - deshalb sahen sie nie aus wie
// der Rest. Zusammenlegen geht nicht, weil ein Videomodell andere Worte
// braucht: "shallow depth of field" versteht es, "no distorted hands" laeuft
// ins Leere, und Korn und Kamera-Charakter gehoeren dort dazu.
//
// Was hier NICHT hineingehoert: Bewegung, Kamerafahrt, Schnitt. Das steht im
// Prompt selbst und im Handwerk (daten/regie.txt). Der Block beschreibt, wie
// es aussieht - nicht, was passiert.

import fs from 'node:fs';
import { datenPfad } from './konfig.mjs';

const DATEI = datenPfad('stil-block.txt');
const DATEI_VIDEO = datenPfad('stil-block-video.txt');

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

/**
 * Dasselbe fuer Clips, ebenfalls neutral.
 *
 * Unterschiede zum Bild-Block, und warum: kein Wort ueber Bewegung (das
 * steht im Prompt), dafuer Korn und Kamera-Charakter (die legen beim Clip
 * den Materialeindruck fest) und "one continuous shot" in der Negativliste
 * (Videomodelle schneiden sonst gern von selbst).
 */
export const STANDARD_STIL_VIDEO = [
  'LOOK AND ATMOSPHERE: cinematic, photoreal, natural light, shallow depth',
  'of field, fine film grain, calm and grounded mood.',
  'COLOR PALETTE (one fixed family, so every clip looks like one hand):',
  'one muted base tone carrying the whole frame, plus exactly ONE warm accent',
  'colour for highlights; desaturated and consistent, never candy-bright,',
  'never a different palette per clip.',
  'NEGATIVE: no text, no lettering, no captions, no watermarks, no logos,',
  'no cuts, no scene changes, no distorted faces or hands, no modern clutter,',
  'no oversaturated colours, no stock-footage look.',
].join(' ');

/** Wo die Dateien liegen - fuer die Anzeige in der Oberflaeche. */
export const STIL_DATEI = DATEI;
export const STIL_DATEI_VIDEO = DATEI_VIDEO;

/**
 * Legt die Datei mit dem Standardtext an, falls sie fehlt.
 * Dadurch gibt es sie von Anfang an und laesst sich auch in einem
 * beliebigen Texteditor bearbeiten, nicht nur in der App.
 */
export function stelleDateiSicher() {
  try {
    if (!fs.existsSync(DATEI)) fs.writeFileSync(DATEI, STANDARD_STIL, 'utf8');
    if (!fs.existsSync(DATEI_VIDEO)) fs.writeFileSync(DATEI_VIDEO, STANDARD_STIL_VIDEO, 'utf8');
  } catch {
    // Nicht schreibbar - die App laeuft trotzdem mit dem Standard
  }
  return DATEI;
}

/** Liest eine der beiden Dateien, faellt auf ihren Standard zurueck. */
function lies(datei, standard) {
  try {
    if (fs.existsSync(datei)) {
      const inhalt = fs.readFileSync(datei, 'utf8').trim();
      if (inhalt) return inhalt;
    }
  } catch {
    // Datei kaputt oder nicht lesbar -> Standard verwenden
  }
  return standard;
}

/**
 * Liest den Stil-Block.
 *
 * Wird bei JEDEM Prompt frisch gelesen, nicht zwischengespeichert. Dadurch
 * greift eine Aenderung sofort - egal ob sie in der App oder direkt in der
 * Datei gemacht wurde, und ohne den Server neu zu starten.
 */
export function ladeStil() {
  return lies(DATEI, STANDARD_STIL);
}

/** Dasselbe fuer Clips. */
export function ladeStilVideo() {
  return lies(DATEI_VIDEO, STANDARD_STIL_VIDEO);
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

/** Dasselbe fuer Clips. */
export function speichereStilVideo(text) {
  const sauber = String(text || '').trim() || STANDARD_STIL_VIDEO;
  fs.writeFileSync(DATEI_VIDEO, sauber, 'utf8');
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

/**
 * Dasselbe fuer Clips - gleicher Bau, anderer Block.
 *
 * Bewusst dieselbe Reihenfolge wie beim Bild: erst das, was passiert, dann
 * wie es aussieht. Der Bewegungsteil steht damit vorn, wo ihn die
 * Videomodelle am zuverlaessigsten aufnehmen.
 */
export function bauePromptVideo(motiv, mitStil = true) {
  const kern = String(motiv || '').trim();
  if (!mitStil) return kern;
  return `${kern.replace(/[.\s]+$/, '')}. ${ladeStilVideo()}`;
}