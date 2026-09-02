// Bestand einsammeln: alle Bilder und Clips aus den konfigurierten Ordnern,
// zusammen mit ihren Sidecar-Metadaten.

import fs from 'node:fs';
import path from 'node:path';
import { ORDNER, BILD_ENDUNGEN, VIDEO_ENDUNGEN } from './konfig.mjs';
import { relativ, pruefeInnerhalb } from './pfade.mjs';
import { lies } from './sidecar.mjs';

function artVon(datei) {
  const e = path.extname(datei).toLowerCase();
  if (BILD_ENDUNGEN.includes(e)) return 'bild';
  if (VIDEO_ENDUNGEN.includes(e)) return 'video';
  return null;
}

/** Ein Eintrag so, wie ihn der Browser bekommt. Nie absolute Pfade. */
function eintrag(vollPfad, ordnerId) {
  const stat = fs.statSync(vollPfad);
  const meta = lies(vollPfad);
  return {
    pfad: relativ(vollPfad),
    name: path.basename(vollPfad),
    ordner: ordnerId,
    art: artVon(vollPfad),
    groesse: stat.size,
    geaendert: stat.mtime.toISOString(),
    ...meta,
  };
}

/**
 * Ein einzelner Eintrag zu einem bekannten Pfad.
 *
 * Fuer das Verlaufsfenster: dort steht nur der Pfad, die Detailansicht
 * braucht aber alles - Sidecar, Ordner, Art. Gibt null zurueck, wenn die
 * Datei nicht mehr da ist; der Verlauf reicht weiter zurueck als der
 * Bestand, geloescht wird ausserhalb der App.
 */
export function einzeln(vollPfad) {
  if (!fs.existsSync(vollPfad)) return null;
  const o = ORDNER.find((x) => vollPfad.startsWith(x.pfad + path.sep));
  return eintrag(vollPfad, o?.id || null);
}

/**
 * Liest alle Ordner ein. Fehlende Ordner werden uebersprungen,
 * nicht angelegt - die Galerie soll nichts anfassen.
 */
export function bestand({ ordner = null, art = null, nurFavoriten = false } = {}) {
  const treffer = [];
  for (const o of ORDNER) {
    if (ordner && o.id !== ordner) continue;
    if (!fs.existsSync(o.pfad)) continue;
    let dateien;
    try {
      dateien = fs.readdirSync(o.pfad, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const d of dateien) {
      if (!d.isFile()) continue;
      const voll = path.join(o.pfad, d.name);
      if (!artVon(voll)) continue;
      const e = eintrag(voll, o.id);
      if (art && e.art !== art) continue;
      if (nurFavoriten && !e.favorit) continue;
      treffer.push(e);
    }
  }
  treffer.sort((a, b) => b.geaendert.localeCompare(a.geaendert));
  return treffer;
}

/**
 * Sucht in allem, was ueber ein Bild bekannt ist: Dateiname, Motiv, dem
 * vollen Prompt, Modell, Format und der Bildunterschrift. Absichtlich so
 * breit - man erinnert sich mal an den Dateinamen, mal an ein Wort aus dem
 * Prompt, und muss nicht wissen, wonach man gerade sucht.
 */
function passt(e, wort) {
  return [e.name, e.motiv, e.prompt, e.modell, e.format, e.caption]
    .some((feld) => String(feld || '').toLowerCase().includes(wort));
}

/**
 * Bestand plus alles, was die Kopfzeile fuer Reiter und Suche braucht -
 * aus einem einzigen Durchlauf ueber die Platte.
 *
 * Die Reihenfolge ist Absicht:
 *   1. Ordner und Favoriten einsammeln  -> daraus faellt `hatVideos`
 *   2. Suche anwenden                   -> daraus fallen die Reiter-Zahlen
 *   3. Art anwenden                     -> daraus faellt die Anzeige
 *
 * `hatVideos` stammt bewusst aus Schritt 1, also VOR der Suche. Sonst
 * verschwaende der Video-Reiter, sobald eine Suche zufaellig kein Video
 * trifft - mitten im Tippen, und man kaeme nicht mehr zurueck.
 */
export function bestandFuerAnsicht({ ordner = null, art = null, nurFavoriten = false, suche = '' } = {}) {
  const alle = bestand({ ordner, nurFavoriten });
  const hatVideos = alle.some((e) => e.art === 'video');

  const wort = String(suche || '').trim().toLowerCase();
  const gefunden = wort ? alle.filter((e) => passt(e, wort)) : alle;

  const artZaehlung = { bild: 0, video: 0 };
  for (const e of gefunden) artZaehlung[e.art] = (artZaehlung[e.art] || 0) + 1;

  return {
    eintraege: art ? gefunden.filter((e) => e.art === art) : gefunden,
    artZaehlung,
    hatVideos,
  };
}

/** Zaehlt, was in jedem Ordner liegt - fuer die Filterleiste. */
export function zaehlung() {
  const z = {};
  for (const o of ORDNER) {
    z[o.id] = fs.existsSync(o.pfad)
      ? fs.readdirSync(o.pfad).filter((f) => artVon(f)).length
      : 0;
  }
  return z;
}

/** Rohe Bytes einer Datei, fuer die Vorschau im Browser. */
export function lieferDatei(vollPfad) {
  const p = pruefeInnerhalb(vollPfad);
  if (!fs.existsSync(p)) throw new Error('Datei nicht gefunden');
  return fs.readFileSync(p);
}
