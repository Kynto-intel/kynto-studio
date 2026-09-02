// Der Komponist: Auswahl, Kostenschaetzung, Ausloesen.
//
// Grundregel: Es wird NIE automatisch gerendert. Die Schaetzung laeuft
// staendig mit, erzeugt aber nichts - erst der Klick kostet.

import { api } from './api.js';
import { baueAuswahl } from './auswahl.js';
import { hole, merke } from './merker.js';
import * as referenz from './referenz.js';

let beiFertig = () => {};
let verbrauchZeigen = () => {};

const el = (id) => document.getElementById(id);

/** Aktueller Stand der Regler. */
const regler = { art: null, modell: null, format: null, anzahl: null };

/** Modell-Infos nach id, um Referenz-Faehigkeit pruefen zu koennen. */
const modellInfo = new Map();

/** Kataloge und Live-Preise, getrennt nach Gattung. */
const katalog = { bild: [], video: [] };
let preise = { bild: {}, video: {} };
let gemessen = {};
let anbieterStand = {};

/** Bild oder Video? Steuert Modell-Liste, Knopf und Aufruf. */
let art = hole('art', 'bild', (w) => w === 'bild' || w === 'video');

/**
 * Modell je Gattung, wie es der Server kennt.
 *
 * Getrennt, weil ein Bildmodell beim Umschalten auf Video nichts taugt und
 * umgekehrt - wer zurueckschaltet, will sein voriges Modell wiederhaben.
 *
 * Wichtig: Das liegt NICHT im Browser, sondern in studio.config.json. Nur
 * so sehen Chat und ein Programm von aussen dieselbe Wahl.
 * Die Regel dahinter: **das Modell waehlt der Mensch, nicht die KI.**
 */
const gemerkteModelle = { bild: null, video: null };

/** Einstellung an den Server melden. Fehler hier duerfen nichts blockieren. */
function merkeAmServer(feld, wert) {
  api.standardSpeichern({ [feld]: wert }).catch(() => {});
}

export function setzeCallbacks({ fertig, verbrauch }) {
  beiFertig = fertig || beiFertig;
  verbrauchZeigen = verbrauch || verbrauchZeigen;
}

function geld(betrag) {
  if (!betrag) return '0,00 $';
  return betrag < 0.01 ? `${(betrag * 100).toFixed(2)} ¢` : `${betrag.toFixed(3)} $`;
}

/**
 * Preis eines Modells.
 * Gemessene Werte aus echten Laeufen schlagen jede Schaetzung - deshalb
 * kommen sie zuerst und werden als "gemessen" gekennzeichnet.
 */
function preisText(id) {
  const echt = gemessen[id]?.schnitt;
  if (echt) return `${geld(echt)} gemessen`;
  const schaetzung = preise[art]?.[id]?.schaetzungProBild;
  if (schaetzung) return `ca. ${geld(schaetzung)}`;
  return null;
}

/** Baut die Modell-Liste fuer die aktuelle Gattung neu auf. */
function baueModellListe() {
  const liste = katalog[art];
  modellInfo.clear();
  for (const m of liste) modellInfo.set(m.id, m);

  // Reihenfolge: was gerade eingestellt ist, sonst das zuletzt gemerkte,
  // sonst das erste der Liste. Beides wird gegen den Katalog geprueft -
  // Modelle verschwinden dort, und eine tote id waere eine leere Auswahl.
  const vorher = regler.modell?.wert;
  const kandidaten = [vorher, gemerkteModelle[art]];
  const behalten = kandidaten.find((id) => id && liste.some((m) => m.id === id))
    || liste[0]?.id;

  regler.modell = baueAuswahl(el('modellWahl'), {
    wert: behalten,
    eintraege: liste.map((m) => {
      const preis = preisText(m.id);
      const teile = [];
      if (!anbieterStand[m.anbieter]) teile.push('Schlüssel fehlt');
      else if (preis) teile.push(preis);
      else if (m.anbieter === 'openrouter') teile.push('Preis erst nach dem ersten Lauf');
      if (m.notiz) teile.push(m.notiz);
      return {
        wert: m.id,
        text: m.name,
        notiz: teile.join(' · '),
        // Kein Bild/Video-Praefix: der Art-Umschalter sagt das schon.
        gruppe: m.gruppe,
        gesperrt: !anbieterStand[m.anbieter],
      };
    }),
    beiWahl: (neu) => {
      gemerkteModelle[art] = neu;
      merkeAmServer(art === 'video' ? 'modellVideo' : 'modellBild', neu);
      aktualisiereSchaetzung();
    },
  });
}

export function baueRegler({ formate, modelleBild, modelleVideo, anbieter, preise: p, gemessen: g, standard = {} }) {
  gemerkteModelle.bild = standard.modellBild || null;
  gemerkteModelle.video = standard.modellVideo || null;
  katalog.bild = modelleBild;
  katalog.video = modelleVideo;
  preise = p || preise;
  gemessen = g || {};
  anbieterStand = anbieter;

  regler.art = baueAuswahl(el('artWahl'), {
    wert: art,
    eintraege: [
      { wert: 'bild', text: 'Bild', notiz: `${modelleBild.length} Modelle` },
      { wert: 'video', text: 'Video', notiz: `${modelleVideo.length} Modelle · ungeprüft` },
    ],
    beiWahl: (neu) => {
      art = neu;
      merke('art', neu);
      baueModellListe();
      zeigeGattung();
      aktualisiereSchaetzung();
    },
  });

  baueModellListe();
  zeigeGattung();

  regler.format = baueAuswahl(el('formatWahl'), {
    wert: formate.some((f) => f.id === standard.formatId) ? standard.formatId : 'feed',
    eintraege: formate.map((f) => ({
      wert: f.id,
      text: f.label,
      notiz: f.zielW ? `${f.zielW}×${f.zielH}` : 'unbeschnitten',
    })),
    beiWahl: (neu) => {
      merkeAmServer('formatId', neu);
      aktualisiereSchaetzung();
    },
  });

  // Als Einziges NICHT gemerkt: die Anzahl steht bei jedem Laden wieder
  // auf 1. Ein vergessenes "6x" von vorgestern waere beim naechsten Klick
  // das Sechsfache an echtem Geld - das ist der eine Regler, bei dem ein
  // zusaetzlicher Klick besser ist als ein Gedaechtnis.
  regler.anzahl = baueAuswahl(el('anzahlWahl'), {
    wert: '1',
    eintraege: ['1', '2', '3', '4', '6', '8'].map((n) => ({
      wert: n,
      text: `${n}×`,
      notiz: n === '1' ? 'Standard' : null,
    })),
    beiWahl: aktualisiereSchaetzung,
  });
}

/** Knopf, Platzhalter und Anzahl an die Gattung anpassen. */
function zeigeGattung() {
  const video = art === 'video';
  el('erzeugenKnopf').textContent = video ? 'Animieren' : 'Erzeugen';
  el('motiv').placeholder = video
    ? 'Bewegung beschreiben, englisch — Standbild als Referenz wählen'
    : 'Motiv beschreiben, englisch …';
  el('anzahlWahl').hidden = video; // ein Clip pro Lauf, nie im Stapel
}

function eingaben() {
  return {
    motiv: el('motiv').value,
    modell: regler.modell.wert,
    formatId: regler.format.wert,
    anzahl: Number(regler.anzahl.wert) || 1,
    klein: el('klein').checked,
    mitStil: el('mitStil').checked,
    name: el('dateiname').value,
    // Leer heisst ohne Referenz, gesetzt heisst mit. Kein zweiter Weg.
    referenz: referenz.pfad(),
  };
}

function hinweis(text, gut = false) {
  const h = el('hinweis');
  if (!text) { h.hidden = true; return; }
  h.hidden = false;
  h.textContent = text;
  h.classList.toggle('gut', gut);
}

export async function aktualisiereSchaetzung() {
  const feld = el('schaetzung');
  const { modell, formatId, anzahl, klein } = eingaben();

  // Referenz gesetzt, aber Modell kann keine? Ehrlich sagen statt still
  // ignorieren.
  const info = modellInfo.get(modell);
  if (referenz.pfad() && info && !info.kannReferenz) {
    feld.textContent = `${info.name} nimmt keine Referenzbilder — anderes Modell wählen`;
    feld.classList.add('warnung');
    return;
  }

  // Video: OpenRouter nennt vorab keinen Preis. Nichts behaupten.
  if (art === 'video') {
    feld.textContent = referenz.pfad()
      ? 'Clip aus dem gewählten Standbild · Preis erst nach dem Lauf bekannt'
      : 'Text-zu-Video · Preis erst nach dem Lauf bekannt';
    feld.classList.remove('warnung');
    return;
  }

  try {
    const s = await api.schaetzung({ modell, formatId, anzahl, klein });
    verbrauchZeigen(s.verbrauch);

    if (s.dollar == null) {
      feld.textContent = `${anzahl}× ${s.masse} → ${s.ziel} · Preis erst nach dem ersten Lauf bekannt`;
      feld.classList.remove('warnung');
      return;
    }

    feld.replaceChildren();
    // anzahl kommt schon aus eingaben() oben - hier NICHT neu deklarieren,
    // das erzeugt sonst "Cannot access 'anzahl' before initialization".
    feld.append(document.createTextNode(`${anzahl}× ${s.masse} → ${s.ziel} · `));
    const b = document.createElement('b');
    b.textContent = geld(s.dollar);
    feld.append(b);
    // "gemessen" heisst: aus echten Abrechnungen, nicht aus einer Tabelle.
    feld.append(document.createTextNode(
      ` ${s.gemessen ? 'gemessen' : 'geschätzt'} · heute ${geld(s.verbrauch.dollar)}`,
    ));
    feld.classList.remove('warnung');
  } catch (fehler) {
    feld.textContent = `Schätzung fehlgeschlagen: ${fehler.message}`;
    feld.classList.add('warnung');
  }
}

async function erzeugen() {
  const knopf = el('erzeugenKnopf');
  const werte = eingaben();

  if (!werte.motiv.trim()) {
    hinweis('Kein Motiv angegeben.');
    return;
  }

  const video = art === 'video';
  knopf.disabled = true;
  knopf.textContent = video ? 'Animiert … (dauert Minuten)' : 'Erzeugt …';
  hinweis('');

  try {
    if (video) {
      const e = await api.animieren({
        motiv: werte.motiv,
        modell: werte.modell,
        formatId: werte.formatId,
        quellBild: werte.referenz,
        name: werte.name,
      });
      verbrauchZeigen(e.verbrauch);
      hinweis(
        `Clip fertig nach ${e.sekunden} s · Kosten ${e.dollar != null ? `${e.dollar.toFixed(3)} $` : 'unbekannt'}.`,
        true,
      );
    } else {
      const e = await api.erzeugen(werte);
      verbrauchZeigen(e.verbrauch);
      const preis = e.dollar ? ` · ${geld(e.dollar)}` : '';
      hinweis(`${e.erzeugt.length} Bild(er) erzeugt${preis}.`, true);
    }
    await beiFertig();
  } catch (fehler) {
    hinweis(`Fehlgeschlagen: ${fehler.message}`);
    // Der Server schickt den aktuellen Stand mit, damit die Anzeige
    // sofort stimmt statt zu behaupten es sei nichts passiert.
    if (fehler.verbrauch) verbrauchZeigen(fehler.verbrauch);
  } finally {
    knopf.disabled = false;
    zeigeGattung();
    aktualisiereSchaetzung();
  }
}

/** Chat-Verhalten: Enter erzeugt, Shift+Enter macht eine neue Zeile. */
function verdrahteEingabefeld() {
  const feld = el('motiv');

  feld.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      erzeugen();
    }
  });

  // Feld waechst mit dem Text, statt zu scrollen.
  const anpassen = () => {
    feld.style.height = 'auto';
    feld.style.height = `${Math.min(feld.scrollHeight, 180)}px`;
  };
  feld.addEventListener('input', anpassen);
  anpassen();
}

/**
 * Die beiden Haken im "Mehr"-Kasten wiederherstellen und merken.
 *
 * Gibt zurueck, ob einer davon vom Standard abweicht - dann klappt der
 * Kasten von selbst auf. Ein gemerktes "ohne Stil-Block" hinter einer
 * zugeklappten Leiste waere sonst genau die Art stiller Einstellung, wegen
 * der man sich hinterher wundert, warum die Bilder anders aussehen.
 */
function verdrahteHaken() {
  const klein = el('klein');
  const mitStil = el('mitStil');

  klein.checked = hole('klein', false, (w) => typeof w === 'boolean');
  mitStil.checked = hole('mitStil', true, (w) => typeof w === 'boolean');

  klein.addEventListener('change', () => merke('klein', klein.checked));
  mitStil.addEventListener('change', () => merke('mitStil', mitStil.checked));

  return klein.checked || !mitStil.checked;
}

/** Die selten gebrauchten Einstellungen bleiben eingeklappt. */
function verdrahteMehr(vonHandGeaendert = false) {
  const knopf = el('mehrKnopf');
  const kasten = el('mehr');
  kasten.hidden = !vonHandGeaendert;
  knopf.setAttribute('aria-expanded', String(vonHandGeaendert));
  knopf.addEventListener('click', () => {
    const zu = kasten.hidden;
    kasten.hidden = !zu;
    knopf.setAttribute('aria-expanded', String(zu));
    if (!zu) el('stilFeld').hidden = true;
  });
}

export function verdrahte() {
  el('erzeugenKnopf').addEventListener('click', erzeugen);
  el('klein').addEventListener('change', aktualisiereSchaetzung);
  verdrahteEingabefeld();
  verdrahteMehr(verdrahteHaken());
  referenz.verdrahte();
  // Referenz gewechselt -> Modellwarnung und Schaetzung neu bewerten.
  referenz.setzeWechselZiel(aktualisiereSchaetzung);
}
