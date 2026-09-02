// Verdrahtung. Holt den Startzustand und verbindet die Module.
// Selbst keine Fachlogik.

import { api } from './api.js';
import * as raster from './raster.js';
import * as erzeugen from './erzeugen.js';
import * as detail from './detail.js';
import * as referenz from './referenz.js';
import * as verlauf from './verlauf.js';
import * as verlaufFenster from './verlauf-fenster.js';
import * as texteditor from './texteditor.js';
import * as ordner from './ordner.js';
import * as chat from './chat.js';

const el = (id) => document.getElementById(id);

const ENV_ZEILE = 'OPENROUTER_API_KEY=sk-or-v1-dein-schluessel';
const OR_BEFEHL = '[Environment]::SetEnvironmentVariable("OPENROUTER_API_KEY","DEIN_KEY","User")';

/** Baut einen Textblock, der beim Anklicken in die Zwischenablage geht. */
function kopierBlock(inhalt, bestaetigung) {
  const feld = document.createElement('div');
  feld.className = 'schluessel-tipp';
  feld.title = 'Klicken zum Kopieren';
  feld.textContent = inhalt;
  feld.addEventListener('click', async () => {
    await navigator.clipboard.writeText(inhalt);
    const alt = feld.textContent;
    feld.textContent = bestaetigung;
    setTimeout(() => { feld.textContent = alt; }, 2600);
  });
  return feld;
}

let guthabenStand = null;

/**
 * Eine Fusszeile: Beschriftung links, Zahl rechts.
 *
 * Alle Angaben im Fuss haben dieselbe Form, damit die Zahlen untereinander
 * stehen und man sie mit einem Blick vergleichen kann. Was sonst noch
 * dazugehoert, haengt als Titel dran - der Fuss soll drei Zeilen bleiben,
 * nicht sieben.
 */
function fussZeile(beschriftung, zahl, { titel = '', warnung = false, punkt = null } = {}) {
  const zeile = document.createElement('div');
  zeile.className = 'fuss-zeile';
  if (warnung) zeile.classList.add('fuss-warnung');
  if (titel) zeile.title = titel;

  const links = document.createElement('span');
  links.className = 'fuss-name';
  if (punkt !== null) {
    const i = document.createElement('i');
    i.className = `punkt${punkt ? ' an' : ''}`;
    links.append(i);
  }
  links.append(document.createTextNode(beschriftung));

  const rechts = document.createElement('b');
  rechts.textContent = zahl;

  zeile.append(links, rechts);
  return zeile;
}

function zeigeAnbieter(anbieter, schluessel = {}) {
  const ziel = el('anbieterStand');
  ziel.replaceChildren();

  const an = Boolean(anbieter.openrouter);

  // Woher der Schluessel kommt, steht im Titel statt in einer eigenen
  // Zeile: gebraucht wird die Angabe nur, wenn etwas nicht stimmt.
  const herkunft = { datei: 'Schlüssel aus .env', umgebung: 'Schlüssel aus der Umgebung' }[schluessel.quelle];
  const titel = [
    'Bilder, Video und Referenzbilder laufen über OpenRouter',
    herkunft,
    schluessel.quelle === 'umgebung' && schluessel.envVorhanden
      ? 'Die Umgebungsvariable sticht die .env aus.'
      : null,
  ].filter(Boolean).join(' — ');

  if (!an) {
    ziel.append(fussZeile('OpenRouter', 'kein Schlüssel', { punkt: false, warnung: true }));
    zeigeSchluesselWege(ziel);
    return;
  }

  const uebrig = guthabenStand?.uebrig;
  const leer = typeof uebrig === 'number' && uebrig <= 0;
  ziel.append(fussZeile('OpenRouter', typeof uebrig === 'number' ? geld(uebrig) : 'bereit', {
    titel: leer ? 'Guthaben aufgebraucht — https://openrouter.ai/settings/credits' : titel,
    warnung: leer,
    punkt: true,
  }));
}

/**
 * Beide Wege, den Schluessel zu hinterlegen. Nur sichtbar, solange keiner
 * da ist - dann laeuft ohnehin nichts, und der Platz ist gut angelegt.
 * Eingegeben wird er NIE im Browser.
 */
function zeigeSchluesselWege(ziel) {
  const weg1 = document.createElement('div');
  weg1.className = 'schluessel-weg';
  weg1.textContent = 'Weg 1 — Datei .env neben der App:';
  ziel.append(weg1, kopierBlock(ENV_ZEILE,
    'Kopiert — in eine Datei namens .env schreiben, dann neu starten'));

  const weg2 = document.createElement('div');
  weg2.className = 'schluessel-weg';
  weg2.textContent = 'Weg 2 — als Umgebungsvariable (Windows):';
  ziel.append(weg2, kopierBlock(OR_BEFEHL,
    'Kopiert — in PowerShell einfügen, Key ersetzen, dann start.ps1 neu'));
}

/** Betrag in deutscher Schreibweise. Kleinstbetraege in Cent, sonst Dollar. */
function geld(betrag) {
  // toFixed liefert immer einen Punkt - untereinander sahen "9.03 $" und
  // "0,00 $" im Fuss aus wie zwei verschiedene Anzeigen.
  const komma = (zahl) => zahl.toFixed(2).replace('.', ',');
  if (!betrag) return '0,00 $';
  return betrag < 0.01 ? `${komma(betrag * 100)} ¢` : `${komma(betrag)} $`;
}

/**
 * Verbrauchsanzeige.
 *
 * Alle Betraege sind das, was OpenRouter nach dem Lauf selbst zurueckgemeldet
 * hat - nichts davon ist geschaetzt oder hochgerechnet.
 */
function zeigeVerbrauch(v) {
  const ziel = el('verbrauch');
  ziel.replaceChildren();

  const stueck = [
    v.bilder ? `${v.bilder} Bild(er)` : null,
    v.clips ? `${v.clips} Clip(s)` : null,
  ].filter(Boolean).join(', ');

  ziel.append(fussZeile(stueck ? `Heute · ${stueck}` : 'Heute', geld(v.dollar), {
    titel: 'Was OpenRouter heute tatsächlich abgerechnet hat — Bilder, Clips und Chat zusammen',
  }));

  // Die Chat-Zeile erscheint nur, wenn heute wirklich geredet wurde. Sonst
  // stuende dauerhaft eine Null im Fuss, und drei Zeilen sollen es bleiben.
  // Getrennt, weil die Groessenordnungen weit auseinanderliegen: ein Bild
  // kostet so viel wie hundert Gespraechszuege.
  if (v.chatDollar) {
    ziel.append(fussZeile('davon Chat', geld(v.chatDollar), {
      titel: 'Textmarken des Assistenten. Der Rest ging aufs Erzeugen.',
    }));
  }

  ziel.append(fussZeile('Insgesamt', geld(v.gesamtDollar), {
    titel: v.gesamtChatDollar
      ? `Alles, was je über dieses Werkzeug gelaufen ist — davon ${geld(v.gesamtChatDollar)} Chat`
      : 'Alles, was je über dieses Werkzeug gelaufen ist',
  }));
}

function verdrahteStil(startStil, standardStil, stilDatei) {
  el('stilText').value = startStil;

  // Pfad anzeigen: der Block ist eine echte Datei und laesst sich auch
  // ausserhalb der App bearbeiten. Aenderungen greifen sofort, weil bei
  // jedem Prompt neu gelesen wird.
  if (stilDatei) {
    const pfad = el('stilPfad');
    pfad.textContent = stilDatei;
    pfad.title = 'Klicken zum Kopieren — die Datei lässt sich auch im Editor bearbeiten';
    pfad.addEventListener('click', async () => {
      await navigator.clipboard.writeText(stilDatei);
      const alt = pfad.textContent;
      pfad.textContent = 'Pfad kopiert';
      setTimeout(() => { pfad.textContent = alt; }, 1600);
    });
  }

  el('stilKnopf').addEventListener('click', () => {
    const feld = el('stilFeld');
    feld.hidden = !feld.hidden;
    el('stilKnopf').textContent = feld.hidden ? 'Stil-Block ansehen' : 'Stil-Block zuklappen';
  });

  el('stilSpeichern').addEventListener('click', async () => {
    const knopf = el('stilSpeichern');
    knopf.disabled = true;
    try {
      const { stil } = await api.stilSpeichern(el('stilText').value);
      el('stilText').value = stil;
      knopf.textContent = 'Gespeichert';
      setTimeout(() => { knopf.textContent = 'Speichern'; }, 1500);
    } finally {
      knopf.disabled = false;
    }
  });

  el('stilZuruecksetzen').addEventListener('click', async () => {
    const { stil } = await api.stilSpeichern('');
    el('stilText').value = stil || standardStil;
  });
}

/** Breitenunterschied der Seitenleiste zwischen offen und schmal. */
const LEISTE_DELTA = 248 - 68;
const ANIMATION_MS = 200;

/** Seitenleiste ein- und ausklappen. Der Burger selbst bleibt, wo er ist. */
function verdrahteBurger() {
  const knopf = el('burger');
  const haupt = document.querySelector('.haupt');
  let laeuft = null;

  const setze = (zu) => {
    document.body.classList.toggle('zu', zu);
    knopf.setAttribute('aria-expanded', String(!zu));
  };

  setze(localStorage.getItem('kynto-leiste-zu') === '1');

  knopf.addEventListener('click', () => {
    const zu = !document.body.classList.contains('zu');

    // Vor dem Umschalten die kuenftige Innenbreite ausrechnen und die
    // Spaltenzahl darauf festnageln - sonst springen die Kacheln waehrend
    // der Bewegung mehrfach um.
    const stil = getComputedStyle(haupt);
    const innen = haupt.clientWidth
      - parseFloat(stil.paddingLeft) - parseFloat(stil.paddingRight);
    raster.friereSpalten(innen + (zu ? LEISTE_DELTA : -LEISTE_DELTA));

    setze(zu);
    localStorage.setItem('kynto-leiste-zu', zu ? '1' : '0');

    clearTimeout(laeuft);
    laeuft = setTimeout(raster.loeseSpalten, ANIMATION_MS + 60);
  });
}

async function los() {
  const start = await api.start();

  guthabenStand = start.guthaben;
  zeigeAnbieter(start.anbieter, start.schluessel);
  zeigeVerbrauch(start.verbrauch);
  verdrahteStil(start.stil, start.standardStil, start.stilDatei);

  raster.baueOrdnerListe(start.ordner, start.zaehlung);
  raster.setzeKlickZiel(detail.zeige);
  raster.verdrahte();
  detail.setzeAenderungsZiel(raster.lade);
  detail.setzeReferenzZiel(referenz.setze);
  detail.setzeTextZiel(texteditor.oeffne);
  detail.verdrahte();

  texteditor.setzeDaten(start);
  texteditor.setzeSpeicherZiel(raster.lade);
  texteditor.verdrahte();

  // Nach geaenderten Ordnern die Seitenleiste und das Raster neu aufbauen -
  // Namen, Reihenfolge und Zaehler koennen sich komplett geaendert haben.
  ordner.setzeSpeicherZiel(async () => {
    const frisch = await api.start();
    raster.baueOrdnerListe(frisch.ordner, frisch.zaehlung);
    await raster.lade();
  });
  ordner.verdrahte();

  erzeugen.baueRegler(start);
  erzeugen.setzeCallbacks({ fertig: raster.lade, verbrauch: zeigeVerbrauch });
  erzeugen.verdrahte();

  el('nurFavoriten').addEventListener('change', (e) => {
    raster.setzeFavoritenFilter(e.target.checked);
  });

  chat.setzeDaten(start);
  chat.setzeCallbacks({ fertig: raster.lade, verbrauch: zeigeVerbrauch });
  chat.verdrahte();

  verdrahteBurger();

  // Live-Verlauf: zeigt auch, was Claude von aussen ausloest.
  // Eine Live-Verbindung, zwei Abnehmer: die Galerie laedt nach, das
  // Verlaufsfenster zeichnet nach.
  verlaufFenster.verdrahte();
  verlauf.setzeNachladeZiel(raster.lade);
  verlauf.setzeEreignisZiel(verlaufFenster.ergaenze);
  verlauf.verbinde();

  await raster.lade();
  await erzeugen.aktualisiereSchaetzung();
}

los().catch((fehler) => {
  document.body.replaceChildren();
  const box = document.createElement('div');
  box.style.cssText = 'padding:40px;color:#e6e8ec;font:14px system-ui';
  box.textContent = `Kynto Studio konnte nicht starten: ${fehler.message}`;
  document.body.append(box);
});
