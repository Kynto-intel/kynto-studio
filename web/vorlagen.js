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
let beiBildwahl = () => {};

/**
 * Welche Vorlage gerade offen ist - `null` heisst: die Karten stehen da.
 *
 * Das Bearbeiten ist bewusst kein Fenster, sondern derselbe Platz im
 * Raster. Ein Dialog ueber den Karten waere ein zweiter Ort, an dem etwas
 * steht, und man muesste ihn zumachen, bevor es weitergeht.
 */
let offen = null;

/** Was im offenen Formular steht, bevor gespeichert wurde. */
let entwurf = null;

export function setzeLadeZiel(fn) { beiLaden = fn; }
export function setzeAenderungsZiel(fn) { beiAenderung = fn; }

/**
 * Wie ein anderes Referenzbild ausgesucht wird.
 *
 * Dieses Modul kennt die Galerie nicht. Es ruft nur "such mir eins" und
 * bekommt den Eintrag zurueck - studio.js schaltet dafuer auf den Bestand
 * um und faengt den naechsten Klick ab. So bleibt die Bildauswahl an der
 * einen Stelle, an der sie ohnehin schon steht.
 */
export function setzeBildwahlZiel(fn) { beiBildwahl = fn; }

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

  // Das Referenzbild als Miniatur, nicht als Satz: "mit Referenzbild" sagt
  // einem nicht, WELCHES gemeint war. Beim Mockup ist genau das die Frage,
  // weil das Design die halbe Vorlage ist.
  if (v.referenz) {
    const ref = document.createElement('div');
    ref.className = 'vl-referenz';
    if (v.referenzDa) {
      const mini = document.createElement('img');
      mini.src = dateiUrl(v.referenz);
      mini.alt = '';
      mini.loading = 'lazy';
      ref.append(mini);
    } else {
      ref.classList.add('fehlt');
    }
    const wort = document.createElement('span');
    wort.textContent = v.referenzDa
      ? v.referenz.split(/[\\/]/).pop()
      : 'Referenzbild fehlt';
    ref.append(wort);
    fuss.append(ref);
  }

  const stift = document.createElement('button');
  stift.type = 'button';
  stift.className = 'vl-stift';
  stift.textContent = 'Bearbeiten';
  stift.title = 'Name, Prompt und Referenzbild ändern';
  stift.addEventListener('click', (e) => {
    // Sonst laedt derselbe Klick die Vorlage auch noch in den Komponisten.
    e.stopPropagation();
    oeffneBearbeiten(v.id);
  });

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

  kachel.append(vorschau(v), fuss, stift, weg);
  return kachel;
}

/**
 * Die offene Vorlage zum Aendern.
 *
 * Geaendert werden Name, Prompt und Referenzbild - das sind die drei, die
 * sich im Alltag bewegen. Modell, Format und Anzahl bleiben draussen: die
 * haben unten im Komponisten ihre eigenen Menues, und ein zweiter Satz
 * derselben Regler waere ein zweiter Ort mit derselben Wahrheit. Wer sie
 * aendern will, laedt die Vorlage, stellt unten um und sichert neu.
 */
function formular(ziel) {
  const v = entwurf;
  const kasten = document.createElement('div');
  kasten.className = 'einstellungen vl-form';

  const titel = document.createElement('h3');
  titel.textContent = 'Vorlage bearbeiten';

  const nameFeld = document.createElement('input');
  nameFeld.type = 'text';
  nameFeld.className = 'vl-name';
  nameFeld.maxLength = 60;
  nameFeld.value = v.name;
  nameFeld.setAttribute('aria-label', 'Name der Vorlage');
  nameFeld.addEventListener('input', () => { entwurf.name = nameFeld.value; });

  const motivFeld = document.createElement('textarea');
  motivFeld.className = 'regie-feld vl-motiv-feld';
  motivFeld.rows = 6;
  motivFeld.spellcheck = false;
  motivFeld.value = v.motiv;
  motivFeld.setAttribute('aria-label', 'Prompt der Vorlage');
  motivFeld.addEventListener('input', () => { entwurf.motiv = motivFeld.value; });

  const refKasten = document.createElement('div');
  refKasten.className = 'vl-ref-kasten';

  const refTitel = document.createElement('div');
  refTitel.className = 'gr-erklaerung gr-klein';
  refTitel.textContent = 'Referenzbild — geht als Vorlage an das Bildmodell. '
    + 'Beim Mockup ist das dein Design.';

  const refBild = document.createElement('div');
  refBild.className = 'vl-ref-bild';
  if (v.referenz) {
    const bild = document.createElement('img');
    bild.src = dateiUrl(v.referenz);
    bild.alt = v.referenz;
    refBild.append(bild);
    const pfad = document.createElement('span');
    pfad.textContent = v.referenz;
    refBild.append(pfad);
  } else {
    const leer = document.createElement('span');
    leer.className = 'vl-ohne-bild';
    leer.textContent = 'Kein Referenzbild — läuft ohne';
    refBild.append(leer);
  }

  const tauschen = document.createElement('button');
  tauschen.type = 'button';
  tauschen.className = 'neben';
  tauschen.textContent = v.referenz ? 'Anderes Bild wählen' : 'Bild wählen';
  // Der Entwurf bleibt stehen, waehrend man im Bestand sucht - sonst waere
  // ein halb getippter Prompt nach der Bildwahl weg. Zurueck kommt das
  // gewaehlte Bild ueber nimmBild().
  tauschen.addEventListener('click', () => beiBildwahl());

  const refWeg = document.createElement('button');
  refWeg.type = 'button';
  refWeg.className = 'neben';
  refWeg.textContent = 'Entfernen';
  refWeg.hidden = !v.referenz;
  refWeg.addEventListener('click', () => {
    entwurf.referenz = null;
    zeichneNeu();
  });

  const refKnoepfe = document.createElement('div');
  refKnoepfe.className = 'stil-knoepfe';
  refKnoepfe.append(tauschen, refWeg);
  refKasten.append(refTitel, refBild, refKnoepfe);

  const meldung = document.createElement('em');
  meldung.className = 'gr-meldung';

  const speichern = document.createElement('button');
  speichern.type = 'button';
  speichern.className = 'fest';
  speichern.textContent = 'Speichern';
  speichern.addEventListener('click', async () => {
    speichern.disabled = true;
    meldung.textContent = '';
    try {
      // Der ganze Datensatz geht raus, nicht nur die drei Felder: der
      // Server legt die Vorlage anhand der id neu an, und was nicht
      // mitkommt, waere danach weg.
      await sichere(entwurf);
      offen = null;
      entwurf = null;
      await beiAenderung();
    } catch (fehler) {
      speichern.disabled = false;
      meldung.textContent = fehler.message;
    }
  });

  const abbrechen = document.createElement('button');
  abbrechen.type = 'button';
  abbrechen.className = 'neben';
  abbrechen.textContent = 'Abbrechen';
  abbrechen.addEventListener('click', async () => {
    offen = null;
    entwurf = null;
    await beiAenderung();
  });

  const knoepfe = document.createElement('div');
  knoepfe.className = 'stil-knoepfe';
  knoepfe.append(speichern, abbrechen, meldung);

  kasten.append(titel, nameFeld, motivFeld, refKasten, knoepfe);
  ziel.append(kasten);
}

/** Eine Vorlage zum Bearbeiten aufmachen. */
export function oeffneBearbeiten(id) {
  const v = liste.find((x) => x.id === id);
  if (!v) return;
  offen = id;
  // Kopie: solange nicht gespeichert ist, bleibt die Liste unberuehrt.
  entwurf = { ...v };
  zeichneNeu();
}

/**
 * Nach einer Bildwahl von aussen. Zeichnet NICHT selbst - studio.js
 * schaltet gleich danach auf die Vorlagen zurueck, und das zeichnet ohnehin.
 */
export function nimmBild(eintrag) {
  if (entwurf) entwurf.referenz = eintrag.pfad;
}

/** Ist gerade eine Vorlage offen? Fragt studio.js nach der Bildwahl. */
export function bearbeitetGerade() {
  return offen !== null;
}

function zeichneNeu() {
  return beiAenderung();
}

/** Die Karten ins Raster haengen. Leert das Ziel nicht - das tut raster.js. */
export function zeichne(ziel) {
  // Ist eine Vorlage offen, steht statt der Karten das Formular da. Die
  // Karten kommen zurueck, sobald gespeichert oder abgebrochen wurde.
  if (offen) {
    formular(ziel);
    return;
  }

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
