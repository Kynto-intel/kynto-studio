// Detailansicht eines Bildes: Prompt, Herkunft, Favorit und Freigabe.

import { api, dateiUrl } from './api.js';

let beiAenderung = () => {};
let referenzSetzen = () => {};
let textEditorOeffnen = () => {};
const el = (id) => document.getElementById(id);

export function setzeAenderungsZiel(fn) { beiAenderung = fn; }
export function setzeReferenzZiel(fn) { referenzSetzen = fn; }
export function setzeTextZiel(fn) { textEditorOeffnen = fn; }

function reihe(dl, bezeichnung, wert) {
  if (!wert) return;
  const dt = document.createElement('dt');
  dt.textContent = bezeichnung;
  const dd = document.createElement('dd');
  dd.textContent = wert;
  dl.append(dt, dd);
}

function absatz(daten, ueberschrift, inhalt) {
  if (!inhalt) return;
  const kopf = document.createElement('dt');
  kopf.textContent = ueberschrift;
  const text = document.createElement('div');
  text.className = 'prompt';
  text.textContent = inhalt;
  daten.append(kopf, text);
}

function knopf(text, { neben = false, gesperrt = false, titel = '', beiKlick }) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  if (neben) b.className = 'neben';
  b.disabled = gesperrt;
  if (titel) b.title = titel;
  b.addEventListener('click', beiKlick);
  return b;
}

export function zeige(eintrag) {
  const kasten = el('detail');
  const bildFeld = el('detailBild');
  const daten = el('detailDaten');

  bildFeld.replaceChildren();
  if (eintrag.art === 'video') {
    const v = document.createElement('video');
    v.src = dateiUrl(eintrag.pfad);
    v.controls = true;
    bildFeld.append(v);
  } else {
    // Klick aufs grosse Bild oeffnet den Text-Editor.
    const b = document.createElement('img');
    b.src = dateiUrl(eintrag.pfad);
    b.alt = eintrag.motiv || eintrag.name;
    b.className = 'anklickbar';
    b.title = 'Klicken, um Text aufs Bild zu setzen';
    b.addEventListener('click', () => {
      schliesse();
      textEditorOeffnen(eintrag);
    });
    bildFeld.append(b);
  }

  daten.replaceChildren();

  const titel = document.createElement('h3');
  titel.textContent = eintrag.name;
  daten.append(titel);

  const erstellt = eintrag.erstellt || eintrag.geaendert;
  const preis = eintrag.kosten?.dollar;

  const dl = document.createElement('dl');
  reihe(dl, 'Erstellt', erstellt ? new Date(erstellt).toLocaleString('de-DE') : '');
  reihe(dl, 'Modell', eintrag.modell);
  reihe(dl, 'Format', eintrag.format);
  reihe(dl, 'Stil-Block', eintrag.mitStil === false ? 'aus' : (eintrag.stilBlock ? 'an' : ''));
  reihe(dl, 'Kosten', preis ? `${preis.toFixed(4)} USD` : '');
  reihe(dl, 'Referenz', eintrag.referenzBild || '');
  reihe(dl, 'Ordner', eintrag.ordner);
  daten.append(dl);

  absatz(daten, 'Motiv', eintrag.motiv);
  absatz(daten, 'Vollständiger Prompt', eintrag.prompt);
  absatz(daten, 'Caption', eintrag.caption);

  const knoepfe = document.createElement('div');
  knoepfe.className = 'detail-knoepfe';

  const istBild = eintrag.art === 'bild';

  knoepfe.append(
    knopf('Text aufs Bild', {
      gesperrt: !istBild,
      beiKlick: () => { schliesse(); textEditorOeffnen(eintrag); },
    }),

    knopf('Als Referenz', {
      gesperrt: !istBild,
      titel: istBild
        ? 'Nächste Erzeugung orientiert sich an diesem Bild'
        : 'Videos gehen nicht als Referenz',
      beiKlick: () => {
        referenzSetzen(eintrag);
        schliesse();
        el('motiv').focus();
      },
    }),

    knopf(eintrag.favorit ? 'Favorit entfernen' : 'Als Favorit', {
      beiKlick: async () => {
        await api.sidecar(eintrag.pfad, { favorit: !eintrag.favorit });
        eintrag.favorit = !eintrag.favorit;
        zeige(eintrag);
        beiAenderung();
      },
    }),

    knopf(eintrag.freigegeben ? 'Freigabe zurücknehmen' : 'Freigeben', {
      beiKlick: async () => {
        await api.sidecar(eintrag.pfad, { freigegeben: !eintrag.freigegeben });
        eintrag.freigegeben = !eintrag.freigegeben;
        zeige(eintrag);
        beiAenderung();
      },
    }),
  );

  const kopieren = knopf('Motiv kopieren', {
    neben: true,
    gesperrt: !eintrag.motiv,
    beiKlick: async () => {
      await navigator.clipboard.writeText(eintrag.motiv || '');
      kopieren.textContent = 'Kopiert';
      setTimeout(() => { kopieren.textContent = 'Motiv kopieren'; }, 1500);
    },
  });

  knoepfe.append(
    kopieren,
    knopf('Motiv übernehmen', {
      neben: true,
      gesperrt: !eintrag.motiv,
      beiKlick: () => {
        el('motiv').value = eintrag.motiv;
        schliesse();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    }),
  );

  daten.append(knoepfe);
  kasten.hidden = false;
}

export function schliesse() {
  el('detail').hidden = true;
}

export function verdrahte() {
  el('detailSchliessen').addEventListener('click', schliesse);
  el('detail').addEventListener('click', (e) => {
    if (e.target === el('detail')) schliesse();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') schliesse();
  });
}
