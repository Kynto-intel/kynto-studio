// Text-Editor: Spruch aufs Bild setzen.
//
// Zwei Stufen, damit es sich fluessig anfuehlt:
//   1. Der Browser zeichnet bei jeder Aenderung SOFORT (vorschau.js).
//   2. Kurz nach der letzten Aenderung holt er die exakte Fassung vom Server
//      und legt sie darueber. Der Server ist die Wahrheit, aber er braucht
//      pro Lauf einen PowerShell-Prozess - deshalb nicht bei jedem Zeichen.
//
// Gespeichert wird immer die Server-Fassung.

import { api, dateiUrl } from './api.js';
import { baueAuswahl } from './auswahl.js';
import { zeichne } from './vorschau.js';

const el = (id) => document.getElementById(id);

let bild = null;          // aktueller Eintrag
let ebene = null;         // die Textebene, die bearbeitet wird
let quellBild = null;     // geladenes Originalbild fuer die Zeichenflaeche
let vorlagen = {};
let schriftListe = [];
let beiGespeichert = () => {};
let genauZeitgeber = null;
let laeuft = 0;           // laufende Nummer, damit alte Antworten nicht gewinnen

/** Hoehe der Zeichenflaeche. Hoch genug fuer scharfe Schrift, klein genug fuers Tempo. */
const FLAECHE_HOEHE = 900;

export function setzeDaten({ schriften, textVorlagen }) {
  schriftListe = schriften || [];
  vorlagen = textVorlagen || {};
}

export function setzeSpeicherZiel(fn) { beiGespeichert = fn; }

function starteEbene(eintrag) {
  if (eintrag.textEbenen?.length) return { ...eintrag.textEbenen[0] };
  return { ...vorlagen.spruch, text: '' };
}

// ------------------------------------------------------------ Vorschau

/** Sofort neu zeichnen und die genaue Fassung neu anfordern. */
function aktualisiere() {
  sofortZeichnen();
  genauAnstossen();
}

function sofortZeichnen() {
  if (!quellBild) return;
  zeichne(el('teVorschau'), quellBild, ebene);
}

function genauAnstossen() {
  clearTimeout(genauZeitgeber);
  el('teGenau').textContent = '';
  genauZeitgeber = setTimeout(genauHolen, 700);
}

/** Holt das exakte Rendering vom Server und legt es auf die Flaeche. */
async function genauHolen() {
  if (!ebene.text.trim()) return;
  const nummer = ++laeuft;
  el('teGenau').textContent = 'genaue Fassung …';
  try {
    const antwort = await fetch('/api/text-vorschau', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pfad: bild.pfad, ebenen: [ebene], maxHoehe: FLAECHE_HOEHE }),
    });
    if (!antwort.ok) {
      const fehler = await antwort.json().catch(() => ({}));
      throw new Error(fehler.fehler || `HTTP ${antwort.status}`);
    }
    const klecks = await antwort.blob();
    const bitmap = await createImageBitmap(klecks);

    // Zwischenzeitlich weitergetippt? Dann ist diese Antwort veraltet.
    if (nummer !== laeuft) return;

    const flaeche = el('teVorschau');
    const ctx = flaeche.getContext('2d');
    ctx.clearRect(0, 0, flaeche.width, flaeche.height);
    ctx.drawImage(bitmap, 0, 0, flaeche.width, flaeche.height);
    el('teGenau').textContent = 'genau';
  } catch (fehler) {
    if (nummer === laeuft) el('teStatus').textContent = fehler.message;
  }
}

// ------------------------------------------------------------ Bedienung

function feld(bezeichnung, steuerung) {
  const wrap = document.createElement('label');
  wrap.className = 'te-feld';
  const t = document.createElement('span');
  t.textContent = bezeichnung;
  wrap.append(t, steuerung);
  return wrap;
}

function schieber(id, min, max, schritt, wert, beiAenderung) {
  const s = document.createElement('input');
  s.type = 'range';
  s.id = id;
  s.min = min; s.max = max; s.step = schritt; s.value = wert;
  // input feuert waehrend des Ziehens - die Zeichnung folgt sofort mit.
  s.addEventListener('input', () => { beiAenderung(Number(s.value)); sofortZeichnen(); });
  // Erst beim Loslassen die genaue Fassung nachladen.
  s.addEventListener('change', genauAnstossen);
  return s;
}

function farbwahl(id, wert, beiAenderung) {
  const f = document.createElement('input');
  f.type = 'color';
  f.id = id;
  f.value = wert;
  f.addEventListener('input', () => { beiAenderung(f.value); sofortZeichnen(); });
  f.addEventListener('change', genauAnstossen);
  return f;
}

function baueBedienung() {
  const ziel = el('teBedienung');
  ziel.replaceChildren();

  const vorlagenZeile = document.createElement('div');
  vorlagenZeile.className = 'te-vorlagen';
  for (const [, v] of Object.entries(vorlagen)) {
    const k = document.createElement('button');
    k.type = 'button';
    k.className = 'neben';
    k.textContent = v.label;
    k.addEventListener('click', () => {
      const text = ebene.text;
      ebene = { ...v, text };
      baueBedienung();
      aktualisiere();
    });
    vorlagenZeile.append(k);
  }
  ziel.append(feld('Vorlage', vorlagenZeile));

  const schriftBox = document.createElement('div');
  baueAuswahl(schriftBox, {
    wert: ebene.schrift,
    eintraege: schriftListe.map((s) => ({
      wert: s.name, text: s.name, notiz: s.notiz, gruppe: s.gruppe,
    })),
    beiWahl: (neu) => { ebene.schrift = neu; aktualisiere(); },
  });
  ziel.append(feld('Schrift', schriftBox));

  ziel.append(feld('Größe', schieber('teGroesse', 0.02, 0.22, 0.005, ebene.groesse,
    (w) => { ebene.groesse = w; })));
  ziel.append(feld('Zeilenabstand', schieber('teAbstand', 0.9, 2, 0.05, ebene.zeilenabstand,
    (w) => { ebene.zeilenabstand = w; })));

  const farbenZeile = document.createElement('div');
  farbenZeile.className = 'te-farben';
  farbenZeile.append(
    farbwahl('teFarbe', ebene.farbe, (w) => { ebene.farbe = w; }),
    farbwahl('teAkzent', ebene.akzentFarbe, (w) => { ebene.akzentFarbe = w; }),
  );
  ziel.append(feld('Textfarbe · Akzent', farbenZeile));

  ziel.append(feld('Kontur', schieber('teKontur', 0, 0.01, 0.0005, ebene.kontur.breite,
    (w) => { ebene.kontur.breite = w; })));
  ziel.append(feld('Schatten', schieber('teSchatten', 0, 0.015, 0.0005, ebene.schatten.versatz,
    (w) => { ebene.schatten.versatz = w; })));

  const schalter = document.createElement('div');
  schalter.className = 'te-schalter';
  for (const [wert, text] of [['links', 'Links'], ['mitte', 'Mitte'], ['rechts', 'Rechts']]) {
    const k = document.createElement('button');
    k.type = 'button';
    k.className = 'neben';
    k.textContent = text;
    k.setAttribute('aria-pressed', String(ebene.ausrichtung === wert));
    k.addEventListener('click', () => {
      ebene.ausrichtung = wert;
      baueBedienung();
      aktualisiere();
    });
    schalter.append(k);
  }
  const versal = document.createElement('button');
  versal.type = 'button';
  versal.className = 'neben';
  versal.textContent = 'GROSS';
  versal.setAttribute('aria-pressed', String(Boolean(ebene.versalien)));
  versal.addEventListener('click', () => {
    ebene.versalien = !ebene.versalien;
    baueBedienung();
    aktualisiere();
  });
  schalter.append(versal);
  ziel.append(feld('Ausrichtung', schalter));
}

// ------------------------------------------------------------ Position

function verdrahteZiehen() {
  const flaeche = el('teVorschau');
  const marke = el('teMarke');
  let zieht = false;

  const ausEreignis = (e) => {
    const kasten = flaeche.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - kasten.left) / kasten.width)),
      y: Math.min(1, Math.max(0, (e.clientY - kasten.top) / kasten.height)),
    };
  };

  const setze = (e) => {
    const pos = ausEreignis(e);
    ebene.x = pos.x;
    ebene.y = pos.y;
    marke.hidden = false;
    marke.style.left = `${pos.x * 100}%`;
    marke.style.top = `${pos.y * 100}%`;
    sofortZeichnen();          // folgt der Maus ohne Verzoegerung
  };

  flaeche.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    zieht = true;
    flaeche.setPointerCapture(e.pointerId);
    setze(e);
  });
  flaeche.addEventListener('pointermove', (e) => { if (zieht) setze(e); });

  const beenden = (e) => {
    if (!zieht) return;
    zieht = false;
    try { flaeche.releasePointerCapture(e.pointerId); } catch { /* schon frei */ }
    marke.hidden = true;
    genauAnstossen();          // erst jetzt die exakte Fassung
  };
  flaeche.addEventListener('pointerup', beenden);
  flaeche.addEventListener('pointercancel', beenden);
}

// ------------------------------------------------------------ Oeffnen

export function oeffne(eintrag) {
  if (eintrag.art !== 'bild') return;
  bild = eintrag;
  ebene = starteEbene(eintrag);

  el('teDatei').textContent = eintrag.name;
  el('teText').value = ebene.text;
  el('teStatus').textContent = '';
  el('teGenau').textContent = '';
  el('texteditor').hidden = false;
  baueBedienung();

  // Original laden, dann die Flaeche auf sein Seitenverhaeltnis stellen
  quellBild = new Image();
  quellBild.onload = () => {
    const flaeche = el('teVorschau');
    const massstab = FLAECHE_HOEHE / quellBild.naturalHeight;
    flaeche.height = FLAECHE_HOEHE;
    flaeche.width = Math.round(quellBild.naturalWidth * massstab);
    sofortZeichnen();
    if (ebene.text) genauAnstossen();
  };
  quellBild.src = dateiUrl(eintrag.pfad);

  el('teText').focus();
}

export function schliesse() {
  el('texteditor').hidden = true;
  clearTimeout(genauZeitgeber);
  laeuft += 1;               // laufende Antworten verwerfen
  quellBild = null;
}

async function speichern() {
  const knopf = el('teSpeichern');
  if (!ebene.text.trim()) { el('teStatus').textContent = 'Kein Text eingegeben.'; return; }
  knopf.disabled = true;
  knopf.textContent = 'Speichert …';
  try {
    const e = await api.textAnwenden(bild.pfad, [ebene]);
    el('teStatus').textContent = `Gespeichert: ${e.name}`;
    await beiGespeichert();
    setTimeout(schliesse, 700);
  } catch (fehler) {
    el('teStatus').textContent = fehler.message;
  } finally {
    knopf.disabled = false;
    knopf.textContent = 'Speichern';
  }
}

export function verdrahte() {
  el('teText').addEventListener('input', (e) => {
    ebene.text = e.target.value;
    aktualisiere();
  });
  el('teSpeichern').addEventListener('click', speichern);
  el('teSchliessen').addEventListener('click', schliesse);
  el('texteditor').addEventListener('click', (e) => {
    if (e.target === el('texteditor')) schliesse();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el('texteditor').hidden) schliesse();
  });
  verdrahteZiehen();
}
