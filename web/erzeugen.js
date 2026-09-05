// Der Komponist: Auswahl, Kostenschaetzung, Ausloesen.
//
// Grundregel: Es wird NIE automatisch gerendert. Die Schaetzung laeuft
// staendig mit, erzeugt aber nichts - erst der Klick kostet.

import { api } from './api.js';
import { baueAuswahl } from './auswahl.js';
import { hole, merke } from './merker.js';
import * as referenz from './referenz.js';
import * as vorlagen from './vorlagen.js';

let beiFertig = () => {};
let verbrauchZeigen = () => {};

const el = (id) => document.getElementById(id);

/** Aktueller Stand der Regler. */
const regler = {
  art: null, modell: null, format: null, anzahl: null,
  dauer: null, aufloesung: null,
};

/** Die Formate, wie sie der Server kennt - fuers Laden einer Vorlage. */
let formatKatalog = [];

/**
 * Der letzte Lauf, der wirklich durchgegangen ist.
 *
 * Bewusst nicht der aktuelle Stand der Regler: zwischen dem Lauf und dem
 * Klick auf "Als Vorlage" kann man am Modell gedreht haben. Eine Vorlage
 * soll den Zustand festhalten, aus dem das Bild entstanden ist - sonst
 * kommt beim naechsten Aufruf etwas anderes heraus.
 */
let letzterLauf = null;

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

export function baueRegler({
  formate, modelleBild, modelleVideo, anbieter, preise: p, gemessen: g,
  standard = {}, videoDauern = [3, 5, 8, 10], videoAufloesungen = ['720p', '1080p'],
}) {
  gemerkteModelle.bild = standard.modellBild || null;
  gemerkteModelle.video = standard.modellVideo || null;
  katalog.bild = modelleBild;
  katalog.video = modelleVideo;
  preise = p || preise;
  gemessen = g || {};
  anbieterStand = anbieter;
  formatKatalog = formate;

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

  // Dauer und Aufloesung stehen wie das Modell auf dem Server, nicht im
  // Browser: der Assistent schlaegt einen Clip vor, aber wie lang und wie
  // gross er wird, ist eine Einstellung des Menschen.
  //
  // Laenger heisst teurer, und zwar ungefaehr im Verhaeltnis. Das steht als
  // Notiz dran, weil vor dem Lauf sonst niemand einen Preis sieht -
  // OpenRouter nennt fuer Video vorab keinen.
  regler.dauer = baueAuswahl(el('dauerWahl'), {
    wert: String(standard.videoDauer || 5),
    eintraege: videoDauern.map((d) => ({
      wert: String(d),
      text: `${d} s`,
      notiz: d === 5 ? 'Standard' : null,
    })),
    beiWahl: (neu) => {
      merkeAmServer('videoDauer', Number(neu));
      aktualisiereSchaetzung();
    },
  });

  regler.aufloesung = baueAuswahl(el('aufloesungWahl'), {
    wert: standard.videoAufloesung || '1080p',
    eintraege: videoAufloesungen.map((a) => ({
      wert: a,
      text: a,
      notiz: a === '720p' ? 'schneller, billiger' : null,
    })),
    beiWahl: (neu) => {
      merkeAmServer('videoAufloesung', neu);
      aktualisiereSchaetzung();
    },
  });
}

/** Knopf, Platzhalter und Anzahl an die Gattung anpassen. */
function zeigeGattung() {
  const video = art === 'video';
  el('erzeugenKnopf').setAttribute('aria-label', video ? 'Animieren' : 'Erzeugen');
  el('erzeugenKnopf').title = video ? 'Animieren' : 'Erzeugen';
  el('motiv').placeholder = video
    ? 'Bewegung beschreiben, englisch — Standbild als Referenz wählen'
    : 'Motiv beschreiben, englisch …';
  el('anzahlWahl').hidden = video; // ein Clip pro Lauf, nie im Stapel
  // Umgekehrt: Dauer und Aufloesung gibt es nur beim Clip.
  el('dauerWahl').hidden = !video;
  el('aufloesungWahl').hidden = !video;
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
    dauer: Number(regler.dauer.wert) || 5,
    aufloesung: regler.aufloesung.wert,
    // Leer heisst ohne Referenz, gesetzt heisst mit. Kein zweiter Weg.
    referenz: referenz.pfad(),
  };
}

/** Namensvorschlag: der eigene Dateiname, sonst der Anfang des Motivs. */
function vorschlagsName(lauf) {
  const eigen = String(lauf.werte.name || '').trim();
  if (eigen) return eigen.slice(0, 60);
  return String(lauf.werte.motiv || '')
    .replace(/\s+/g, ' ').trim().split(' ').slice(0, 5).join(' ')
    .slice(0, 60);
}

/**
 * "Als Vorlage" - erscheint im Hinweis, sobald ein Lauf durch ist.
 *
 * Genau dann sieht man, ob es etwas geworden ist. Ein Knopf, der immer da
 * ist, wird zu einem Knopf, den man nie drueckt.
 */
function vorlageKnopf() {
  const knopf = document.createElement('button');
  knopf.type = 'button';
  knopf.className = 'neben klein';
  knopf.textContent = 'Als Vorlage';
  knopf.title = 'Motiv, Modell, Format und Referenz dieses Laufs aufbewahren';

  knopf.addEventListener('click', () => {
    const lauf = letzterLauf;
    if (!lauf) return;
    knopf.replaceWith(vorlagen.benennung(vorschlagsName(lauf), async (name) => {
      const v = await vorlagen.sichere({
        name,
        art: lauf.art,
        motiv: lauf.werte.motiv,
        modell: lauf.werte.modell,
        formatId: lauf.werte.formatId,
        anzahl: lauf.werte.anzahl,
        klein: lauf.werte.klein,
        mitStil: lauf.werte.mitStil,
        dateiname: lauf.werte.name,
        dauer: lauf.werte.dauer,
        aufloesung: lauf.werte.aufloesung,
        referenz: lauf.werte.referenz,
        miniatur: lauf.datei,
      });
      return `„${v.name}“ liegt in den Vorlagen.`;
    }));
  });
  return knopf;
}

function hinweis(text, gut = false) {
  const h = el('hinweis');
  if (!text) { h.hidden = true; h.replaceChildren(); return; }
  h.hidden = false;
  h.replaceChildren(document.createTextNode(text));
  h.classList.toggle('gut', gut);
  if (gut && letzterLauf) h.append(vorlageKnopf());
}

/**
 * Eine Vorlage in den Komponisten laden.
 *
 * Fuellt die Felder und rechnet die Schaetzung neu - mehr nicht. Erzeugt
 * wird weiterhin nur auf Klick, hier wie ueberall.
 *
 * Was seit dem Speichern verschwunden ist (Modell aus dem Katalog,
 * Referenzbild von der Platte), wird uebersprungen und gesagt. Der Rest
 * laedt trotzdem: eine halbe Vorlage ist mehr wert als eine Fehlermeldung.
 */
export function ladeVorlage(v) {
  const fehlt = [];

  if (v.art !== art) {
    art = v.art === 'video' ? 'video' : 'bild';
    merke('art', art);
    regler.art.setze(art);
    baueModellListe();
    zeigeGattung();
  }

  if (v.modell && katalog[art].some((m) => m.id === v.modell)) {
    regler.modell.setze(v.modell);
    gemerkteModelle[art] = v.modell;
    merkeAmServer(art === 'video' ? 'modellVideo' : 'modellBild', v.modell);
  } else if (v.modell) {
    fehlt.push(`Modell „${v.modell}“ gibt es nicht mehr`);
  }

  if (v.formatId && formatKatalog.some((f) => f.id === v.formatId)) {
    regler.format.setze(v.formatId);
    merkeAmServer('formatId', v.formatId);
  }

  // Die Anzahl kommt mit: eine bewusst angeklickte Vorlage ist kein
  // vergessener Regler von vorgestern, und der Preis steht sofort darunter.
  const anzahl = String(v.anzahl || 1);
  if (['1', '2', '3', '4', '6', '8'].includes(anzahl)) regler.anzahl.setze(anzahl);

  // Ohne diese zwei kaeme aus einer Video-Vorlage ein anderer Clip heraus,
  // als beim Speichern herausgekommen ist.
  if (v.dauer) {
    regler.dauer.setze(String(v.dauer));
    merkeAmServer('videoDauer', Number(v.dauer));
  }
  if (v.aufloesung) {
    regler.aufloesung.setze(v.aufloesung);
    merkeAmServer('videoAufloesung', v.aufloesung);
  }

  el('klein').checked = Boolean(v.klein);
  el('mitStil').checked = v.mitStil !== false;
  merke('klein', el('klein').checked);
  merke('mitStil', el('mitStil').checked);

  el('dateiname').value = v.dateiname || '';

  const feld = el('motiv');
  feld.value = v.motiv || '';
  feld.style.height = 'auto';
  feld.style.height = `${Math.min(feld.scrollHeight, 180)}px`;

  if (v.referenz && v.referenzDa) {
    referenz.setze({ pfad: v.referenz, name: v.referenz.split('/').pop() });
  } else {
    referenz.leere();
    if (v.referenz) fehlt.push('das Referenzbild liegt nicht mehr da');
  }

  // Abweichende Haken nicht hinter der zugeklappten Leiste verstecken -
  // dieselbe Begruendung wie beim Start.
  if (el('klein').checked || !el('mitStil').checked) {
    el('mehr').hidden = false;
    el('mehrKnopf').setAttribute('aria-expanded', 'true');
  }

  // Ein geladener Zustand ist kein Lauf. Sonst boete der Hinweis an, das
  // Ergebnis von vorhin noch einmal als Vorlage zu sichern.
  letzterLauf = null;
  hinweis(fehlt.length ? `„${v.name}“ geladen — aber ${fehlt.join(' und ')}.` : '');
  aktualisiereSchaetzung();
  feld.focus();
}

export async function aktualisiereSchaetzung() {
  const feld = el('schaetzung');
  const { modell, formatId, anzahl, klein, dauer, aufloesung } = eingaben();

  // Referenz gesetzt, aber Modell kann keine? Ehrlich sagen statt still
  // ignorieren.
  const info = modellInfo.get(modell);
  if (referenz.pfad() && info && !info.kannReferenz) {
    feld.textContent = `${info.name} nimmt keine Referenzbilder — anderes Modell wählen`;
    feld.classList.add('warnung');
    return;
  }

  // Video: OpenRouter nennt vorab keinen Preis. Nichts behaupten - aber
  // sagen, was eingestellt ist, damit man vor dem teuersten Klick der App
  // wenigstens Dauer und Groesse schwarz auf weiss sieht.
  if (art === 'video') {
    const woher = referenz.pfad() ? 'Clip aus dem gewählten Standbild' : 'Text-zu-Video';
    feld.textContent = `${woher} · ${dauer} s · ${aufloesung} · Preis erst nach dem Lauf bekannt`;
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
  // Der vorige Lauf ist erledigt - sein Vorlagen-Knopf darf nicht stehen
  // bleiben und hinterher den falschen Zustand sichern.
  letzterLauf = null;
  hinweis('');

  try {
    if (video) {
      const e = await api.animieren({
        motiv: werte.motiv,
        modell: werte.modell,
        formatId: werte.formatId,
        dauer: werte.dauer,
        aufloesung: werte.aufloesung,
        quellBild: werte.referenz,
        name: werte.name,
      });
      verbrauchZeigen(e.verbrauch);
      letzterLauf = { art: 'video', werte, datei: e.erzeugt[0] || null };
      hinweis(
        `Clip fertig nach ${e.sekunden} s · Kosten ${e.dollar != null ? `${e.dollar.toFixed(3)} $` : 'unbekannt'}.`,
        true,
      );
    } else {
      const e = await api.erzeugen(werte);
      verbrauchZeigen(e.verbrauch);
      letzterLauf = { art: 'bild', werte, datei: e.erzeugt[0] || null };
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
