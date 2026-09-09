// Einstellungen: die Tagesgrenzen und die Regie, auf zwei Reitern.
//
// Eine Ansicht im Raster, wie die Vorlagen - kein Fenster. Zeichnet sich in
// dasselbe Raster und meldet Aenderungen sofort an den Server; es gibt
// keinen Speichern-Knopf fuer alles auf einmal, weil vier Felder keinen
// brauchen und ein vergessener Klick sonst die Bremse still ausser Kraft
// liesse.
//
// Warum ein Punkt in der Seitenleiste, aber zwei Reiter darin: beides sind
// Dinge, die man selten anfasst - zwei Eintraege unten waren einer zu viel.
// Auf einer Seite untereinander wurde es dann zu lang, weil das Regie-Feld
// allein einen Bildschirm fuellt. Also ein Punkt, zwei Reiter. Modell,
// Format und Ordner bleiben ganz draussen: die aendert man im Alltag, und
// die haben ihre eigenen Plaetze.
//
// Die Regie zeichnet ihr eigenes Modul (regie.js). Sie haengt hier nur im
// Raster mit drin, ihre Fachlogik bleibt drueben.

import { api } from './api.js';
import * as merker from './merker.js';
import * as regie from './regie.js';
import * as verlauf from './verlauf-fenster.js';

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
  // Die Regie holt sich ihren Text selbst - sie kann sich auch im
  // Texteditor geaendert haben, waehrend die App offen war.
  await regie.lade();
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

/** Der Block mit den vier Grenzen. Ohne Ueberschrift - die steht im Reiter. */
function zeichneGrenzen(ziel) {
  const kasten = document.createElement('div');
  kasten.className = 'einstellungen';

  const erklaerung = document.createElement('p');
  erklaerung.className = 'gr-erklaerung';
  erklaerung.textContent = 'Ist eine Grenze erreicht, wird nichts mehr erzeugt — '
    + 'egal ob der Klick von dir, vom Assistenten oder von einem Skript über die '
    + 'API kommt. Feld leer lassen heißt: keine Bremse. Der Tag beginnt um '
    + 'Mitternacht nach der Uhr dieses Rechners neu.';

  kasten.append(erklaerung);
  for (const feld of FELDER) kasten.append(zeile(feld));

  const ehrlich = document.createElement('p');
  ehrlich.className = 'gr-erklaerung gr-klein';
  ehrlich.textContent = 'Geprüft wird gegen das, was schon abgerechnet ist. '
    + 'Ein einzelner Lauf kann die Grenze deshalb noch überschreiten — was er '
    + 'kostet, sagt OpenRouter erst danach, und bei Video vorher gar nicht. '
    + 'Die Bremse verhindert den nächsten Lauf, nicht den laufenden.';
  kasten.append(ehrlich);

  // Was bisher ausgegeben wurde. Steht unter den Grenzen, weil beides
  // dieselbe Frage beantwortet - nur einmal nach vorn und einmal zurueck.
  const gesch = document.createElement('div');
  gesch.className = 'kosten-geschichte';
  gesch.textContent = 'Verbrauch wird geladen …';
  kasten.append(gesch);
  zeichneGeschichte(gesch);

  ziel.append(kasten);
}

/** Tabelle je Monat. Laedt nach, damit der Reiter sofort steht. */
async function zeichneGeschichte(ziel) {
  let g;
  try {
    g = await api.kostenGeschichte(6);
  } catch {
    ziel.textContent = 'Verbrauch nicht lesbar.';
    return;
  }
  ziel.replaceChildren();
  if (!g.proMonat.length) {
    ziel.textContent = 'Noch nichts verbraucht.';
    return;
  }

  const h = document.createElement('h3');
  h.textContent = 'Bisher ausgegeben';
  ziel.append(h);

  const tab = document.createElement('table');
  tab.className = 'kosten-tabelle';
  const kopf = document.createElement('tr');
  for (const t of ['Monat', 'Bilder', 'Clips', 'Bild', 'Video', 'Assistent', 'Summe']) {
    const th = document.createElement('th');
    th.textContent = t;
    kopf.append(th);
  }
  tab.append(kopf);

  const dollar = (n) => (n ? `${n.toFixed(2)} $` : '—');
  let offen = 0;
  for (const m of g.proMonat) {
    const tr = document.createElement('tr');
    const felder = [
      m.monat, String(m.bilder || '—'), String(m.clips || '—'),
      dollar(m.bildDollar), dollar(m.videoDollar), dollar(m.chatDollar), dollar(m.dollar),
    ];
    felder.forEach((wert, i) => {
      const td = document.createElement('td');
      td.textContent = wert;
      // Alles ausser dem Monat ist eine Zahl und gehoert nach rechts - die
      // Ueberschriften stehen dort schon. Bis 9.9. galt das erst ab Spalte
      // 3, dadurch standen "Bilder" und "Clips" unter ihrer eigenen
      // Ueberschrift versetzt.
      if (i >= 1) td.className = 'zahl';
      tr.append(td);
    });
    // Geld, das nur als Tagessumme festgehalten wurde, gehoert in keine
    // Spalte. Die Zeile wird angezeichnet statt die Zahlen zu schoenen.
    //
    // Aber erst ab einem Cent: der September haelt 0,007 $ ohne Aufteilung,
    // 0,16 % des Monats. Faerbte man auch das ein, waere die ganze Tabelle
    // orange und die Markierung saegte sich selbst ab. Gezaehlt wird der
    // Betrag trotzdem - er steht in der Summe darunter.
    if (m.ohneAufteilung) {
      offen += m.ohneAufteilung;
    }
    if (m.ohneAufteilung >= 0.01) {
      tr.title = `${m.ohneAufteilung.toFixed(2)} $ davon wurden nur als Tagessumme `
        + 'festgehalten und lassen sich keiner Spalte zuordnen.';
      tr.classList.add('unvollstaendig');
    }
    tab.append(tr);
  }
  ziel.append(tab);

  const fuss = document.createElement('p');
  fuss.className = 'gr-erklaerung gr-klein';
  fuss.textContent = `Insgesamt ${g.gesamt.toFixed(2)} $ seit ${g.seit}.`
    + (offen
      ? ` Davon ${offen.toFixed(2)} $ ohne Aufteilung — vor dem 2.9.2026 hielt die `
        + 'App nur eine Tagessumme fest. Die Zeilen sind angezeichnet.'
      : '');
  ziel.append(fuss);
}

/**
 * Die beiden Reiter.
 *
 * `zeichne` gehoert zum Modul, nicht zur Zeile - deshalb steht die Regie
 * hier mit ihrer eigenen Funktion drin und nicht als Kopie ihres Inhalts.
 */
const REITER = [
  { id: 'grenzen', label: 'Tagesgrenzen', zeichne: zeichneGrenzen },
  { id: 'regie', label: 'Regie', zeichne: (ziel) => regie.zeichne(ziel) },
  { id: 'verlauf', label: 'Verlauf', zeichne: (ziel) => verlauf.zeichneIn(ziel) },
];

// Ueber den Reload gemerkt: wer an der Regie schreibt, laedt zwischendurch
// neu und will nicht jedes Mal wieder umschalten. Ein Browser-Wert, kein
// Serverwert - er steuert nur, was dieses Fenster gerade zeigt.
let aktiv = merker.hole('einstellungenReiter', 'grenzen',
  (w) => REITER.some((r) => r.id === w));

export function zeichne(ziel) {
  const leiste = document.createElement('nav');
  leiste.className = 'art-reiter einst-reiter';
  leiste.setAttribute('aria-label', 'Bereich der Einstellungen');

  const inhalt = document.createElement('div');
  inhalt.className = 'einst-inhalt';

  const male = () => {
    inhalt.replaceChildren();
    REITER.find((r) => r.id === aktiv).zeichne(inhalt);
    for (const knopf of leiste.children) {
      knopf.setAttribute('aria-current', String(knopf.dataset.id === aktiv));
    }
  };

  for (const r of REITER) {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'reiter';
    knopf.dataset.id = r.id;
    knopf.textContent = r.label;
    knopf.addEventListener('click', () => {
      if (aktiv === r.id) return;
      aktiv = r.id;
      merker.merke('einstellungenReiter', aktiv);
      male();
    });
    leiste.append(knopf);
  }

  ziel.append(leiste, inhalt);
  male();
}
