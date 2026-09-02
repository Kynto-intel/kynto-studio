// Das Verlaufsfenster - innerhalb der App, nicht im Browser.
//
// Vier Bereiche, weil die Sachen wenig miteinander zu tun haben: Bilder
// kosten Geld und haben Prompts, Videos dauern Minuten, das Gespraech ist
// ein Gespraech, und der Rest sind Einstellungen. In einer gemeinsamen
// Liste findet man nichts wieder.
//
// Der Live-Strom liegt bewusst nicht hier, sondern in verlauf.js: eine
// Verbindung fuer die ganze App, nicht eine je Ansicht. Dieses Modul
// bekommt neue Eintraege gemeldet und zeichnet nur nach.

import { api } from './api.js';

const el = (id) => document.getElementById(id);

const BEREICHE = [
  { id: 'bilder', label: 'Bilder', arten: ['erzeugt', 'text'] },
  { id: 'videos', label: 'Videos', arten: ['animiert'] },
  { id: 'chat', label: 'Chat', arten: [] },
  { id: 'sonstiges', label: 'Sonstiges', arten: ['umbenannt', 'stil', 'einstellung'] },
];

const BESCHRIFTUNG = {
  erzeugt: 'Bild erzeugt',
  text: 'Text aufs Bild',
  animiert: 'Clip erzeugt',
  umbenannt: 'Umbenannt',
  stil: 'Stil-Block geändert',
  einstellung: 'Einstellung geändert',
};

let eintraege = [];
let gespraech = [];
let aktiv = 'bilder';
let geladen = false;
let beiDateiKlick = () => {};

/** Wohin ein Klick auf eine Miniatur fuehrt - die Detailansicht der App. */
export function setzeOeffnenZiel(fn) { beiDateiKlick = fn; }

function zeitpunkt(iso) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function geld(betrag) {
  if (!betrag) return null;
  const komma = (z) => z.toFixed(2).replace('.', ',');
  return betrag < 0.01 ? `${komma(betrag * 100)} ¢` : `${komma(betrag)} $`;
}

function faltung(titel, inhalt) {
  const d = document.createElement('details');
  const s = document.createElement('summary');
  s.textContent = titel;
  const p = document.createElement('pre');
  p.textContent = inhalt;
  d.append(s, p);
  return d;
}

/**
 * Miniaturen der erzeugten Dateien.
 *
 * `dateienDa` kommt vom Server und sagt, welche Dateien es noch gibt -
 * der Verlauf reicht weiter zurueck als der Bestand, und geloescht wird
 * ausserhalb der App. Fehlende erscheinen als Hinweis statt als kaputtes
 * Bildsymbol; nur vorhandene lassen sich anklicken.
 */
function dateiVorschau(d) {
  const alle = d.dateien || [];
  const da = new Set(d.dateienDa || []);

  const box = document.createElement('div');
  box.className = 'vs-dateien';

  for (const pfad of alle) {
    if (!da.has(pfad)) continue;

    const kachel = document.createElement('button');
    kachel.type = 'button';
    kachel.className = 'vs-kachel';
    kachel.title = `${pfad} — klicken zum Öffnen`;

    if (/\.(mp4|webm|mov)$/i.test(pfad)) {
      const video = document.createElement('video');
      video.src = `/datei?pfad=${encodeURIComponent(pfad)}`;
      video.muted = true;
      video.preload = 'metadata';
      kachel.append(video);
      const marke = document.createElement('span');
      marke.className = 'vs-abspiel';
      kachel.append(marke);
    } else {
      const bild = document.createElement('img');
      bild.src = `/datei?pfad=${encodeURIComponent(pfad)}`;
      bild.loading = 'lazy';
      bild.alt = '';
      kachel.append(bild);
    }

    kachel.addEventListener('click', () => beiDateiKlick(pfad));
    box.append(kachel);
  }

  const fehlend = alle.length - da.size;
  if (fehlend > 0) {
    const hinweis = document.createElement('span');
    hinweis.className = 'vs-fehlt';
    hinweis.textContent = alle.length === fehlend
      ? `${fehlend} Datei(en) nicht mehr vorhanden`
      : `+ ${fehlend} nicht mehr vorhanden`;
    box.append(hinweis);
  }

  return box;
}

function verlaufZeile(e) {
  const li = document.createElement('li');
  li.className = 'vs-zeile';

  const kopf = document.createElement('div');
  kopf.className = 'vs-zeile-kopf';

  const was = document.createElement('span');
  was.className = 'vs-was';
  was.textContent = BESCHRIFTUNG[e.was] || e.was;
  kopf.append(was);

  // Kam der Aufruf von aussen, gehoert das dazu - sonst sucht man spaeter,
  // warum etwas passiert ist, das man nicht angeklickt hat.
  if (e.quelle && e.quelle !== 'studio') {
    const wer = document.createElement('span');
    wer.className = 'vs-quelle';
    wer.textContent = e.quelle;
    kopf.append(wer);
  }

  const zeit = document.createElement('time');
  zeit.textContent = zeitpunkt(e.zeit);
  kopf.append(zeit);

  const text = document.createElement('div');
  // Bei "erzeugt" steht der ganze Prompt in e.text - schnell zwanzig
  // Zeilen. Gekuerzt anzeigen, vollstaendig in der Faltung darunter.
  text.className = e.details?.prompt ? 'vs-text vs-kurz' : 'vs-text';
  text.textContent = e.text;

  li.append(kopf, text);

  const d = e.details || {};
  if (d.dateien?.length) li.append(dateiVorschau(d));
  if (d.prompt) li.append(faltung('Vollständiger Prompt', d.prompt));

  const zusatz = [];
  if (d.modellName || d.modell) zusatz.push(d.modellName || d.modell);
  if (d.formatId) zusatz.push(d.formatId);
  if (d.anzahl > 1) zusatz.push(`${d.anzahl}×`);
  const preis = geld(d.dollar);
  if (preis) zusatz.push(preis);
  if (d.sekunden) zusatz.push(`${d.sekunden} s`);
  if (d.referenz) zusatz.push('mit Referenzbild');
  if (d.mitStil === false) zusatz.push('ohne Stil-Block');
  if (zusatz.length) {
    const fuss = document.createElement('div');
    fuss.className = 'vs-fuss';
    fuss.textContent = zusatz.join(' · ');
    li.append(fuss);
  }

  return li;
}

/** Das Gespraech, samt dem was der Assistent nachgeschlagen hat. */
function chatZeilen() {
  const namen = new Map();
  for (const n of gespraech) {
    for (const a of n.tool_calls || []) namen.set(a.id, a.function?.name);
  }

  const raus = [];
  for (const n of gespraech) {
    if (n.role === 'system') continue;

    if (n.role === 'tool') {
      let ergebnis = {};
      try { ergebnis = JSON.parse(n.content); } catch { /* egal */ }
      const li = document.createElement('li');
      li.className = 'vs-zeile vs-chat-werkzeug';
      const name = namen.get(n.tool_call_id) || 'Werkzeug';
      if (ergebnis.fehler) li.textContent = `${name} — ${ergebnis.fehler}`;
      else if (ergebnis.abgelehnt) li.textContent = `${name} — abgelehnt`;
      else if (ergebnis.erzeugt) li.textContent = `${name} — ${ergebnis.erzeugt.length} Datei(en)`;
      else li.textContent = name;
      raus.push(li);
      continue;
    }

    if (!n.content && !(n.tool_calls || []).length) continue;

    const li = document.createElement('li');
    li.className = `vs-zeile vs-chat ${n.role}`;

    const wer = document.createElement('div');
    wer.className = 'vs-wer';
    wer.textContent = n.role === 'user' ? 'Du' : 'Assistent';

    const text = document.createElement('div');
    text.className = 'vs-text';
    text.textContent = n.content || '';

    li.append(wer, text);

    for (const a of n.tool_calls || []) {
      const w = document.createElement('div');
      w.className = 'vs-fuss';
      w.textContent = `ruft auf: ${a.function?.name}`;
      li.append(w);
    }
    raus.push(li);
  }
  return raus;
}

function leerMeldung(text) {
  const li = document.createElement('li');
  li.className = 'vs-leer';
  li.textContent = text;
  el('vfListe').append(li);
}

function zeichne() {
  const liste = el('vfListe');
  liste.replaceChildren();

  if (aktiv === 'chat') {
    const zeilen = chatZeilen();
    if (!zeilen.length) return leerMeldung('Noch kein Gespräch geführt.');
    liste.append(...zeilen);
    return;
  }

  const bereich = BEREICHE.find((b) => b.id === aktiv);
  const passend = eintraege.filter((e) => bereich.arten.includes(e.was));
  if (!passend.length) return leerMeldung('Hier ist noch nichts passiert.');
  for (const e of passend) liste.append(verlaufZeile(e));
}

function baueReiter() {
  const nav = el('vfReiter');
  nav.replaceChildren();
  for (const b of BEREICHE) {
    const zahl = b.id === 'chat'
      ? gespraech.filter((n) => n.role === 'user').length
      : eintraege.filter((e) => b.arten.includes(e.was)).length;

    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'reiter';
    knopf.setAttribute('aria-current', String(b.id === aktiv));

    const name = document.createElement('span');
    name.textContent = b.label;
    const n = document.createElement('span');
    n.className = 'reiter-zahl';
    n.textContent = zahl;

    knopf.append(name, n);
    knopf.addEventListener('click', () => {
      aktiv = b.id;
      localStorage.setItem('kynto-verlauf-bereich', b.id);
      baueReiter();
      zeichne();
    });
    nav.append(knopf);
  }
}

function zeigeStand() {
  el('vfStand').textContent = `${eintraege.length} Vorgänge`;
}

/**
 * Ein neuer Vorgang kam ueber den Strom.
 *
 * Nur nachzeichnen, wenn das Fenster offen ist - sonst baut man bei jedem
 * Bild eine Liste auf, die niemand sieht. Beim naechsten Oeffnen wird
 * ohnehin frisch geladen.
 */
export function ergaenze(eintrag) {
  if (!geladen) return;
  eintraege.unshift(eintrag);
  if (el('verlaufFenster').hidden) return;
  zeigeStand();
  baueReiter();
  zeichne();
}

async function lade() {
  const daten = await fetch('/api/verlauf?anzahl=800').then((r) => r.json());
  eintraege = daten.eintraege || [];
  gespraech = daten.chat || [];
  geladen = true;
  zeigeStand();
  baueReiter();
  zeichne();
}

export async function oeffne() {
  el('verlaufFenster').hidden = false;
  try {
    await lade();
  } catch (fehler) {
    el('vfStand').textContent = `konnte nicht laden: ${fehler.message}`;
  }
}

function schliesse() {
  el('verlaufFenster').hidden = true;
}

/** Von aussen schliessen - wenn die Detailansicht uebernimmt. */
export function schliesseFenster() { schliesse(); }

export function verdrahte() {
  aktiv = localStorage.getItem('kynto-verlauf-bereich') || 'bilder';

  el('verlaufKnopf').addEventListener('click', oeffne);
  el('vfSchliessen').addEventListener('click', schliesse);
  el('verlaufFenster').addEventListener('click', (e) => {
    if (e.target === el('verlaufFenster')) schliesse();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el('verlaufFenster').hidden) schliesse();
  });
}
