// Das Bild-Raster: Bestand laden, Karten bauen, Ordner-Filter,
// Bild/Video-Reiter und Suche.

import { api, dateiUrl } from './api.js';
import { symbolFuer } from './symbole.js';

const rasterEl = () => document.getElementById('raster');
const titelEl = () => document.getElementById('rasterTitel');

/** Muss zu grid-template-columns und gap in studio.css passen. */
const MIN_KACHEL = 190;
const ABSTAND = 14;

/**
 * Spaltenzahl fuer eine bestimmte Breite festnageln.
 *
 * Ohne das rechnet `auto-fill` waehrend der Seitenleisten-Animation die
 * Spaltenzahl mehrfach neu - die Kacheln springen sichtbar um. Mit fester
 * Spaltenzahl passiert der Umbruch einmal am Anfang, danach skalieren die
 * Kacheln nur noch weich mit.
 */
export function friereSpalten(zielBreite) {
  const spalten = Math.max(1, Math.floor((zielBreite + ABSTAND) / (MIN_KACHEL + ABSTAND)));
  rasterEl().style.gridTemplateColumns = `repeat(${spalten}, minmax(0, 1fr))`;
}

/** Gibt die Spaltenzahl wieder frei, sobald die Bewegung durch ist. */
export function loeseSpalten() {
  rasterEl().style.gridTemplateColumns = '';
}

let aktuellerOrdner = null;
let aktuelleArt = null;        // null = alles, sonst 'bild' oder 'video'
let suchwort = '';
let nurFavoriten = false;
let beiKlick = () => {};
let ordnerDefs = [];

/**
 * Was gerade im Raster steht: der Bestand oder eine der gemeldeten
 * Sonderansichten (Vorlagen, Einstellungen).
 *
 * Bewusst Ansichten und keine Fenster. Ein Dialog ueber der Galerie waere
 * ein zweiter Ort, an dem etwas steht - und man muesste ihn wieder zumachen,
 * bevor man weiterarbeitet.
 */
let ansicht = 'bestand';

/** Die letzten Ordner-Zaehler, damit sie in einer Sonderansicht stehenbleiben. */
let letzteZaehlung = {};

/**
 * Sonderansichten, von studio.js angemeldet.
 *
 * Jede bringt mit, wie sie heisst, welches Symbol sie traegt, was sie ins
 * Raster zeichnet und - optional - welche Zahl am Reiter steht. Dieses
 * Modul kennt weder Vorlagen noch Einstellungen; es haelt nur die Liste.
 */
const ansichten = new Map();

export function setzeKlickZiel(fn) { beiKlick = fn; }

/**
 * @param {string} id
 * @param {{label: string, symbol: string, titel?: string,
 *          platz?: 'oben'|'unten',
 *          zahl?: () => number|string|null,
 *          lade?: () => Promise<void>, zeichne: (ziel: HTMLElement) => void,
 *          hinweis?: string}} def
 *
 * `platz` sagt, wo der Reiter steht: "oben" gleich unter "Ordner
 * einstellen", "unten" ganz am Ende, direkt ueber der Linie mit Guthaben
 * und Verbrauch. Der Unterschied ist keine Kosmetik - oben steht, womit man
 * arbeitet, unten steht, was die App selbst betrifft.
 */
export function meldeAnsicht(id, def) {
  ansichten.set(id, def);
}

/** Zurueck auf den Bestand - etwa nachdem eine Vorlage geladen wurde. */
export function zeigeBestand() {
  if (ansicht === 'bestand') return Promise.resolve();
  ansicht = 'bestand';
  return lade();
}

/**
 * Zu einer gemeldeten Ansicht umschalten, ohne dass jemand den Reiter
 * anklickt. Gebraucht fuer Hin und Zurueck: Wer in einer Vorlage ein
 * anderes Referenzbild waehlt, landet im Bestand und soll danach von
 * allein wieder bei den Vorlagen stehen.
 */
export function zeigeAnsicht(id) {
  if (!ansichten.has(id)) return Promise.resolve();
  ansicht = id;
  return lade();
}

export function baueOrdnerListe(ordner, zaehlung) {
  ordnerDefs = ordner;
  letzteZaehlung = zaehlung || letzteZaehlung;
  const liste = document.getElementById('ordnerListe');
  liste.replaceChildren();

  // Frisch installiert gibt es noch keinen Ordner. Statt einer leeren Leiste
  // steht hier, was zu tun ist - der Knopf darunter macht es dann.
  if (!ordner.length) {
    const hinweis = document.createElement('p');
    hinweis.className = 'ordner-leer';
    hinweis.textContent = 'Noch kein Ordner. Unten anlegen, dann erscheint hier die Auswahl.';
    liste.append(hinweis);
  } else {
    const eintraege = [{ id: null, label: 'Alles' }, ...ordner];
    for (const o of eintraege) {
      const knopf = document.createElement('button');
      knopf.type = 'button';
      knopf.setAttribute('aria-current', String(ansicht === 'bestand' && o.id === aktuellerOrdner));

      // Symbol bleibt auch im schmalen Modus sichtbar, Text und Zahl nicht.
      const symbol = symbolFuer(o.id);

      const name = document.createElement('span');
      name.className = 'ordner-name';
      name.textContent = o.label;
      knopf.title = o.hinweis ? `${o.label} — ${o.hinweis}` : o.label;

      const zahl = document.createElement('span');
      zahl.className = 'zahl';
      zahl.textContent = o.id
        ? (letzteZaehlung[o.id] ?? 0)
        : Object.values(letzteZaehlung).reduce((a, b) => a + b, 0);

      knopf.append(symbol, name, zahl);
      knopf.addEventListener('click', () => {
        ansicht = 'bestand';
        aktuellerOrdner = o.id;
        lade();
      });
      liste.append(knopf);
    }
  }

  // Die Sonderansichten stehen UNTER "Ordner einstellen", in einer eigenen
  // Liste. Der Schnitt ist Absicht: oben die Ordner des Nutzers, darunter
  // alles, was es nur im Studio gibt. Aussehen und Bedienung sind gleich -
  // derselbe Griff, nur eine andere Sorte Sache.
  const plaetze = {
    oben: document.getElementById('systemListe'),
    unten: document.getElementById('untenListe'),
  };
  for (const el of Object.values(plaetze)) el.replaceChildren();

  for (const [id, def] of ansichten) {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'system-reiter';
    knopf.setAttribute('aria-current', String(ansicht === id));
    if (def.hinweis) knopf.title = def.hinweis;

    const name = document.createElement('span');
    name.className = 'ordner-name';
    name.textContent = def.label;
    knopf.append(symbolFuer(def.symbol), name);

    // Eine Zahl nur, wo es etwas zu zaehlen gibt. Bei den Einstellungen
    // stuende dort sonst dauerhaft eine Null.
    const wert = def.zahl?.();
    if (wert !== null && wert !== undefined) {
      const zahl = document.createElement('span');
      zahl.className = 'zahl';
      zahl.textContent = wert;
      knopf.append(zahl);
    }

    knopf.addEventListener('click', () => {
      ansicht = id;
      lade();
    });
    (plaetze[def.platz] || plaetze.oben).append(knopf);
  }
}

/**
 * Reiter fuer Bilder und Videos.
 *
 * Sie erscheinen erst, wenn im Bestand ueberhaupt Videos liegen. Wer nur
 * Bilder macht, sieht die Leiste nie - ein Reiter, der immer "alles" heisst,
 * waere nur Platzverschwendung. Sobald das erste Video da ist, ist es mit
 * einem Klick auffindbar, statt zwischen hundert Bildern gesucht zu werden.
 */
function baueArtReiter(artZaehlung, hatVideos) {
  const leiste = document.getElementById('artReiter');
  const bilder = artZaehlung?.bild || 0;
  const videos = artZaehlung?.video || 0;

  // `hatVideos` zaehlt den Ordner vor der Suche - die Leiste bleibt also
  // stehen, auch wenn die Suche gerade kein Video trifft. Die Zahlen selbst
  // zeigen das Suchergebnis, "Videos 0" ist dann eine Antwort.
  const zeigen = hatVideos || aktuelleArt === 'video';
  leiste.replaceChildren();
  leiste.hidden = !zeigen;
  if (!zeigen) return;
  for (const [art, name, zahl] of [
    [null, 'Alle', bilder + videos],
    ['bild', 'Bilder', bilder],
    ['video', 'Videos', videos],
  ]) {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'reiter';
    knopf.setAttribute('aria-current', String(art === aktuelleArt));

    const beschriftung = document.createElement('span');
    beschriftung.textContent = name;
    const zaehler = document.createElement('span');
    zaehler.className = 'reiter-zahl';
    zaehler.textContent = zahl;

    knopf.append(beschriftung, zaehler);
    knopf.addEventListener('click', () => {
      if (art === aktuelleArt) return;
      aktuelleArt = art;
      lade();
    });
    leiste.append(knopf);
  }
}

function ohneEndung(name) {
  const punkt = name.lastIndexOf('.');
  return punkt > 0 ? name.slice(0, punkt) : name;
}

/**
 * Namen an Ort und Stelle bearbeiten.
 * Enter speichert, Escape bricht ab, Klick daneben speichert ebenfalls.
 * Umbenannt wird die echte Datei samt Sidecar, nicht nur die Anzeige.
 */
function starteUmbenennen(titelEl, eintrag, karteEl) {
  if (titelEl.querySelector('input')) return;

  const alt = ohneEndung(eintrag.name);
  const feld = document.createElement('input');
  feld.type = 'text';
  feld.className = 'titel-feld';
  feld.value = alt;
  feld.spellcheck = false;

  titelEl.textContent = '';
  titelEl.append(feld);
  feld.focus();
  feld.select();

  let fertig = false;

  const zurueck = (text) => {
    fertig = true;
    titelEl.textContent = text;
  };

  const speichern = async () => {
    if (fertig) return;
    const neu = feld.value.trim();
    if (!neu || neu === alt) { zurueck(alt); return; }
    fertig = true;
    try {
      const ergebnis = await api.umbenennen(eintrag.pfad, neu);
      eintrag.pfad = ergebnis.pfad;
      eintrag.name = ergebnis.name;
      titelEl.textContent = ohneEndung(ergebnis.name);
      titelEl.classList.remove('fehler');
      // Bewusst kein lade(): das wuerde die Karte mitten im Speichern
      // austauschen und das Eingabefeld haengen lassen. Stattdessen nur
      // die Quelle nachziehen, denn der Pfad steckt in der Adresse.
      const medium = karteEl?.querySelector('img, video');
      if (medium) medium.src = dateiUrl(ergebnis.pfad);
    } catch (fehler) {
      titelEl.textContent = alt;
      titelEl.classList.add('fehler');
      titelEl.title = fehler.message;
      setTimeout(() => {
        titelEl.classList.remove('fehler');
        titelEl.title = 'Klicken zum Umbenennen';
      }, 3500);
    }
  };

  feld.addEventListener('click', (e) => e.stopPropagation());
  feld.addEventListener('blur', speichern);
  feld.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); speichern(); }
    if (e.key === 'Escape') { e.preventDefault(); zurueck(alt); }
  });
}

/**
 * Der Papierkorb oben links auf der Karte.
 *
 * Sichtbar erst beim Ueberfahren - eine Galerie mit einem Loeschsymbol auf
 * jeder Kachel waere eine Wand aus Muelltonnen.
 *
 * ZWEI STUFEN, und hier noch wichtiger als in einem Dialog: In einem Raster
 * bewegt man die Maus schnell und klickt beilaeufig. Der erste Klick faerbt
 * nur ein und fragt; nach acht Sekunden ist er wieder harmlos. Ein Symbol,
 * das beim ersten Klick loescht, waere in einer Galerie fahrlaessig.
 *
 * stopPropagation ueberall: sonst oeffnet der Klick zusaetzlich die
 * Detailansicht des Bildes, das man gerade wegwirft.
 */
function papierkorbKnopf(eintrag, karteEl) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'karte-loescht';
  b.title = 'In den Papierkorb — von dort holst du die Datei zurück';
  b.setAttribute('aria-label', `${eintrag.name} in den Papierkorb`);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const pfad = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pfad.setAttribute('d', 'M4 7h16 M10 4h4 M6 7l1 13h10l1-13 M10 11v6 M14 11v6');
  svg.append(pfad);
  b.append(svg);

  let gefragt = false;
  let uhr = null;
  const zurueck = () => {
    gefragt = false;
    b.classList.remove('gefragt');
    b.title = 'In den Papierkorb — von dort holst du die Datei zurück';
  };

  b.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!gefragt) {
      gefragt = true;
      b.classList.add('gefragt');
      b.title = 'Nochmal klicken: in den Papierkorb';
      clearTimeout(uhr);
      uhr = setTimeout(zurueck, 8000);
      return;
    }
    clearTimeout(uhr);
    b.disabled = true;
    try {
      await api.loeschen(eintrag.pfad);
      // Die Karte sofort ausblenden, nicht erst nach dem Nachladen - sonst
      // steht sie noch da und man klickt ein zweites Mal.
      karteEl.classList.add('geht-weg');
      await lade();
    } catch (fehler) {
      b.disabled = false;
      zurueck();
      b.title = `Ging nicht: ${fehler.message}`;
    }
  });

  // Nicht mit der Karte mit-navigieren, wenn jemand sich durchtabbt.
  b.addEventListener('keydown', (e) => e.stopPropagation());
  return b;
}

function karte(eintrag) {
  const el = document.createElement('article');
  el.className = 'karte';

  const vorschau = document.createElement('div');
  vorschau.className = 'vorschau';
  if (eintrag.art === 'video') {
    const v = document.createElement('video');
    v.src = dateiUrl(eintrag.pfad);
    v.muted = true;
    v.playsInline = true;
    v.preload = 'metadata';

    // Klar sichtbar machen, dass es ein Video ist: Marke, Abspielsymbol, Dauer.
    const marke = document.createElement('span');
    marke.className = 'video-marke';
    marke.textContent = 'VIDEO';

    const abspiel = document.createElement('span');
    abspiel.className = 'abspiel';

    const dauer = document.createElement('span');
    dauer.className = 'dauer';
    v.addEventListener('loadedmetadata', () => {
      if (!Number.isFinite(v.duration)) return;
      const min = Math.floor(v.duration / 60);
      const sek = Math.round(v.duration % 60);
      dauer.textContent = `${min}:${String(sek).padStart(2, '0')}`;
    });

    // Beim Ueberfahren kurz anspielen - macht sofort klar, dass es laeuft.
    el.addEventListener('mouseenter', () => v.play().catch(() => {}));
    el.addEventListener('mouseleave', () => { v.pause(); v.currentTime = 0; });

    vorschau.append(v, marke, abspiel, dauer);
  } else {
    const bild = document.createElement('img');
    bild.src = dateiUrl(eintrag.pfad);
    bild.alt = eintrag.motiv || eintrag.name;
    bild.loading = 'lazy';
    vorschau.append(bild);
  }

  // Zuletzt in die Vorschau, damit er ueber dem VIDEO-Abzeichen liegt -
  // beide sitzen oben links. Beim Ueberfahren tritt das Abzeichen zurueck.
  vorschau.append(papierkorbKnopf(eintrag, el));

  const fuss = document.createElement('div');
  fuss.className = 'fuss';

  // Zeigt den echten Dateinamen - Klick darauf benennt die Datei um.
  const titel = document.createElement('div');
  titel.className = 'titel';
  titel.tabIndex = 0;
  titel.title = 'Klicken zum Umbenennen';
  titel.textContent = ohneEndung(eintrag.name);
  titel.addEventListener('click', (e) => {
    e.stopPropagation();      // nicht die Detailansicht oeffnen
    starteUmbenennen(titel, eintrag, el);
  });

  const unter = document.createElement('div');
  unter.className = 'unter';
  const datum = new Date(eintrag.geaendert).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  unter.textContent = [datum, eintrag.modell || '', eintrag.format || ''].filter(Boolean).join(' · ');

  const merker = document.createElement('div');
  merker.className = 'merker';
  if (eintrag.favorit) {
    const s = document.createElement('span');
    s.className = 'favorit';
    s.textContent = 'Favorit';
    merker.append(s);
  }
  if (eintrag.freigegeben) {
    const s = document.createElement('span');
    s.className = 'frei';
    s.textContent = 'Freigegeben';
    merker.append(s);
  }

  fuss.append(titel, unter);
  if (merker.children.length) fuss.append(merker);
  el.append(vorschau, fuss);
  el.addEventListener('click', () => beiKlick(eintrag));
  return el;
}

/** Was im Raster steht, wenn nichts uebrig bleibt - je nach Grund. */
function leerText() {
  if (!ordnerDefs.length) {
    return 'Noch kein Ordner eingerichtet. Links auf "Ordner einstellen" und '
      + 'festlegen, woher die Bilder kommen und wohin gespeichert wird.';
  }
  if (suchwort) return `Nichts gefunden fuer "${suchwort}".`;
  if (nurFavoriten) return 'Keine Favoriten in dieser Auswahl.';
  if (aktuelleArt === 'video') return 'Keine Videos in diesem Ordner.';
  return 'Noch nichts hier. Oben ein Motiv beschreiben und erzeugen.';
}

export async function lade() {
  const ziel = rasterEl();

  // Sonderansicht: eigener Inhalt, aber dasselbe Raster. Suche,
  // Favoriten-Haken und die Bild/Video-Reiter gehoeren zum Bestand und
  // bleiben hier aussen vor - sie haetten nichts zu filtern.
  const sonder = ansichten.get(ansicht);
  if (sonder) {
    titelEl().textContent = sonder.titel || sonder.label;
    document.getElementById('artReiter').hidden = true;
    await sonder.lade?.();
    baueOrdnerListe(ordnerDefs, letzteZaehlung);
    ziel.replaceChildren();
    sonder.zeichne(ziel);
    return;
  }

  const def = ordnerDefs.find((o) => o.id === aktuellerOrdner);
  const artName = { bild: 'Bilder', video: 'Videos' }[aktuelleArt];
  titelEl().textContent = [def ? def.label : 'Bestand', artName]
    .filter(Boolean).join(' · ');

  try {
    const { eintraege, zaehlung, artZaehlung, hatVideos } = await api.bestand({
      ordner: aktuellerOrdner,
      art: aktuelleArt,
      nurFavoriten,
      suche: suchwort,
    });
    baueOrdnerListe(ordnerDefs, zaehlung);
    baueArtReiter(artZaehlung, hatVideos);
    ziel.replaceChildren();

    if (!eintraege.length) {
      const leer = document.createElement('div');
      leer.className = 'leer';
      leer.textContent = leerText();
      ziel.append(leer);
      return;
    }

    for (const e of eintraege) ziel.append(karte(e));
  } catch (fehler) {
    ziel.replaceChildren();
    const leer = document.createElement('div');
    leer.className = 'leer';
    leer.textContent = `Bestand konnte nicht geladen werden: ${fehler.message}`;
    ziel.append(leer);
  }
}

export function setzeFavoritenFilter(an) {
  nurFavoriten = an;
  // Filtern heisst: der Bestand ist gemeint. In der Vorlagen-Ansicht haette
  // der Haken nichts zu filtern und saehe aus, als sei er kaputt.
  ansicht = 'bestand';
  return lade();
}

/**
 * Suchfeld.
 *
 * Gesucht wird auf dem Server, quer durch Dateiname, Motiv, vollen Prompt,
 * Modell und Bildunterschrift. Getippt wird schneller als gesucht, deshalb
 * laeuft die Anfrage erst 250 ms nach dem letzten Tastendruck - sonst
 * schickt jeder Buchstabe eine eigene Runde ueber die Platte.
 */
export function verdrahte() {
  const feld = document.getElementById('sucheFeld');
  const weg = document.getElementById('sucheWeg');
  let warte = null;

  const uebernehmen = () => {
    clearTimeout(warte);
    const neu = feld.value.trim();
    if (neu === suchwort && ansicht === 'bestand') return;
    suchwort = neu;
    // Gesucht wird im Bestand. Wer in den Vorlagen steht und zu tippen
    // anfaengt, meint die Bilder - sonst passiert auf den Tastendruck nichts.
    ansicht = 'bestand';
    lade();
  };

  const leeren = () => {
    feld.value = '';
    weg.hidden = true;
    uebernehmen();
    feld.focus();
  };

  feld.addEventListener('input', () => {
    weg.hidden = !feld.value;
    clearTimeout(warte);
    warte = setTimeout(uebernehmen, 250);
  });

  feld.addEventListener('keydown', (e) => {
    // Nicht nach oben durchreichen: Escape schliesst sonst noch Dialoge mit.
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); uebernehmen(); }
    if (e.key === 'Escape') { e.preventDefault(); leeren(); }
  });

  weg.addEventListener('click', leeren);
}
