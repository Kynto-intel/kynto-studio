// Detailansicht eines Bildes: Prompt, Herkunft, Favorit und Freigabe.

import { api, dateiUrl } from './api.js';
import * as vorlagen from './vorlagen.js';

let beiAenderung = () => {};
let referenzSetzen = () => {};
let textEditorOeffnen = () => {};
const el = (id) => document.getElementById(id);

export function setzeAenderungsZiel(fn) { beiAenderung = fn; }
export function setzeReferenzZiel(fn) { referenzSetzen = fn; }
export function setzeTextZiel(fn) { textEditorOeffnen = fn; }

let laufLaden = null;
export function setzeLaufZiel(fn) { laufLaden = fn; }

/**
 * Liegt die Datei noch da?
 *
 * Fuer das Referenzbild eines alten Laufs. Es kann laengst geloescht sein,
 * und dann soll der Komponist es nicht stillschweigend uebernehmen - der
 * Lauf wuerde erst beim Klick scheitern, und zwar kostenpflichtig.
 */
async function gibtEs(pfad) {
  if (!pfad) return false;
  try {
    const a = await fetch(dateiUrl(pfad), { method: 'HEAD' });
    return a.ok;
  } catch {
    return false;
  }
}

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
  reihe(dl, 'Clip', eintrag.dauer ? `${eintrag.dauer} s · ${eintrag.aufloesung || ''}`.trim() : '');
  reihe(dl, 'Verhältnis', eintrag.verhaeltnis || '');
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
      titel: 'Nur den Text — Modell, Format und Referenz bleiben, wie sie eingestellt sind',
      gesperrt: !eintrag.motiv,
      beiKlick: () => {
        el('motiv').value = eintrag.motiv;
        schliesse();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    }),

    // Der ganze Lauf zurueck in den Komponisten - Motiv, Modell, Format,
    // Stil-Haken, Referenz, bei Clips Dauer und Aufloesung. "Motiv
    // uebernehmen" daneben nimmt nur den Text; das hier ist der Unterschied
    // zwischen "aehnlicher Text" und "derselbe Lauf, eine Sache anders".
    //
    // Erzeugt wird dabei NICHTS. Es fuellt nur Felder, wie eine Vorlage
    // auch - sonst waere es ein zweiter Weg zum Erzeugen.
    knopf('Nochmal, aber …', {
      neben: true,
      gesperrt: !eintrag.motiv || !laufLaden,
      titel: eintrag.motiv
        ? 'Alles aus diesem Lauf zurück in den Komponisten. Erzeugt nichts — du klickst selbst.'
        : 'Ohne Motiv im Sidecar lässt sich der Lauf nicht wiederherstellen',
      beiKlick: async (e) => {
        const b = e.currentTarget;
        b.disabled = true;
        const referenz = eintrag.referenzBild || null;
        laufLaden({
          name: eintrag.name,
          art: eintrag.art === 'video' ? 'video' : 'bild',
          motiv: eintrag.motiv,
          modell: eintrag.modell || null,
          formatId: eintrag.format || null,
          // Bewusst 1, nicht die Anzahl von damals: das Sidecar haelt sie
          // gar nicht, und Regel 6 sagt ohnehin, dass die Anzahl bei 1
          // anfaengt.
          anzahl: 1,
          klein: false,
          mitStil: eintrag.mitStil !== false,
          dauer: eintrag.dauer || null,
          aufloesung: eintrag.aufloesung || null,
          referenz,
          referenzDa: await gibtEs(referenz),
        });
        schliesse();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    }),

    // Das Sidecar weiss schon alles: Motiv, Modell, Format, Stil-Haken und
    // Referenz. Damit wird jedes Bild, das laengst da ist, nachtraeglich
    // zur Vorlage - man muss es nicht erst neu erzeugen.
    knopf('Als Vorlage', {
      neben: true,
      gesperrt: !eintrag.motiv,
      titel: eintrag.motiv
        ? 'Diesen Lauf unter eigenem Namen aufbewahren'
        : 'Ohne Motiv im Sidecar lässt sich nichts wiederholen',
      beiKlick: (e) => {
        e.currentTarget.replaceWith(vorlagen.benennung(
          (eintrag.motiv || '').replace(/\s+/g, ' ').trim().split(' ').slice(0, 5).join(' '),
          async (name) => {
            const v = await vorlagen.sichere({
              name,
              art: eintrag.art === 'video' ? 'video' : 'bild',
              motiv: eintrag.motiv,
              modell: eintrag.modell || null,
              formatId: eintrag.format || null,
              anzahl: 1,
              klein: false,
              mitStil: eintrag.mitStil !== false,
              dauer: eintrag.dauer || null,
              aufloesung: eintrag.aufloesung || null,
              referenz: eintrag.referenzBild || null,
              // Das Bild selbst ist die Miniatur - genau das kommt heraus.
              miniatur: eintrag.pfad,
            });
            return `„${v.name}“ liegt in den Vorlagen.`;
          },
        ));
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
