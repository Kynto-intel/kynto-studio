// Das Verlaufsfenster.
//
// Eigene Seite, eigenes Fenster - damit man das Studio nebenher weiter
// bedienen kann und der Verlauf nicht die halbe Galerie verdeckt.
//
// Vier Bereiche, weil die Sachen wenig miteinander zu tun haben: Bilder
// kosten Geld und haben Prompts, Videos dauern Minuten, das Gespraech ist
// ein Gespraech, und der Rest sind Einstellungen. In einer gemeinsamen
// Liste findet man nichts wieder.

const el = (id) => document.getElementById(id);

/** Welche Verlaufsarten in welchen Bereich gehoeren. */
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

function zeitpunkt(iso) {
  const d = new Date(iso);
  return d.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function geld(betrag) {
  if (!betrag) return null;
  const komma = (z) => z.toFixed(2).replace('.', ',');
  return betrag < 0.01 ? `${komma(betrag * 100)} ¢` : `${komma(betrag)} $`;
}

/** Aufklappbarer Block - der volle Prompt macht die Liste sonst unlesbar. */
function faltung(titel, inhalt) {
  const d = document.createElement('details');
  const s = document.createElement('summary');
  s.textContent = titel;
  const p = document.createElement('pre');
  p.textContent = inhalt;
  d.append(s, p);
  return d;
}

/** Vorschaubilder der erzeugten Dateien. Video bekommt ein video-Element. */
function dateiVorschau(dateien) {
  const box = document.createElement('div');
  box.className = 'vs-dateien';
  for (const pfad of dateien) {
    const adresse = `/datei?pfad=${encodeURIComponent(pfad)}`;
    const a = document.createElement('a');
    a.href = adresse;
    a.target = '_blank';
    a.title = pfad;

    // Der Verlauf reicht weiter zurueck als der Bestand: geloeschte oder
    // verschobene Dateien haetten sonst ein kaputtes Bildsymbol samt
    // ausgeschriebenem Pfad hinterlassen. Faellt das Laden aus, verschwindet
    // die Kachel einfach.
    const weg = () => a.remove();

    if (/\.(mp4|webm|mov)$/i.test(pfad)) {
      const v = document.createElement('video');
      v.src = adresse;
      v.muted = true;
      v.preload = 'metadata';
      v.addEventListener('error', weg);
      a.append(v);
    } else {
      const i = document.createElement('img');
      i.src = adresse;
      i.loading = 'lazy';
      i.alt = '';
      i.addEventListener('error', weg);
      a.append(i);
    }
    box.append(a);
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

  const zeit = document.createElement('time');
  zeit.textContent = zeitpunkt(e.zeit);

  kopf.append(was, zeit);

  const text = document.createElement('div');
  // Bei "erzeugt" steht der ganze Prompt in e.text - das sind schnell
  // zwanzig Zeilen. Gekuerzt anzeigen, vollstaendig in der Faltung darunter.
  text.className = e.details?.prompt ? 'vs-text vs-kurz' : 'vs-text';
  text.textContent = e.text;

  li.append(kopf, text);

  const d = e.details || {};
  if (d.dateien?.length) li.append(dateiVorschau(d.dateien));
  if (d.prompt) li.append(faltung('Vollständiger Prompt', d.prompt));
  if (d.stilBlock) li.append(faltung('Stil-Block dieses Laufs', d.stilBlock));

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

/**
 * Das Gespraech.
 *
 * Werkzeug-Zeilen zeigen, was der Assistent nachgeschlagen hat - ohne die
 * liest sich der Verlauf, als haette er die Antworten erraten.
 */
function chatZeilen() {
  const namen = new Map();
  for (const n of gespraech) {
    for (const a of n.tool_calls || []) namen.set(a.id, a.function?.name);
  }

  const raus = [];
  for (const n of gespraech) {
    if (n.role === 'system') continue;

    const li = document.createElement('li');
    li.className = `vs-zeile vs-chat ${n.role}`;

    if (n.role === 'tool') {
      let ergebnis = {};
      try { ergebnis = JSON.parse(n.content); } catch { /* egal */ }
      li.classList.add('vs-chat-werkzeug');
      const name = namen.get(n.tool_call_id) || 'Werkzeug';
      li.textContent = ergebnis.fehler
        ? `${name} — ${ergebnis.fehler}`
        : `${name}${ergebnis.erzeugt ? ` — ${ergebnis.erzeugt.length} Datei(en)` : ''}`;
      if (ergebnis.abgelehnt) li.textContent = `${name} — vom Menschen abgelehnt`;
      raus.push(li);
      continue;
    }

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

    if (!n.content && !(n.tool_calls || []).length) continue;
    raus.push(li);
  }
  return raus;
}

function zeichne() {
  const liste = el('vsListe');
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

function leerMeldung(text) {
  const li = document.createElement('li');
  li.className = 'vs-leer';
  li.textContent = text;
  el('vsListe').append(li);
}

function baueReiter() {
  const nav = el('vsReiter');
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

async function lade() {
  const antwort = await fetch('/api/verlauf?anzahl=800');
  const daten = await antwort.json();
  eintraege = daten.eintraege || [];
  gespraech = daten.chat || [];
  el('vsStand').textContent = `${eintraege.length} Vorgänge · live verbunden`;
  baueReiter();
  zeichne();
}

/** Neue Vorgaenge erscheinen sofort, ohne dass man neu laedt. */
function verbinde() {
  const strom = new EventSource('/api/verlauf-strom');
  strom.addEventListener('message', (e) => {
    try {
      eintraege.unshift(JSON.parse(e.data));
    } catch {
      return;
    }
    el('vsStand').textContent = `${eintraege.length} Vorgänge · live verbunden`;
    baueReiter();
    zeichne();
  });
  strom.addEventListener('error', () => {
    el('vsStand').textContent = `${eintraege.length} Vorgänge · Verbindung unterbrochen`;
  });
}

aktiv = localStorage.getItem('kynto-verlauf-bereich') || 'bilder';
lade().then(verbinde).catch((fehler) => {
  el('vsStand').textContent = `konnte nicht laden: ${fehler.message}`;
});
