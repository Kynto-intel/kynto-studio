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
import * as vorlagen from './vorlagen.js';
import * as einstellungen from './einstellungen.js';
import * as regie from './regie.js';
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

  // Steht eine Tagesgrenze, gehoert sie neben den Betrag: sonst sieht man
  // erst beim Ablehnen, dass es eine gab.
  const grenze = v.grenzen?.gesamt || null;
  ziel.append(fussZeile(stueck ? `Heute · ${stueck}` : 'Heute',
    grenze ? `${geld(v.dollar)} / ${geld(grenze)}` : geld(v.dollar), {
      titel: grenze
        ? `Was OpenRouter heute abgerechnet hat, gegen die Tagesgrenze von ${geld(grenze)}`
        : 'Was OpenRouter heute tatsächlich abgerechnet hat — Bilder, Clips und Chat zusammen',
      warnung: Boolean(grenze) && v.dollar >= grenze,
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

/**
 * Das Stil-Feld unten im Komponisten.
 *
 * EIN Feld fuer zwei Bloecke: Steht der Komponist auf Bild, zeigt es den
 * Bild-Block, steht er auf Video, den fuer Clips. Zwei Felder nebeneinander
 * waeren die naheliegende Loesung gewesen und die schlechtere - man schreibt
 * ohnehin immer in den, mit dem man gerade arbeitet, und im eingeklappten
 * Fuss ist kein Platz fuer den doppelten Kasten.
 *
 * Was in dem Feld steht, wird beim Umschalten NICHT gerettet. Wer tippt und
 * dann die Gattung wechselt, verliert den Entwurf. Vertretbar, weil der
 * Wechsel ein bewusster Klick ist - aber deshalb steht die Gattung auch in
 * der Beschriftung, damit niemand in den falschen Block schreibt.
 */
function verdrahteStil(start) {
  const bloecke = {
    bild: {
      text: start.stil,
      standard: start.standardStil,
      datei: start.stilDatei,
      label: 'Stil-Block Bild — hängt automatisch an jeden Bild-Prompt',
    },
    video: {
      text: start.stilVideo,
      standard: start.standardStilVideo,
      datei: start.stilVideoDatei,
      label: 'Stil-Block Video — hängt automatisch an jeden Clip',
    },
  };
  let art = 'bild';

  const beschriftung = el('stilText').closest('label');

  // Pfad anzeigen: der Block ist eine echte Datei und laesst sich auch
  // ausserhalb der App bearbeiten. Aenderungen greifen sofort, weil bei
  // jedem Prompt neu gelesen wird.
  const pfad = el('stilPfad');
  pfad.title = 'Klicken zum Kopieren — die Datei lässt sich auch im Editor bearbeiten';
  pfad.addEventListener('click', async () => {
    await navigator.clipboard.writeText(bloecke[art].datei || '');
    const alt = pfad.textContent;
    pfad.textContent = 'Pfad kopiert';
    setTimeout(() => { pfad.textContent = alt; }, 1600);
  });

  // Wie viele frueheren Fassungen aufgehoben sind. Ohne diese Zeile wuesste
  // niemand, dass der Ordner existiert - und ein Archiv, das man nicht
  // kennt, hilft im Ernstfall nicht.
  const fassungen = document.createElement('div');
  fassungen.className = 'stil-pfad stil-fassungen';
  fassungen.title = 'Klicken zum Kopieren — hier liegen die früheren Fassungen';
  fassungen.addEventListener('click', async () => {
    await navigator.clipboard.writeText(start.textVerlauf?.ordner || '');
    const alt = fassungen.textContent;
    fassungen.textContent = 'Ordner kopiert';
    setTimeout(() => { fassungen.textContent = alt; }, 1600);
  });
  pfad.after(fassungen);

  const zeige = () => {
    const b = bloecke[art];
    el('stilText').value = b.text;
    pfad.textContent = b.datei || '';
    // Erstes Kind des <label> ist der Textknoten vor dem Feld - genau der
    // soll wechseln, das Textfeld daneben bleibt stehen.
    if (beschriftung) beschriftung.firstChild.nodeValue = b.label;

    const n = art === 'video'
      ? start.textVerlauf?.stilVideo
      : start.textVerlauf?.stil;
    fassungen.textContent = n
      ? `${n} frühere ${n === 1 ? 'Fassung' : 'Fassungen'} aufgehoben — ${start.textVerlauf.ordner}`
      : '';
    fassungen.hidden = !n;
  };
  zeige();

  // Beim Umschalten der Gattung wandert das Feld auf den anderen Block.
  erzeugen.setzeCallbacks({
    gattung: (neu) => {
      art = neu === 'video' ? 'video' : 'bild';
      zeige();
    },
  });

  el('stilKnopf').addEventListener('click', () => {
    const feld = el('stilFeld');
    feld.hidden = !feld.hidden;
    el('stilKnopf').textContent = feld.hidden ? 'Stil-Block ansehen' : 'Stil-Block zuklappen';
  });

  el('stilSpeichern').addEventListener('click', async () => {
    const knopf = el('stilSpeichern');
    knopf.disabled = true;
    try {
      const { stil } = await api.stilSpeichern(el('stilText').value, art);
      bloecke[art].text = stil;
      el('stilText').value = stil;
      knopf.textContent = 'Gespeichert';
      setTimeout(() => { knopf.textContent = 'Speichern'; }, 1500);
    } finally {
      knopf.disabled = false;
    }
  });

  el('stilZuruecksetzen').addEventListener('click', async () => {
    const { stil } = await api.stilSpeichern('', art);
    bloecke[art].text = stil || bloecke[art].standard;
    el('stilText').value = bloecke[art].text;
  });
}

/**
 * Die Hoehe der Leiste unten an das Raster melden.
 *
 * Sie ist nicht konstant: Referenzbild, Hinweiszeile und das aufgeklappte
 * "Mehr" machen sie hoeher. Stand im CSS ein fester Rand, verschwand je
 * nach Zustand die unterste Zeile des Rasters dahinter - gefunden an den
 * Speichern-Knoepfen im Vorlagen-Formular, die man nicht mehr sah.
 *
 * MutationObserver und NICHT ResizeObserver: der Resize-Beobachter liefert
 * ueber den Zeichentakt aus und schweigt, solange das Fenster nicht
 * gezeichnet wird - gemessen am 6.9.2026, im versteckten Tab kam nicht
 * einmal der erste Aufruf. Die Hoehe aendert sich hier ohnehin nur, wenn
 * Elemente dazukommen, verschwinden oder ihr hidden umspringt, und genau
 * das sieht der MutationObserver sofort.
 */
function verdrahteLeistenhoehe() {
  const leiste = document.querySelector('footer.leiste');
  if (!leiste) return;

  const melde = () => {
    document.body.style.setProperty('--leiste-hoehe', `${Math.round(leiste.offsetHeight)}px`);
  };
  melde();

  new MutationObserver(melde).observe(leiste, {
    attributes: true, attributeFilter: ['hidden', 'style', 'class'],
    childList: true, subtree: true,
  });
  // Ein schmaleres Fenster bricht die Zeilen um und macht die Leiste hoeher.
  window.addEventListener('resize', melde);
  // Tippen im Motivfeld laesst es wachsen - das sieht keine Mutation.
  el('motiv')?.addEventListener('input', melde);
}

/** Breitenunterschied der Seitenleiste zwischen offen und schmal. */
const LEISTE_DELTA = 248 - 68;
const ANIMATION_MS = 200;

/** OpenRouter-Fussbereich ein- und ausklappen. */
function verdrahteFuss() {
  const block = el('fussBlock');
  const knopf = el('fussKnopf');
  if (!block || !knopf) return;

  const setze = (zu) => {
    block.classList.toggle('zu', zu);
    knopf.setAttribute('aria-expanded', String(!zu));
    knopf.setAttribute('aria-label', zu ? 'OpenRouter-Bereich aufklappen' : 'OpenRouter-Bereich einklappen');
  };

  const gespeicherterWert = localStorage.getItem('kynto-fuss-zu');
  setze(gespeicherterWert === null ? true : gespeicherterWert === '1');

  knopf.addEventListener('click', () => {
    const zu = !block.classList.contains('zu');
    setze(zu);
    localStorage.setItem('kynto-fuss-zu', zu ? '1' : '0');
  });
}

/** Seitenleiste ein- und ausklappen. Der Burger selbst bleibt, wo er ist. */
function verdrahteBurger() {
  const knopf = el('burger');
  const haupt = document.querySelector('.haupt');
  let laeuft = null;

  const setze = (zu) => {
    document.body.classList.toggle('zu', zu);
    knopf.setAttribute('aria-expanded', String(!zu));
  };

  setze(localStorage.getItem('kynto-leiste-zu') === '1' || localStorage.getItem('kynto-leiste-zu') === null);

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
  verdrahteStil(start);

  // Die Sonderansichten zuerst anmelden: die Seitenleiste zeichnet ihre
  // Reiter samt Zahl mit, und alles steht schon vor dem ersten Aufbau bereit.
  //
  // Nach dem Laden einer Vorlage zurueck auf den Bestand: das Motiv steht
  // dann unten im Komponisten, und gleich soll man sehen, was dabei
  // herauskommt. In der Vorlagen-Ansicht stehenzubleiben hiesse, das
  // Ergebnis zu verpassen.
  vorlagen.setzeDaten(start);
  vorlagen.setzeLadeZiel((v) => {
    erzeugen.ladeVorlage(v);
    raster.zeigeBestand();
  });
  vorlagen.setzeAenderungsZiel(raster.lade);

  // Ein anderes Referenzbild fuer eine Vorlage aussuchen: kein eigener
  // Bildwaehler, sondern die Galerie, die es schon gibt. Der naechste Klick
  // darin geht einmalig an die Vorlage statt an die Detailansicht.
  let waehltBild = false;
  vorlagen.setzeBildwahlZiel(() => {
    waehltBild = true;
    raster.zeigeBestand();
  });

  raster.meldeAnsicht('vorlagen', {
    label: 'Vorlagen',
    symbol: '__vorlagen__',
    hinweis: 'Gespeicherte Läufe — anklicken lädt sie in den Komponisten',
    zahl: () => vorlagen.anzahl(),
    // Wer von Hand hierher zurueckkehrt, hat die Bildwahl abgebrochen -
    // sonst bliebe sie scharf und der naechste Klick in der Galerie ginge
    // ins Leere statt in die Detailansicht.
    lade: async () => { waehltBild = false; await vorlagen.lade(); },
    zeichne: vorlagen.zeichne,
  });

  // Die Regie zeichnet sich in die Einstellungen hinein, sie hat keine
  // eigene Ansicht mehr - zwei Punkte fuer Dinge, die man selten anfasst,
  // waren einer zu viel.
  regie.setzeDaten(start);

  einstellungen.setzeDaten(start);
  // Eine geaenderte Grenze aendert sofort, was im Fuss der Leiste steht.
  einstellungen.setzeAenderungsZiel(async () => {
    zeigeVerbrauch((await api.grenzen()).verbrauch);
  });
  // Ganz nach unten, direkt ueber Guthaben und Verbrauch: die Einstellungen
  // sind nichts, womit man arbeitet, sondern etwas, das man selten anfasst -
  // und sie gehoeren thematisch zu den Zahlen darunter.
  raster.meldeAnsicht('einstellungen', {
    label: 'Einstellungen',
    symbol: '__einstellungen__',
    titel: 'Einstellungen',
    platz: 'unten',
    hinweis: 'Tagesgrenzen — was höchstens ausgegeben werden darf',
    lade: einstellungen.lade,
    zeichne: einstellungen.zeichne,
  });

  raster.baueOrdnerListe(start.ordner, start.zaehlung);
  raster.setzeKlickZiel((eintrag) => {
    if (waehltBild && vorlagen.bearbeitetGerade()) {
      waehltBild = false;
      vorlagen.nimmBild(eintrag);
      raster.zeigeAnsicht('vorlagen');
      return;
    }
    detail.zeige(eintrag);
  });
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

  verdrahteFuss();
  verdrahteBurger();
  verdrahteLeistenhoehe();

  // Live-Verlauf: zeigt auch, was Claude von aussen ausloest.
  // Eine Live-Verbindung, zwei Abnehmer: die Galerie laedt nach, das
  // Verlaufsfenster zeichnet nach.
  verlaufFenster.verdrahte();

  // Klick auf eine Miniatur im Verlauf oeffnet dieselbe Detailansicht wie
  // ein Klick in der Galerie. Der Verlauf kennt nur den Pfad, alles Weitere
  // - Sidecar, Ordner, Art - holt der Server dazu.
  verlaufFenster.setzeOeffnenZiel(async (pfad) => {
    try {
      const { eintrag } = await api.eintrag(pfad);
      verlaufFenster.schliesseFenster();
      detail.zeige(eintrag);
    } catch (fehler) {
      window.alert(fehler.message);
    }
  });
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
