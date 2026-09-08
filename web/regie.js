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
let fassungen = 0;
let verlaufOrdner = '';
let anleitungen = [];
let anleitungenOrdner = '';

export function setzeDaten({ regie, standardRegie, regieDatei, textVerlauf, anleitungen: anl } = {}) {
  text = regie || '';
  standard = standardRegie || '';
  datei = regieDatei || '';
  fassungen = textVerlauf?.regie || 0;
  verlaufOrdner = textVerlauf?.ordner || '';
  anleitungen = anl?.liste || [];
  anleitungenOrdner = anl?.ordner || '';
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

  // Wie viele frueheren Fassungen aufgehoben sind. Ein Archiv, das man
  // nicht kennt, hilft im Ernstfall nicht.
  if (fassungen) {
    const alt = document.createElement('div');
    alt.className = 'stil-pfad stil-fassungen';
    alt.textContent = fassungen + ' frühere '
      + (fassungen === 1 ? 'Fassung' : 'Fassungen') + ' aufgehoben — ' + verlaufOrdner;
    alt.title = 'Klicken zum Kopieren — hier liegen die früheren Fassungen';
    alt.addEventListener('click', async () => {
      await navigator.clipboard.writeText(verlaufOrdner);
      const vorher = alt.textContent;
      alt.textContent = 'Ordner kopiert';
      setTimeout(() => { alt.textContent = vorher; }, 1600);
    });
    kasten.append(alt);
  }

  // Die Anleitungen. Sie gehoeren hierher und nicht in einen eigenen
  // Reiter: die Regie sagt, WIE der Assistent arbeitet, die Anleitungen
  // sagen, was er fuer eine bestimmte Aufgabe weiss. Dieselbe Frage,
  // zwei Antworten.
  const anl = document.createElement('div');
  anl.className = 'anleitungen';

  const anlTitel = document.createElement('h3');
  anlTitel.textContent = 'Anleitungen';
  anl.append(anlTitel);

  const anlText = document.createElement('p');
  anlText.className = 'gr-erklaerung';
  anlText.textContent = anleitungen.length
    ? 'Handwerk fuer einzelne Aufgaben. Der Assistent sieht nur die Namen und '
      + 'liest eine erst, wenn sie dran ist — sie kosten dich also nichts, '
      + 'solange sie nicht gebraucht werden. Neue Datei im Ordner anlegen reicht.'
    : 'Noch keine. Eine Anleitung ist eine Textdatei im Ordner unten: erste '
      + 'Zeile „# Name“, zweite „Wann: …“, der Rest ist Inhalt.';
  anl.append(anlText);

  if (anleitungen.length) {
    const liste = document.createElement('ul');
    liste.className = 'anleitung-liste';
    for (const a of anleitungen) {
      const li = document.createElement('li');
      const name = document.createElement('b');
      name.textContent = a.name;
      li.append(name);
      if (a.wann) li.append(document.createTextNode(' — ' + a.wann));
      liste.append(li);
    }
    anl.append(liste);
  }

  if (anleitungenOrdner) {
    const pfad = document.createElement('div');
    pfad.className = 'stil-pfad';
    pfad.textContent = anleitungenOrdner;
    pfad.title = 'Klicken zum Kopieren';
    pfad.addEventListener('click', async () => {
      await navigator.clipboard.writeText(anleitungenOrdner);
      const alt = pfad.textContent;
      pfad.textContent = 'Pfad kopiert';
      setTimeout(() => { pfad.textContent = alt; }, 1600);
    });
    anl.append(pfad);
  }

  kasten.append(anl);

  ziel.append(kasten);
}
