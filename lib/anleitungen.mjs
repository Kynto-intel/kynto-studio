// Anleitungen: Handwerk fuer EINE Aufgabe, geladen wenn die Aufgabe kommt.
//
// Die vierte Textschicht der App, und sie fuellt eine echte Luecke:
//
//   Stil-Block   wie alles aussieht. Haengt an JEDEM Prompt.
//   Regie        wie der Assistent arbeitet. Geht bei JEDEM Zug mit.
//   Vorlage      EIN Lauf, der funktioniert hat. Wiederholt eine Sache.
//   Anleitung    wie man diese ART Prompt baut. Erzeugt Neues derselben Art.
//
// Der Unterschied zur Vorlage ist scharf: Eine Vorlage ist ein fertiger
// Prompt. Eine Anleitung ist der Bauplan dahinter - Aufbau, Fallen,
// Pruefliste. Die Vorlage wiederholt, die Anleitung befaehigt.
//
// Warum nicht alles in die Regie: Die Regie geht bei JEDEM Zug mit und wird
// jedes Mal bezahlt - auch bei "was habe ich gestern gemacht". Wanderten die
// Mockup-Regeln, die Pin-Regeln und die Textregeln alle dorthin, zahlte man
// jedes Mal alles. Deshalb bekommt das Modell nur die LISTE (Name plus eine
// Zeile "wann"), und den vollen Text erst, wenn es eine zieht. Eine
// Werkzeugkiste kennen, ohne jedes Werkzeug in der Hand zu halten.
//
// Format einer Datei - bewusst so schlicht, dass sie im Editor lesbar ist:
//
//   # Shirt-Mockup
//   Wann: ein vorhandenes Design auf einem getragenen Shirt zeigen.
//
//   ... der Rest ist der Text, den das Modell bekommt ...
//
// Der Assistent kann Anleitungen LESEN, nicht schreiben. Aus demselben Grund
// wie beim Stil-Block: was den Ton aller kuenftigen Bilder bestimmt, aendert
// der Mensch.

import fs from 'node:fs';
import path from 'node:path';
import { datenPfad } from './konfig.mjs';

const ORDNER = datenPfad('anleitungen');

/** Wo die Anleitungen liegen - fuer die Anzeige in der Oberflaeche. */
export const ANLEITUNGEN_ORDNER = ORDNER;

/**
 * Kennung aus einem Dateinamen. Nur das, was gefahrlos zurueckgereicht
 * werden kann - dieselbe Haerte wie in vorlagen.bildDatei().
 */
function kennungVon(datei) {
  return path.basename(datei, path.extname(datei))
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 64);
}

/** Erste "# ..."-Zeile als Name, erste "Wann: ..."-Zeile als Ausloeser. */
function kopfLesen(text, ersatzName) {
  const zeilen = String(text || '').split('\n');
  const name = zeilen.find((z) => z.startsWith('# '))?.slice(2).trim() || ersatzName;
  const wann = zeilen.find((z) => /^wann:/i.test(z.trim()))?.replace(/^wann:/i, '').trim() || '';
  return { name, wann };
}

/**
 * Alle Anleitungen, ohne Text - Name, Ausloeser, Kennung.
 *
 * Genau das geht in den Systemhinweis. Bei einem Dutzend Anleitungen sind
 * das ein paar hundert Zeichen, nicht ein paar tausend.
 */
export function liste() {
  try {
    if (!fs.existsSync(ORDNER)) return [];
    return fs.readdirSync(ORDNER)
      .filter((f) => f.endsWith('.md') || f.endsWith('.txt'))
      .map((f) => {
        const kennung = kennungVon(f);
        if (!kennung) return null;
        const roh = fs.readFileSync(path.join(ORDNER, f), 'utf8');
        const { name, wann } = kopfLesen(roh, kennung);
        return { kennung, name, wann, zeichen: roh.length };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  } catch {
    // Ein unlesbarer Ordner darf kein Gespraech aufhalten.
    return [];
  }
}

/**
 * Der volle Text einer Anleitung.
 *
 * Nimmt eine Kennung, nie einen Pfad. Alles andere waere ein zweiter Weg
 * ins Dateisystem, und den gibt es hier nicht.
 */
export function lies(kennung) {
  const sauber = String(kennung || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  if (!sauber) throw new Error('Keine Anleitung angegeben.');

  for (const endung of ['.md', '.txt']) {
    const datei = path.join(ORDNER, sauber + endung);
    if (fs.existsSync(datei)) {
      const text = fs.readFileSync(datei, 'utf8');
      const { name, wann } = kopfLesen(text, sauber);
      return { kennung: sauber, name, wann, text };
    }
  }

  // Namen der vorhandenen mitgeben: ein Modell, das sich vertippt, soll
  // sich selbst korrigieren koennen statt aufzugeben.
  const da = liste().map((a) => a.kennung);
  throw new Error(`Anleitung "${sauber}" gibt es nicht.`
    + (da.length ? ` Vorhanden: ${da.join(', ')}.` : ' Es gibt noch keine.'));
}

/** Zeilen fuer den Systemhinweis. Leer, wenn es keine gibt. */
export function fuerHinweis() {
  const alle = liste();
  if (!alle.length) return [];
  return [
    '',
    'ANLEITUNGEN - Handwerk fuer bestimmte Aufgaben. Passt eine zur Frage,',
    'lies sie MIT anleitung_lesen, BEVOR du einen Prompt schreibst. Sie',
    'enthaelt, was hier nicht steht: Aufbau, Masse, typische Fehler.',
    ...alle.map((a) => `- ${a.kennung}: ${a.wann || a.name}`),
  ];
}
