// Einstellungen: die Tagesgrenzen.
//
// Eine Ansicht im Raster, wie die Vorlagen - kein Fenster. Zeichnet sich in
// dasselbe Raster und meldet Aenderungen sofort an den Server; es gibt
// keinen Speichern-Knopf fuer alles auf einmal, weil vier Felder keinen
// brauchen und ein vergessener Klick sonst die Bremse still ausser Kraft
// liesse.
//
// Die Grenzen sind das Einzige, was hier steht. Modell, Format und Ordner
// haben ihre eigenen Plaetze - eine Sammelseite fuer alles waere schnell
// die Seite, auf der man nichts mehr findet.

import { api } from './api.js';

let grenzen = { gesamt: null, bild: null, video: null, chat: null };
let verbrauch = null;
let beiAenderung = () => {};

export function setzeAenderungsZiel(fn) { beiAenderung = fn; }

export function setzeDaten({ grenzen: g, verbrauch: v } = {}) {
  if (g) grenzen = g;
  if (v) verbrauch = v;
}

/** Frisch holen - der Verbrauch aendert sich mit jedem Lauf. */
export async function lade() {
  try {
    const a = await api.grenzen();
    grenzen = a.grenzen;
    verbrauch = a.verbrauch;
  } catch {
    // Dann steht der letzte bekannte Stand da. Eine Fehlermeldung an dieser
    // Stelle haette niemand angefordert.
  }
}

function geld(betrag) {
  const n = Number(betrag) || 0;
  const komma = (z) => z.toFixed(2).replace('.', ',');
  return n < 0.01 && n > 0 ? `${komma(n * 100)} ¢` : `${komma(n)} $`;
}

/** Die vier Grenzen, in der Reihenfolge, in der man sie denkt. */
const FELDER = [
  {
    id: 'gesamt',
    label: 'Alles zusammen',
    was: 'Bilder, Clips und Assistent in einer Summe. Die härteste Bremse — '
      + 'ist sie erreicht, läuft gar nichts mehr.',
    verbraucht: (v) => v.dollar,
  },
  {
    id: 'bild',
    label: 'Bilder',
    was: 'Nur das Erzeugen von Bildern.',
    verbraucht: (v) => v.bildDollar,
  },
  {
    id: 'video',
    label: 'Video',
    was: 'Nur Clips. Ein Clip kostet rund zwanzigmal so viel wie ein Bild — '
      + 'hier lohnt sich eine eigene Grenze am meisten.',
    verbraucht: (v) => v.videoDollar,
  },
  {
    id: 'chat',
    label: 'Assistent',
    was: 'Was der Assistent an Textmarken verbraucht. Ist die Grenze erreicht, '
      + 'antwortet er nicht mehr — vorschlagen kann er dann ohnehin nichts.',
    verbraucht: (v) => v.chatDollar,
  },
];

/** Ein Balken, der zeigt, wie weit der Tag aufgebraucht ist. */
function balken(anteil) {
  const aussen = document.createElement('div');
  aussen.className = 'gr-balken';
  const innen = document.createElement('i');
  innen.style.width = `${Math.min(100, Math.round(anteil * 100))}%`;
  if (anteil >= 1) innen.classList.add('voll');
  else if (anteil >= 0.8) innen.classList.add('knapp');
  aussen.append(innen);
  return aussen;
}

function zeile(feld) {
  const reihe = document.createElement('div');
  reihe.className = 'gr-zeile';

  const kopf = document.createElement('div');
  kopf.className = 'gr-kopf';

  const name = document.createElement('strong');
  name.textContent = feld.label;

  const eingabe = document.createElement('input');
  eingabe.type = 'number';
  eingabe.min = '0';
  eingabe.step = '0.5';
  eingabe.placeholder = 'kein Limit';
  eingabe.value = grenzen[feld.id] ?? '';
  eingabe.setAttribute('aria-label', `Tagesgrenze für ${feld.label} in Dollar`);

  const waehrung = document.createElement('span');
  waehrung.className = 'gr-waehrung';
  waehrung.textContent = '$ / Tag';

  const meldung = document.createElement('em');
  meldung.className = 'gr-meldung';

  const speichern = async () => {
    const roh = eingabe.value.trim();
    const wert = roh === '' ? null : Number(roh.replace(',', '.'));
    if (wert !== null && (!Number.isFinite(wert) || wert < 0)) {
      meldung.textContent = 'Bitte eine Zahl, oder leer für kein Limit.';
      return;
    }
    if ((grenzen[feld.id] ?? null) === (wert && wert > 0 ? wert : null)) return;
    meldung.textContent = '';
    try {
      const a = await api.grenzenSpeichern({ [feld.id]: wert });
      grenzen = a.grenzen;
      verbrauch = a.verbrauch;
      meldung.textContent = 'Gespeichert.';
      meldung.classList.add('gut');
      setTimeout(() => { meldung.textContent = ''; meldung.classList.remove('gut'); }, 1800);
      await beiAenderung();
    } catch (fehler) {
      meldung.textContent = fehler.message;
    }
  };

  // Beim Verlassen des Feldes und auf Eingabetaste. Kein Sammel-Knopf:
  // vier Felder brauchen keinen, und ein vergessener Klick liesse die
  // Bremse still unwirksam.
  eingabe.addEventListener('blur', speichern);
  eingabe.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); eingabe.blur(); }
  });

  kopf.append(name, eingabe, waehrung);

  const was = document.createElement('p');
  was.className = 'gr-was';
  was.textContent = feld.was;

  reihe.append(kopf, was);

  // Stand des Tages - aber nur, wenn eine Grenze gesetzt ist. Ohne Grenze
  // waere ein Balken ohne Ende, und der sagt nichts.
  if (verbrauch) {
    const benutzt = feld.verbraucht(verbrauch) || 0;
    const grenze = grenzen[feld.id];
    const stand = document.createElement('div');
    stand.className = 'gr-stand';
    if (grenze) {
      stand.textContent = `heute ${geld(benutzt)} von ${geld(grenze)}`;
      reihe.append(balken(benutzt / grenze), stand);
      if (benutzt >= grenze) {
        stand.classList.add('erreicht');
        stand.textContent += ' — erreicht, hier läuft nichts mehr';
      }
    } else {
      stand.textContent = `heute ${geld(benutzt)} · keine Grenze`;
      reihe.append(stand);
    }
  }

  reihe.append(meldung);
  return reihe;
}

export function zeichne(ziel) {
  const kasten = document.createElement('div');
  kasten.className = 'einstellungen';

  const titel = document.createElement('h3');
  titel.textContent = 'Tagesgrenzen';

  const erklaerung = document.createElement('p');
  erklaerung.className = 'gr-erklaerung';
  erklaerung.textContent = 'Ist eine Grenze erreicht, wird nichts mehr erzeugt — '
    + 'egal ob der Klick von dir, vom Assistenten oder von einem Skript über die '
    + 'API kommt. Feld leer lassen heißt: keine Bremse. Der Tag beginnt um '
    + 'Mitternacht nach der Uhr dieses Rechners neu.';

  kasten.append(titel, erklaerung);
  for (const feld of FELDER) kasten.append(zeile(feld));

  const ehrlich = document.createElement('p');
  ehrlich.className = 'gr-erklaerung gr-klein';
  ehrlich.textContent = 'Geprüft wird gegen das, was schon abgerechnet ist. '
    + 'Ein einzelner Lauf kann die Grenze deshalb noch überschreiten — was er '
    + 'kostet, sagt OpenRouter erst danach, und bei Video vorher gar nicht. '
    + 'Die Bremse verhindert den nächsten Lauf, nicht den laufenden.';
  kasten.append(ehrlich);

  ziel.append(kasten);
}
