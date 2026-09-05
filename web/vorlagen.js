// Vorlagen: gespeicherte Laeufe wieder aufrufen.
//
// Kein eigenes Fenster. Die Vorlagen sind ein Reiter in der Seitenleiste
// wie die Ordner und fuellen dasselbe Raster wie die Bilder - gleiche
// Karten, gleiche Groesse. Ein Fenster ueber der Galerie waere eine zweite
// Art, Bilder anzusehen, und man haette zwei Orte fuer dieselbe Sache.
//
// Dieses Modul zeichnet nur und laedt. Wer den Reiter umschaltet, ist
// raster.js; was mit einer geladenen Vorlage passiert, entscheidet
// erzeugen.js ueber setzeLadeZiel.

import { api, dateiUrl } from './api.js';

let liste = [];
let beiLaden = () => {};
let beiAenderung = () => {};

export function setzeLadeZiel(fn) { beiLaden = fn; }
export function setzeAenderungsZiel(fn) { beiAenderung = fn; }

/** Startbestand aus /api/start, damit der erste Klick nicht warten muss. */
export function setzeDaten({ vorlagen = [] } = {}) {
  liste = Array.isArray(vorlagen) ? vorlagen : [];
}

/** Fuer die Zahl am Reiter. */
export function anzahl() {
  return liste.length;
}

/**
 * Frisch holen. Der Startbestand kann alt sein - seitdem koennen Dateien
 * verschwunden sein, und dann stimmt die Miniatur nicht mehr.
 */
export async function lade() {
  try {
    liste = (await api.vorlagen()).vorlagen;
  } catch {
    // Der Reiter zeigt dann den letzten bekannten Stand statt einer
    // Fehlermeldung - die Vorlagen sind Bequemlichkeit, kein Betriebsmittel.
  }
  return liste;
}

/** Motiv fuer die Karte kuerzen - der ganze Prompt gehoert nicht ins Raster. */
function kurz(text, zeichen = 90) {
  const sauber = String(text || '').replace(/\s+/g, ' ').trim();
  return sauber.length > zeichen ? `${sauber.slice(0, zeichen - 1)}…` : sauber;
}

function vorschau(v) {
  const kasten = document.createElement('div');
  kasten.className = 'vorschau';

  // Nur fuer Dateien, die es noch gibt - der Server hat vorher nachgesehen.
  // Ein <img> auf einen toten Pfad zeigt sonst das kaputte Bildsymbol.
  if (v.miniatur && v.miniaturDa) {
    const bild = document.createElement('img');
    bild.src = dateiUrl(v.miniatur);
    bild.alt = v.name;
    bild.loading = 'lazy';
    kasten.append(bild);
  } else {
    const leer = document.createElement('span');
    leer.className = 'vl-ohne-bild';
    leer.textContent = v.miniatur ? 'Bild gelöscht' : 'ohne Bild';
    kasten.append(leer);
  }

  if (v.art === 'video') {
    const marke = document.createElement('span');
    marke.className = 'video-marke';
    marke.textContent = 'VIDEO';
    kasten.append(marke);
  }

  return kasten;
}

function karte(v) {
  const kachel = document.createElement('article');
  kachel.className = 'karte vorlage';
  kachel.tabIndex = 0;
  kachel.setAttribute('role', 'button');
  kachel.title = 'Anklicken lädt die Einstellung in den Komponisten — erzeugt nichts';

  const fuss = document.createElement('div');
  fuss.className = 'fuss';

  const titel = document.createElement('div');
  titel.className = 'titel';
  titel.textContent = v.name;

  const unter = document.createElement('div');
  unter.className = 'unter';
  unter.textContent = [
    v.art === 'video' ? 'Video' : 'Bild',
    v.modell,
    v.formatId,
    v.art === 'video' || v.anzahl <= 1 ? null : `${v.anzahl}×`,
    v.dauer ? `${v.dauer} s` : null,
    v.aufloesung,
  ].filter(Boolean).join(' · ');

  const motiv = document.createElement('div');
  motiv.className = 'vl-motiv';
  motiv.textContent = kurz(v.motiv);

  fuss.append(titel, unter, motiv);

  // Nur melden, was fehlt. Eine heile Referenz braucht keine Zeile.
  if (v.referenz) {
    const ref = document.createElement('div');
    ref.className = 'vl-referenz';
    ref.textContent = v.referenzDa ? 'mit Referenzbild' : 'Referenzbild fehlt';
    if (!v.referenzDa) ref.classList.add('fehlt');
    fuss.append(ref);
  }

  const weg = document.createElement('button');
  weg.type = 'button';
  weg.className = 'vl-weg';
  weg.textContent = '×';
  weg.title = 'Vorlage löschen — die Bilder bleiben';
  weg.addEventListener('click', async (e) => {
    // Ohne das laedt der Klick auf das × auch noch die Vorlage.
    e.stopPropagation();
    try {
      liste = (await api.vorlageLoeschen(v.id)).vorlagen;
      await beiAenderung();
    } catch (fehler) {
      weg.title = fehler.message;
      weg.classList.add('fehler');
    }
  });

  const laden = () => beiLaden(v);
  kachel.addEventListener('click', laden);
  kachel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); laden(); }
  });

  kachel.append(vorschau(v), fuss, weg);
  return kachel;
}

/** Die Karten ins Raster haengen. Leert das Ziel nicht - das tut raster.js. */
export function zeichne(ziel) {
  if (!liste.length) {
    const leer = document.createElement('div');
    leer.className = 'leer';
    leer.textContent = 'Noch keine Vorlage. Nach dem nächsten Lauf steht '
      + '„Als Vorlage“ unter dem Komponisten — oder in der Detailansicht '
      + 'eines Bildes, das schon da ist.';
    ziel.append(leer);
    return;
  }
  for (const v of liste) ziel.append(karte(v));
}

/**
 * Eine Vorlage sichern. Aufgerufen aus dem Komponisten und aus der
 * Detailansicht, damit es nur eine Stelle gibt, die die Liste nachzieht.
 */
export async function sichere(vorlage) {
  const antwort = await api.vorlageSichern(vorlage);
  liste = antwort.vorlagen;
  return antwort.vorlage;
}

/**
 * Die Zeile "Name + Sichern".
 *
 * Steckt hier und nicht bei den Aufrufern, weil Komponist und
 * Detailansicht dasselbe brauchen. Ein natives prompt()-Fenster kommt in
 * dieser App nirgends vor - alles bleibt in der Seite, auch das hier.
 *
 * `beiName` bekommt den Namen, sichert selbst und gibt den Satz zurueck,
 * der danach an der Stelle stehen soll.
 */
export function benennung(vorschlag, beiName) {
  const zeile = document.createElement('span');
  zeile.className = 'vl-benennen';

  const feld = document.createElement('input');
  feld.type = 'text';
  feld.value = vorschlag;
  feld.maxLength = 60;
  feld.placeholder = 'Name der Vorlage';
  feld.spellcheck = false;

  const knopf = document.createElement('button');
  knopf.type = 'button';
  knopf.className = 'fest klein';
  knopf.textContent = 'Sichern';

  // Eigene Meldezeile: die Zeile steht mal im Komponisten, mal in der
  // Detailansicht - ein fester Hinweiskasten waere dort jeweils der falsche.
  const meldung = document.createElement('em');
  meldung.className = 'vl-meldung';

  const fertig = (text) => {
    const sagt = document.createElement('span');
    sagt.className = 'vl-gesichert';
    sagt.textContent = text;
    zeile.replaceWith(sagt);
  };

  const sichern = async () => {
    const name = feld.value.trim();
    if (!name) { feld.focus(); return; }
    knopf.disabled = true;
    knopf.textContent = 'Sichert …';
    meldung.textContent = '';
    try {
      fertig(await beiName(name));
    } catch (fehler) {
      knopf.disabled = false;
      knopf.textContent = 'Sichern';
      meldung.textContent = fehler.message;
    }
  };

  knopf.addEventListener('click', sichern);
  feld.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sichern(); }
    if (e.key === 'Escape') {
      // Nicht weiterreichen: sonst schliesst dasselbe Escape auch noch die
      // Detailansicht, in der die Zeile gerade steht.
      e.preventDefault();
      e.stopPropagation();
      zeile.remove();
    }
  });

  zeile.append(feld, knopf, meldung);
  // Erst im naechsten Zug, sonst haengt das Feld noch nicht im Dokument.
  setTimeout(() => { feld.focus(); feld.select(); }, 0);
  return zeile;
}
