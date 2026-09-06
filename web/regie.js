// Regie: was der Assistent ueber das Handwerk weiss.
//
// Zeichnet sich in die Einstellungen hinein, auf deren zweiten Reiter, und
// hat keinen eigenen Punkt in der Seitenleiste. Eigenes Modul bleibt es
// trotzdem: die Einstellungen kuemmern sich um Geld, die Regie um Sprache -
// das sind zwei Aufgaben, auch wenn sie hinter einem Knopf liegen.
//
// Ein einziges Textfeld - hier steht kein Formular, sondern Prosa, die als
// Ganzes in den Systemhinweis wandert.
//
// Nicht zu verwechseln mit dem Stil-Block unten im Komponisten. Der geht an
// das Bildmodell und beschreibt den Look. Was hier steht, geht an das
// Sprachmodell im Chat und beschreibt, wie ein brauchbarer Prompt gebaut
// ist. Deshalb zwei Felder an zwei Orten und nicht eins.

import { api } from './api.js';

let text = '';
let standard = '';
let datei = '';

export function setzeDaten({ regie, standardRegie, regieDatei } = {}) {
  text = regie || '';
  standard = standardRegie || '';
  datei = regieDatei || '';
}

/** Frisch holen - die Datei laesst sich auch im Editor aendern. */
export async function lade() {
  try {
    const a = await api.start();
    text = a.regie || '';
  } catch {
    // Dann steht der zuletzt bekannte Stand da.
  }
}

export function zeichne(ziel) {
  const kasten = document.createElement('div');
  kasten.className = 'einstellungen';

  // Keine eigene Ueberschrift: der Reiter darueber heisst schon "Regie".
  // Zwei Zeilen mit demselben Wort untereinander waeren nur Fuellung.
  const erklaerung = document.createElement('p');
  erklaerung.className = 'gr-erklaerung';
  erklaerung.textContent = 'Was der Assistent über das Handwerk weiß: wie ein '
    + 'Bildprompt aufgebaut ist, was ein Clip verträgt, wann er nachfragt. '
    + 'Der Text geht bei jedem Gesprächszug mit — jede Zeile wird also '
    + 'mitbezahlt. Leeren heißt: keine Hinweise, der Assistent macht es nach '
    + 'eigenem Ermessen.';

  const abgrenzung = document.createElement('p');
  abgrenzung.className = 'gr-erklaerung gr-klein';
  abgrenzung.textContent = 'Nicht der Stil-Block. Der steht unten im '
    + 'Komponisten, geht an das Bildmodell und beschreibt den Look. Hier steht, '
    + 'wie der Assistent schreibt — nicht, wie das Bild aussieht.';

  const feld = document.createElement('textarea');
  feld.className = 'regie-feld';
  feld.rows = 22;
  feld.spellcheck = false;
  feld.value = text;

  const knoepfe = document.createElement('div');
  knoepfe.className = 'stil-knoepfe';

  const speichern = document.createElement('button');
  speichern.type = 'button';
  speichern.className = 'fest';
  speichern.textContent = 'Speichern';

  const zuruecksetzen = document.createElement('button');
  zuruecksetzen.type = 'button';
  zuruecksetzen.className = 'neben';
  zuruecksetzen.textContent = 'Auf Standard zurücksetzen';

  knoepfe.append(speichern, zuruecksetzen);

  speichern.addEventListener('click', async () => {
    speichern.disabled = true;
    try {
      const a = await api.regieSpeichern(feld.value);
      text = a.regie;
      feld.value = text;
      speichern.textContent = 'Gespeichert';
      setTimeout(() => { speichern.textContent = 'Speichern'; }, 1500);
    } catch (fehler) {
      speichern.textContent = `Fehlgeschlagen: ${fehler.message}`;
    } finally {
      speichern.disabled = false;
    }
  });

  // Schickt ausdruecklich den Standardtext, nicht die Leere. Leer speichern
  // heisst hier naemlich wirklich leer - siehe lib/regie.mjs.
  zuruecksetzen.addEventListener('click', async () => {
    const a = await api.regieSpeichern(standard);
    text = a.regie;
    feld.value = text;
  });

  kasten.append(erklaerung, abgrenzung, feld, knoepfe);

  if (datei) {
    const pfad = document.createElement('div');
    pfad.className = 'stil-pfad';
    pfad.textContent = datei;
    pfad.title = 'Klicken zum Kopieren — die Datei lässt sich auch im Editor bearbeiten';
    pfad.addEventListener('click', async () => {
      await navigator.clipboard.writeText(datei);
      const alt = pfad.textContent;
      pfad.textContent = 'Pfad kopiert';
      setTimeout(() => { pfad.textContent = alt; }, 1600);
    });
    kasten.append(pfad);
  }

  ziel.append(kasten);
}
