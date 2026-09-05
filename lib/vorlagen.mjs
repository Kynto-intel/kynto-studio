// Vorlagen: ein Lauf, der sitzt, unter eigenem Namen aufbewahrt.
//
// Gespeichert wird der ganze Zustand, aus dem ein Bild oder ein Clip
// entstanden ist - Motiv, Modell, Format, Anzahl, Haken, Referenzbild -
// plus das Ergebnis als Miniatur. Damit sieht man in der Liste, was hinten
// rauskommt, statt nur einen Prompt zu lesen.
//
// Was hier NICHT drinsteht: der Stil-Block. Nur der Haken "mit Stil" wird
// festgehalten. Der Stil-Block ist absichtlich eine einzige lebende Quelle
// (stil.mjs) - eine Vorlage mit eigener eingefrorener Fassung waere eine
// zweite Wahrheit, und man wuesste bei einem Bild nie, welche gegolten hat.
//
// Das Modul rechnet nicht mit Pfaden und prueft sie nicht. Es speichert
// Zeichenketten. Die Pruefung auf die Wurzel passiert in server.mjs, bevor
// hier etwas ankommt.

import fs from 'node:fs';
import path from 'node:path';
import { datenPfad, WURZEL } from './konfig.mjs';

const DATEI = datenPfad('vorlagen.json');

/** Laengster erlaubter Name. Reicht fuer jede sinnvolle Bezeichnung. */
const NAME_MAX = 60;

function lade() {
  try {
    if (fs.existsSync(DATEI)) {
      const inhalt = JSON.parse(fs.readFileSync(DATEI, 'utf8'));
      if (Array.isArray(inhalt)) return inhalt;
    }
  } catch {
    // Kaputte Datei: lieber mit leerer Liste weiterlaufen als den Start
    // verweigern. Vorlagen sind Bequemlichkeit, kein Betriebsmittel.
  }
  return [];
}

function schreibe(liste) {
  fs.writeFileSync(DATEI, JSON.stringify(liste, null, 2), 'utf8');
  return liste;
}

/** Die rohe Liste, so wie sie auf der Platte liegt. */
export function lies() {
  return lade();
}

/**
 * Die Liste, angereichert um zwei Angaben, die nur das Dateisystem kennt:
 * ob die Miniatur und ob das Referenzbild ueberhaupt noch existieren.
 *
 * Bewusst hier und nicht per `onerror` im Browser: so flackert kein
 * Platzhalter nach, und der Ladeknopf weiss vorher, dass eine Referenz
 * fehlt - statt den Lauf spaeter am toten Pfad scheitern zu lassen.
 */
export function mitBestand() {
  const da = (p) => {
    if (!p) return false;
    try {
      return fs.existsSync(path.join(WURZEL, p));
    } catch {
      return false;
    }
  };
  return lade().map((v) => ({
    ...v,
    miniaturDa: da(v.miniatur),
    referenzDa: da(v.referenz),
  }));
}

/**
 * Anlegen oder ueberschreiben. Ohne id entsteht eine neue Vorlage.
 * Gibt die vollstaendige Liste zurueck, damit die Oberflaeche nach dem
 * Speichern nicht noch einmal nachfragen muss.
 */
export function sichere(roh = {}) {
  const name = String(roh.name || '').trim().slice(0, NAME_MAX);
  if (!name) throw new Error('Die Vorlage braucht einen Namen.');

  const art = roh.art === 'video' ? 'video' : 'bild';
  if (!String(roh.motiv || '').trim()) {
    throw new Error('Die Vorlage braucht ein Motiv.');
  }

  const vorlage = {
    id: roh.id || `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    art,
    motiv: String(roh.motiv),
    modell: roh.modell || null,
    formatId: roh.formatId || null,
    // Video laeuft immer als einzelner Clip - anzahlWahl ist dort versteckt.
    anzahl: art === 'video' ? 1 : Math.min(Math.max(1, Number(roh.anzahl) || 1), 10),
    klein: Boolean(roh.klein),
    mitStil: roh.mitStil !== false,
    dateiname: String(roh.dateiname || ''),
    // Nur beim Clip. Beim Bild waeren sie Ballast, der spaeter jemanden
    // ratlos macht, warum in einer Bild-Vorlage eine Dauer steht.
    dauer: art === 'video' ? Number(roh.dauer) || null : null,
    aufloesung: art === 'video' ? roh.aufloesung || null : null,
    referenz: roh.referenz || null,
    miniatur: roh.miniatur || null,
    erstellt: roh.erstellt || new Date().toISOString(),
  };

  const liste = lade();
  const stelle = liste.findIndex((v) => v.id === vorlage.id);
  if (stelle >= 0) liste[stelle] = vorlage;
  else liste.unshift(vorlage);

  schreibe(liste);
  return vorlage;
}

/** Loeschen. Die Bilddateien bleiben unberuehrt - es geht nur die Notiz weg. */
export function entferne(id) {
  const liste = lade();
  const weg = liste.find((v) => v.id === id);
  if (!weg) throw new Error('Diese Vorlage gibt es nicht.');
  schreibe(liste.filter((v) => v.id !== id));
  return weg;
}
