// Die Chat-Leiste rechts.
//
// Zwei Dinge macht dieses Modul, und nur diese zwei:
//   1. Nachrichten hin und her, als Ereignisstrom vom Server.
//   2. Vorschlaege anzeigen, die Geld kosten - mit Preis und Knopf.
//
// Der zweite Punkt ist der eigentliche Zweck. Der Server fuehrt teure
// Werkzeuge nicht aus, er schlaegt sie nur vor. Erst der Klick hier loest
// aus, und zwar ueber dieselbe Route, die auch der Komponist unten benutzt.
// Es gibt keinen zweiten Weg zum Erzeugen und damit keine Luecke.

import { api } from './api.js';

const el = (id) => document.getElementById(id);

/** Der Gespraechsverlauf im Format, das OpenRouter erwartet. */
let nachrichten = [];
let laeuft = false;
let beiErzeugt = () => {};
let verbrauchZeigen = () => {};

export function setzeCallbacks({ fertig, verbrauch }) {
  beiErzeugt = fertig || beiErzeugt;
  verbrauchZeigen = verbrauch || verbrauchZeigen;
}

function geld(betrag) {
  if (betrag == null) return 'Preis unbekannt';
  const komma = (z) => z.toFixed(2).replace('.', ',');
  return betrag < 0.01 ? `${komma(betrag * 100)} ¢` : `${komma(betrag)} $`;
}

// ------------------------------------------------------------- Darstellung

function blase(rolle, text) {
  const b = document.createElement('div');
  b.className = `blase ${rolle}`;
  b.textContent = text;
  el('chatVerlauf').append(b);
  scrolleAnsEnde();
  return b;
}

function scrolleAnsEnde() {
  const v = el('chatVerlauf');
  v.scrollTop = v.scrollHeight;
}

/** Eine Zeile "Werkzeug gelaufen" - klein, damit sie nicht ablenkt. */
function werkzeugZeile(name, ergebnis) {
  const z = document.createElement('div');
  z.className = 'chat-werkzeug';
  const lesbar = {
    bestand_suchen: 'in der Bibliothek gesucht',
    einstellung_lesen: 'Einstellung und Preis geprüft',
    stil_lesen: 'Stil-Block gelesen',
    text_aufs_bild: 'Text aufs Bild gebrannt',
    datei_markieren: 'Datei markiert',
  }[name] || name;
  z.textContent = ergebnis?.fehler ? `${lesbar} — ${ergebnis.fehler}` : lesbar;
  if (ergebnis?.fehler) z.classList.add('fehler');
  el('chatVerlauf').append(z);
  scrolleAnsEnde();
}

/**
 * Der Vorschlag, etwas zu erzeugen.
 *
 * Zeigt alles, was Geld kostet, bevor es Geld kostet: Motiv, Anzahl, Format
 * und Preis. Das Modell steht daneben, ist aber nicht Teil des Vorschlags -
 * es kommt aus der App, nicht aus dem Gespraech.
 */
async function vorschlagKarte(id, name, argumente) {
  const karte = document.createElement('div');
  karte.className = 'chat-vorschlag';

  const video = name === 'video_erzeugen';
  const anzahl = Math.min(Math.max(1, Number(argumente.anzahl) || 1), 10);

  const kopf = document.createElement('div');
  kopf.className = 'vor-kopf';
  kopf.textContent = video ? 'Clip erzeugen?' : `${anzahl}× Bild erzeugen?`;

  const motiv = document.createElement('div');
  motiv.className = 'vor-motiv';
  motiv.textContent = argumente.motiv || '';

  const zeile = document.createElement('div');
  zeile.className = 'vor-zeile';
  zeile.textContent = 'Preis wird geholt …';

  const knoepfe = document.createElement('div');
  knoepfe.className = 'vor-knoepfe';
  const ja = document.createElement('button');
  ja.type = 'button';
  ja.className = 'fest';
  ja.disabled = true;
  ja.textContent = 'Moment …';
  const nein = document.createElement('button');
  nein.type = 'button';
  nein.className = 'neben';
  nein.textContent = 'Verwerfen';
  knoepfe.append(ja, nein);

  karte.append(kopf, motiv, zeile, knoepfe);
  el('chatVerlauf').append(karte);
  scrolleAnsEnde();

  // Preis und Einstellung frisch holen - nicht dem Modell glauben.
  let preisText = 'Preis erst nach dem Lauf bekannt';
  if (!video) {
    try {
      const s = await api.schaetzung({ anzahl });
      preisText = s.dollar == null
        ? 'Preis erst nach dem ersten Lauf bekannt'
        : `${geld(s.dollar)} ${s.gemessen ? 'gemessen' : 'geschätzt'}`;
      zeile.textContent = `${s.masse} → ${s.ziel} · ${preisText}`;
      ja.textContent = s.dollar == null ? 'Erzeugen' : `Erzeugen · ${geld(s.dollar)}`;
    } catch (fehler) {
      zeile.textContent = `Schätzung fehlgeschlagen: ${fehler.message}`;
      ja.textContent = 'Erzeugen';
    }
  } else {
    zeile.textContent = 'Clip · Preis erst nach dem Lauf bekannt · rund 20× ein Bild';
    ja.textContent = 'Clip erzeugen';
  }
  ja.disabled = false;

  return new Promise((aufloesen) => {
    const abschliessen = (inhalt, beschriftung) => {
      knoepfe.remove();
      const fuss = document.createElement('div');
      fuss.className = 'vor-ergebnis';
      fuss.textContent = beschriftung;
      karte.append(fuss);
      scrolleAnsEnde();
      aufloesen({ role: 'tool', tool_call_id: id, content: JSON.stringify(inhalt) });
    };

    nein.addEventListener('click', () => {
      abschliessen(
        { abgelehnt: true, hinweis: 'Der Mensch hat abgelehnt. Nicht erneut vorschlagen, ohne zu fragen.' },
        'Verworfen',
      );
    });

    ja.addEventListener('click', async () => {
      ja.disabled = true;
      nein.disabled = true;
      ja.textContent = video ? 'Animiert … (Minuten)' : 'Erzeugt …';
      try {
        // Bewusst OHNE modell und formatId: es gilt, was in der App steht.
        const e = video
          ? await api.animieren({
            motiv: argumente.motiv,
            quellBild: argumente.quellBild || null,
            name: argumente.name || '',
          })
          : await api.erzeugen({
            motiv: argumente.motiv,
            anzahl,
            name: argumente.name || '',
            referenz: argumente.referenz || null,
          });
        verbrauchZeigen(e.verbrauch);
        await beiErzeugt();
        const dateien = e.erzeugt || (e.pfad ? [e.pfad] : []);
        abschliessen(
          { erzeugt: dateien, dollar: e.dollar ?? null },
          `Fertig · ${dateien.length} Datei(en)${e.dollar ? ` · ${geld(e.dollar)}` : ''}`,
        );
      } catch (fehler) {
        if (fehler.verbrauch) verbrauchZeigen(fehler.verbrauch);
        abschliessen({ fehler: fehler.message }, `Fehlgeschlagen: ${fehler.message}`);
      }
    });
  });
}

// ------------------------------------------------------------------ Ablauf

/** Einen Zug an den Server geben und den Ereignisstrom auswerten. */
async function zug() {
  laeuft = true;
  el('chatSenden').disabled = true;
  const denkt = document.createElement('div');
  denkt.className = 'chat-werkzeug denkt';
  denkt.textContent = 'denkt nach …';
  el('chatVerlauf').append(denkt);
  scrolleAnsEnde();

  const offeneVorschlaege = [];

  try {
    const antwort = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nachrichten }),
    });
    if (!antwort.ok || !antwort.body) throw new Error(`HTTP ${antwort.status}`);

    const leser = antwort.body.getReader();
    const zerleger = new TextDecoder();
    let rest = '';

    for (;;) {
      const { done, value } = await leser.read();
      if (done) break;
      rest += zerleger.decode(value, { stream: true });

      // Ereignisse sind durch eine Leerzeile getrennt; das letzte Stueck
      // kann unvollstaendig sein und bleibt bis zum naechsten Durchlauf.
      const teile = rest.split('\n\n');
      rest = teile.pop() || '';

      for (const teil of teile) {
        const zeile = teil.split('\n').find((z) => z.startsWith('data: '));
        if (!zeile) continue;
        const e = JSON.parse(zeile.slice(6));

        denkt.remove();
        if (e.typ === 'text' && e.inhalt) blase('ki', e.inhalt);
        if (e.typ === 'werkzeug') werkzeugZeile(e.name, e.ergebnis);
        if (e.typ === 'fehler') {
          const b = blase('ki', e.text);
          b.classList.add('fehler');
        }
        if (e.typ === 'vorschlag') offeneVorschlaege.push(e);
        if (e.typ === 'fertig') {
          nachrichten = e.nachrichten;
          if (e.verbrauch) verbrauchZeigen(e.verbrauch);
        }
      }
    }
  } catch (fehler) {
    denkt.remove();
    const b = blase('ki', `Gespräch fehlgeschlagen: ${fehler.message}`);
    b.classList.add('fehler');
  }

  denkt.remove();
  laeuft = false;
  el('chatSenden').disabled = false;

  // Auf jeden Vorschlag wartet eine Antwort des Menschen. Erst wenn alle
  // beantwortet sind, geht das Gespraech weiter.
  if (offeneVorschlaege.length) {
    for (const v of offeneVorschlaege) {
      nachrichten.push(await vorschlagKarte(v.id, v.name, v.argumente));
    }
    await zug();
  }
}

async function senden() {
  const feld = el('chatFeld');
  const text = feld.value.trim();
  if (!text || laeuft) return;

  feld.value = '';
  feld.style.height = 'auto';
  blase('ich', text);
  nachrichten.push({ role: 'user', content: text });
  await zug();
}

// ------------------------------------------------------------ Verdrahtung

export function verdrahte() {
  const feld = el('chatFeld');

  el('chatSenden').addEventListener('click', senden);
  feld.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); senden(); }
  });
  feld.addEventListener('input', () => {
    feld.style.height = 'auto';
    feld.style.height = `${Math.min(feld.scrollHeight, 140)}px`;
  });

  el('chatLeeren').addEventListener('click', () => {
    nachrichten = [];
    el('chatVerlauf').replaceChildren();
    begruessung();
  });

  const auf = (zeigen) => {
    document.body.classList.toggle('chat-offen', zeigen);
    el('chatKnopf').setAttribute('aria-expanded', String(zeigen));
    localStorage.setItem('kynto-chat-offen', zeigen ? '1' : '0');
    if (zeigen) feld.focus();
  };
  el('chatKnopf').addEventListener('click', () => {
    auf(!document.body.classList.contains('chat-offen'));
  });
  el('chatZu').addEventListener('click', () => auf(false));
  auf(localStorage.getItem('kynto-chat-offen') === '1');

  begruessung();
}

function begruessung() {
  const b = blase('ki', 'Ich kann suchen, Text auf Bilder brennen und Motive vorschlagen. '
    + 'Erzeugen kostet Geld — das zeige ich dir vorher und du klickst.');
  b.classList.add('start');
}
