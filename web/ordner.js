// Ordner-Einstellungen.
//
// Legt fest, wo Bilder herkommen und wohin sie gespeichert werden. Ohne
// diesen Dialog muesste man studio.config.json von Hand bearbeiten - und
// niemand hat dieselbe Ordnerstruktur wie der naechste.
//
// Aenderungen greifen sofort: der Server uebernimmt sie ohne Neustart.

import { api } from './api.js';

const el = (id) => document.getElementById(id);

let stand = null;          // aktuelle Fassung im Dialog
let beiGespeichert = () => {};

export function setzeSpeicherZiel(fn) { beiGespeichert = fn; }

/** Aus einem Namen eine brauchbare Kennung machen. */
function kennung(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[äöüß]/g, (z) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[z]))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
}

function zeile(ordner, nummer) {
  const reihe = document.createElement('div');
  reihe.className = 'ord-zeile';

  const name = document.createElement('input');
  name.type = 'text';
  name.value = ordner.label;
  name.placeholder = 'Anzeigename';
  name.className = 'ord-name';
  name.addEventListener('input', () => {
    ordner.label = name.value;
    // Kennung nur automatisch nachziehen, solange der Ordner neu ist
    if (ordner.neu) ordner.id = kennung(name.value) || `ordner-${nummer}`;
  });

  const pfad = document.createElement('input');
  pfad.type = 'text';
  pfad.value = ordner.unterordner;
  pfad.placeholder = 'Unterordner, z. B. Social Media\\Feed';
  pfad.className = 'ord-pfad';
  pfad.addEventListener('input', () => { ordner.unterordner = pfad.value; });

  const schreiben = document.createElement('label');
  schreiben.className = 'ord-haken';
  const haken = document.createElement('input');
  haken.type = 'checkbox';
  haken.checked = Boolean(ordner.schreibbar);
  haken.addEventListener('change', () => {
    ordner.schreibbar = haken.checked;
    ordner.hinweis = haken.checked ? 'Studio-Ausgabe' : 'nur anzeigen';
  });
  const beschriftung = document.createElement('span');
  beschriftung.textContent = 'speichern';
  beschriftung.title = 'Angehakt: das Studio darf hier Bilder ablegen. '
    + 'Nicht angehakt: der Ordner wird nur angezeigt.';
  schreiben.append(haken, beschriftung);

  const weg = document.createElement('button');
  weg.type = 'button';
  weg.className = 'ord-weg';
  weg.textContent = '×';
  weg.title = 'Ordner aus der Liste nehmen — die Dateien bleiben auf der Platte';
  weg.addEventListener('click', () => {
    stand.ordner = stand.ordner.filter((o) => o !== ordner);
    zeichne();
  });

  reihe.append(name, pfad, schreiben, weg);
  return reihe;
}

function zeichne() {
  el('ordWurzel').value = stand.wurzel;

  const liste = el('ordListe');
  liste.replaceChildren();
  stand.ordner.forEach((o, i) => liste.append(zeile(o, i + 1)));

  el('ordHinweis').textContent = '';
}

export async function oeffne() {
  try {
    stand = await api.konfig();
    zeichne();
    el('ordner').hidden = false;
  } catch (fehler) {
    el('ordHinweis').textContent = fehler.message;
  }
}

export function schliesse() {
  el('ordner').hidden = true;
}

async function speichern() {
  const knopf = el('ordSpeichern');
  knopf.disabled = true;
  knopf.textContent = 'Speichert …';
  el('ordHinweis').textContent = '';
  try {
    await api.konfigSpeichern({
      wurzel: el('ordWurzel').value.trim(),
      ordner: stand.ordner,
    });
    el('ordHinweis').textContent = 'Gespeichert.';
    await beiGespeichert();
    setTimeout(schliesse, 600);
  } catch (fehler) {
    el('ordHinweis').textContent = fehler.message;
  } finally {
    knopf.disabled = false;
    knopf.textContent = 'Speichern';
  }
}

export function verdrahte() {
  el('ordnerKnopf').addEventListener('click', oeffne);
  el('ordSchliessen').addEventListener('click', schliesse);
  el('ordSpeichern').addEventListener('click', speichern);

  el('ordNeu').addEventListener('click', () => {
    stand.ordner.push({
      id: `ordner-${stand.ordner.length + 1}`,
      label: '',
      hinweis: 'Studio-Ausgabe',
      schreibbar: true,
      unterordner: '',
      neu: true,
    });
    zeichne();
    el('ordListe').lastElementChild?.querySelector('input')?.focus();
  });

  el('ordner').addEventListener('click', (e) => {
    if (e.target === el('ordner')) schliesse();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el('ordner').hidden) schliesse();
  });
}
