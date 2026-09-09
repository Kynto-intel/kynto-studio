// Kostenverfolgung.
//
// Abgerechnet wird in Dollar, und zwar mit dem Wert, den OpenRouter nach
// jedem Lauf selbst zurueckmeldet. Es wird nichts geschaetzt und nichts
// hochgerechnet - was hier steht, ist bezahlt worden.
//
// Zusaetzlich wird je Modell der Durchschnittspreis mitgeschrieben. Damit
// kann die Oberflaeche vor dem naechsten Lauf einen belastbaren Preis
// anzeigen, statt aus einer Preistabelle zu raten.

import fs from 'node:fs';
import { datenPfad, GRENZEN } from './konfig.mjs';

const ZAEHLER_DATEI = datenPfad('verbrauch.json');

/**
 * Der heutige Tag - nach der Uhr des Rechners, nicht nach UTC.
 *
 * toISOString() liefert UTC. In Mitteleuropa heisst das: zwischen
 * Mitternacht und 02:00 zaehlt die App noch auf den Vortag, und wer nachts
 * arbeitet sieht unter "Heute" den Verbrauch von gestern. Gemessen am
 * 03.09.2026 um 00:40.
 */
function heute() {
  const d = new Date();
  const zweistellig = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${zweistellig(d.getMonth() + 1)}-${zweistellig(d.getDate())}`;
}

function lade() {
  try {
    if (fs.existsSync(ZAEHLER_DATEI)) {
      return JSON.parse(fs.readFileSync(ZAEHLER_DATEI, 'utf8'));
    }
  } catch {
    // kaputt -> frisch anfangen
  }
  return {};
}

/** Was wurde heute ueber dieses Werkzeug verbraucht? */
export function stand() {
  const daten = lade();
  const tag = heute();
  const eintrag = {
    bilder: 0, clips: 0, dollar: 0,
    bildDollar: 0, videoDollar: 0, chatDollar: 0,
    ...(daten[tag] || {}),
  };

  // Summe ueber alles, damit man den Gesamtverbrauch im Blick hat
  let gesamt = 0;
  let gesamtChat = 0;
  for (const [schluessel, wert] of Object.entries(daten)) {
    if (schluessel.startsWith('__')) continue;
    gesamt += Number(wert.dollar) || 0;
    gesamtChat += Number(wert.chatDollar) || 0;
  }

  const rund = (n) => Number((Number(n) || 0).toFixed(4));

  return {
    tag,
    ...eintrag,
    dollar: rund(eintrag.dollar),
    bildDollar: rund(eintrag.bildDollar),
    videoDollar: rund(eintrag.videoDollar),
    chatDollar: rund(eintrag.chatDollar),
    gesamtDollar: rund(gesamt),
    gesamtChatDollar: rund(gesamtChat),
    // Was eingestellt ist und wie weit es aufgebraucht ist - die Anzeige
    // soll das nicht selbst ausrechnen muessen.
    grenzen: { ...GRENZEN },
  };
}

/** Menschenlesbarer Betrag fuer Fehlermeldungen. */
function geld(betrag) {
  const n = Number(betrag) || 0;
  return n < 0.01 ? `${(n * 100).toFixed(2).replace('.', ',')} ¢` : `${n.toFixed(2).replace('.', ',')} $`;
}

/**
 * Darf heute noch etwas erzeugt werden, das Geld kostet?
 *
 * Wirft, wenn nicht. Jeder Weg, der ausgibt, geht hier durch - der Klick in
 * der App, der Vorschlag des Assistenten und jedes fremde Skript ueber die
 * API. Es gibt genau diese eine Bremse, damit es keine Luecke gibt.
 *
 * EHRLICH GESAGT: Geprueft wird gegen das, was schon abgerechnet ist. Ein
 * einzelner Lauf kann die Grenze deshalb noch reissen - was er kostet, sagt
 * OpenRouter erst danach, und bei Video vorher ueberhaupt nicht. Die Bremse
 * verhindert den naechsten Lauf, nicht den laufenden. Alles andere waere
 * eine Zusage, die die Schnittstelle nicht hergibt.
 *
 * @param {'bild'|'video'|'chat'} art
 */
export function pruefe(art) {
  const s = stand();
  const benannt = { bild: 'Bild-Limit', video: 'Video-Limit', chat: 'Assistenten-Limit' };

  const proben = [
    ['Tageslimit', GRENZEN.gesamt, s.dollar],
    [benannt[art], GRENZEN[art], s[`${art}Dollar`]],
  ];

  for (const [name, grenze, verbraucht] of proben) {
    if (!grenze || grenze <= 0) continue;          // nicht gesetzt = keine Bremse
    if (verbraucht < grenze) continue;
    throw new Error(
      `${name} erreicht: heute ${geld(verbraucht)} von ${geld(grenze)}. `
      + 'Unter "Einstellungen" anheben oder bis morgen warten.',
    );
  }
}

/**
 * Gemessene Durchschnittspreise je Modell, aus echten Laeufen.
 * Zuverlaessiger als jede Schaetzung.
 */
export function gemessen() {
  return lade().__modelle || {};
}

/**
 * Was an welchem Tag und in welchem Monat verbraucht wurde.
 *
 * Die Zahlen liegen laengst da - verbrauch.json schreibt seit dem ersten
 * Tag je Datum mit. Sie waren nur nirgends abfragbar.
 *
 * EHRLICHKEIT BEI ALTEN TAGEN: Die Aufteilung nach Bild, Clip und Chat gibt
 * es erst seit dem 2.9.2026. Davor stand nur eine Tagessumme in der Datei,
 * teils noch mit `neurons` und `orAufrufe` aus der Cloudflare-Zeit. Diese
 * Betraege zaehlen in die Summe, aber NICHT in eine der drei Spalten - sonst
 * saehe ein Monat billiger aus, als er war, oder eine Spalte bekaeme Geld
 * zugeschlagen, das nie dorthin gehoerte. `ohneAufteilung` sagt, wie viel
 * davon betroffen ist.
 *
 * @param {number} monate wie viele Monate zurueck, Standard alle
 */
export function geschichte(monate = 0) {
  const daten = lade();
  const tage = Object.keys(daten)
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort();

  const proTag = tage.map((tag) => {
    const e = daten[tag] || {};
    const dollar = Number(e.dollar) || 0;
    const bild = Number(e.bildDollar) || 0;
    const video = Number(e.videoDollar) || 0;
    const chat = Number(e.chatDollar) || 0;
    // Was die Summe hergibt, die drei Spalten aber nicht erklaeren.
    const rest = Number((dollar - bild - video - chat).toFixed(6));
    return {
      tag,
      bilder: Number(e.bilder) || 0,
      clips: Number(e.clips) || 0,
      dollar: Number(dollar.toFixed(4)),
      bildDollar: Number(bild.toFixed(4)),
      videoDollar: Number(video.toFixed(4)),
      chatDollar: Number(chat.toFixed(4)),
      ohneAufteilung: rest > 0.0001 ? Number(rest.toFixed(4)) : 0,
    };
  });

  const karte = new Map();
  for (const t of proTag) {
    const monat = t.tag.slice(0, 7);
    const m = karte.get(monat) || {
      monat, bilder: 0, clips: 0, tage: 0,
      dollar: 0, bildDollar: 0, videoDollar: 0, chatDollar: 0, ohneAufteilung: 0,
    };
    m.tage += 1;
    for (const f of ['bilder', 'clips', 'dollar', 'bildDollar', 'videoDollar', 'chatDollar', 'ohneAufteilung']) {
      m[f] += t[f];
    }
    karte.set(monat, m);
  }

  let proMonat = [...karte.values()]
    .map((m) => ({
      ...m,
      dollar: Number(m.dollar.toFixed(4)),
      bildDollar: Number(m.bildDollar.toFixed(4)),
      videoDollar: Number(m.videoDollar.toFixed(4)),
      chatDollar: Number(m.chatDollar.toFixed(4)),
      ohneAufteilung: Number(m.ohneAufteilung.toFixed(4)),
      // Was ein Bild und was ein Clip im Schnitt gekostet hat. Nur wo
      // beides bekannt ist - sonst waere es eine Division durch Vermutung.
      jeBild: m.bilder && m.bildDollar ? Number((m.bildDollar / m.bilder).toFixed(4)) : null,
      jeClip: m.clips && m.videoDollar ? Number((m.videoDollar / m.clips).toFixed(3)) : null,
    }))
    .sort((a, b) => b.monat.localeCompare(a.monat));

  if (monate > 0) proMonat = proMonat.slice(0, monate);

  const gesamt = proMonat.reduce((a, m) => a + m.dollar, 0);
  return {
    proMonat,
    // Nur die Tage der gezeigten Monate, neueste zuerst.
    proTag: proTag
      .filter((t) => proMonat.some((m) => m.monat === t.tag.slice(0, 7)))
      .reverse(),
    gesamt: Number(gesamt.toFixed(4)),
    seit: tage[0] || null,
  };
}

/**
 * Bucht einen Lauf auf den heutigen Tag.
 *
 * `chat` trennt die Gespraechskosten heraus. Sie zaehlen in dieselbe
 * Tagessumme - es ist dasselbe Guthaben - aber man will sehen koennen,
 * welcher Teil aufs Reden und welcher aufs Rendern ging. Ein Bild kostet
 * so viel wie hundert Gespraechszuege; ohne die Trennung sieht ein Tag mit
 * viel Chat aus wie ein Tag mit einem halben Bild.
 */
export function buche({
  bilder = 0, clips = 0, dollar = 0, modell = null, chat = false, sekunden = 0,
}) {
  const daten = lade();
  const tag = heute();

  if (modell && dollar > 0) {
    daten.__modelle = daten.__modelle || {};
    const m = daten.__modelle[modell] || { summe: 0, laeufe: 0 };
    m.summe += dollar;
    m.laeufe += Math.max(1, bilder + clips || 1);
    m.schnitt = Number((m.summe / m.laeufe).toFixed(6));

    // Bei Clips zaehlt der Schnitt je LAUF nichts: ein 8-Sekuender kostet
    // mehr als ein 5-Sekuender, und ein Mittelwert ueber beide sagt vor dem
    // naechsten Klick nichts Brauchbares. Gemessen 6.9.2026 ist der Preis
    // streng linear - 0,84 $ bei 5 s und 1,344 $ bei 8 s, beides 0,168 $
    // je Sekunde. Deshalb wird hier die Sekunde zur Einheit.
    //
    // `sekundenDollar` zaehlt getrennt mit, und zwar NUR die Laeufe, deren
    // Dauer bekannt ist. Durch `summe` zu teilen waere falsch: dort stecken
    // auch aeltere Clips ohne Sekundenangabe drin, und der Preis je Sekunde
    // kaeme zu hoch heraus.
    if (sekunden > 0) {
      m.sekunden = (m.sekunden || 0) + sekunden;
      m.sekundenDollar = Number(((m.sekundenDollar || 0) + dollar).toFixed(6));
      m.proSekunde = Number((m.sekundenDollar / m.sekunden).toFixed(6));
    }
    daten.__modelle[modell] = m;
  }

  const e = {
    bilder: 0, clips: 0, dollar: 0,
    bildDollar: 0, videoDollar: 0, chatDollar: 0,
    ...(daten[tag] || {}),
  };
  e.bilder += bilder;
  e.clips += clips;
  e.dollar += dollar;

  // Getrennt nach Gattung, sonst liesse sich kein eigenes Limit fuer Bild
  // und Video ziehen. Der Tag weiss bisher nur, WIE VIELE Bilder und Clips
  // es waren, nicht was jedes gekostet hat.
  if (chat) e.chatDollar += dollar;
  else if (clips) e.videoDollar += dollar;
  else e.bildDollar += dollar;

  daten[tag] = e;

  // Nur die letzten 180 Tage behalten, Modell-Messwerte bleiben dauerhaft.
  const tage = Object.keys(daten).filter((k) => !k.startsWith('__')).sort().slice(-180);
  const knapp = {};
  for (const t of tage) knapp[t] = daten[t];
  if (daten.__modelle) knapp.__modelle = daten.__modelle;

  fs.writeFileSync(ZAEHLER_DATEI, JSON.stringify(knapp, null, 2), 'utf8');
  return stand();
}
