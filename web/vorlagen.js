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

/**
 * Pfad des Bildes aus einem Probelauf im offenen Formular.
 *
 * Der Probelauf erzeugt ein echtes Bild und legt es im Zielordner ab - er
 * ist kein Vorschaumodus. Was er NICHT tut: die Vorlage anfassen. Erst wer
 * danach auf Speichern klickt, uebernimmt Prompt, Referenz und dieses Bild
 * als neues Vorschaubild. Genau darum geht es: ausprobieren, ohne die
 * Vorlage zu verlieren, die bis dahin funktioniert hat.
 */
let probelauf = null;

/**
 * Was diese Vorlage schon hervorgebracht hat - Bild plus Prompt.
 *
 * Kommt aus den Sidecars: jeder Lauf, der ueber eine Vorlage ausgeloest
 * wurde, traegt deren Kennung im Feld `vorlage`. Deshalb steht hier nur,
 * was seit dieser Aenderung entstanden ist; aeltere Bilder kennen die
 * Zuordnung nicht und tauchen nicht auf.
 */
let gemacht = [];

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
 * Eine Kachel im Gitter der erzeugten Bilder: Bild, Datum, Motiv.
 *
 * Das Motiv steht darunter und nicht nur im Titel - wer einen Lauf
 * wiederholen will, muss lesen koennen, was damals drinstand, ohne erst
 * irgendwo hinzufahren. Ein Klick uebernimmt es ins Feld oben.
 */
function gemachtKachel(e) {
  const kachel = document.createElement('article');
  kachel.className = 'vl-gemacht-karte';

  const rahmen = document.createElement('div');
  rahmen.className = 'vl-bild-rahmen';
  const bild = document.createElement('img');
  bild.src = dateiUrl(e.pfad);
  bild.alt = e.motiv || e.name;
  bild.loading = 'lazy';
  rahmen.append(bild);

  const datum = document.createElement('div');
  datum.className = 'vl-gemacht-datum';
  datum.textContent = new Date(e.geaendert).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  const motiv = document.createElement('div');
  motiv.className = 'vl-gemacht-motiv';
  motiv.textContent = e.motiv || '(kein Motiv gespeichert)';
  motiv.title = e.prompt || e.motiv || '';

  const nehmen = document.createElement('button');
  nehmen.type = 'button';
  nehmen.className = 'neben klein';
  nehmen.textContent = 'Prompt übernehmen';
  nehmen.title = 'Schreibt dieses Motiv oben ins Feld — gespeichert wird nichts';
  nehmen.addEventListener('click', () => {
    if (!entwurf) return;
    entwurf.motiv = e.motiv || '';
    zeichneNeu();
  });

  kachel.append(rahmen, datum, motiv, nehmen);
  return kachel;
}

/** Holt, was ueber die offene Vorlage erzeugt wurde. Fehler bleiben stumm. */
async function ladeGemacht() {
  if (!entwurf) return;
  try {
    const { eintraege } = await api.bestand({ vorlage: entwurf.id });
    gemacht = eintraege || [];
  } catch {
    gemacht = [];
  }
  if (entwurf) await zeichneNeu();
}

/** Formular zu, Karten wieder her. Verwirft alles Ungespeicherte. */
async function schliesseFormular() {
  offen = null;
  entwurf = null;
  probelauf = null;
  gemacht = [];
  await beiAenderung();
}

/**
 * Ein Bild mit Ueberschrift und Bildunterschrift.
 *
 * `da` sagt, ob die Datei noch existiert - der Server hat beim Laden
 * nachgesehen. Ohne die Pruefung stuende hier das kaputte Bildsymbol des
 * Browsers, und genau das passiert oft: Ergebnisbilder werden aufgeraeumt,
 * die Vorlage bleibt.
 */
function bildKachel({ titel, pfad, da = true, leerText, unterschrift }) {
  const kasten = document.createElement('div');
  kasten.className = 'vl-bild';

  const kopf = document.createElement('div');
  kopf.className = 'vl-bild-titel';
  kopf.textContent = titel;

  const rahmen = document.createElement('div');
  rahmen.className = 'vl-bild-rahmen';
  if (pfad && da) {
    const bild = document.createElement('img');
    bild.src = dateiUrl(pfad);
    bild.alt = titel;
    bild.loading = 'lazy';
    rahmen.append(bild);
  } else {
    const leer = document.createElement('span');
    leer.className = 'vl-ohne-bild';
    leer.textContent = pfad ? 'Datei gelöscht' : leerText;
    if (pfad) leer.classList.add('fehlt');
    rahmen.append(leer);
  }

  const fuss = document.createElement('div');
  fuss.className = 'vl-bild-fuss';
  fuss.textContent = pfad || unterschrift;
  if (pfad) fuss.title = unterschrift;

  kasten.append(kopf, rahmen, fuss);
  return kasten;
}

/**
 * Die offene Vorlage als Arbeitsplatz.
 *
 * Oben Name und Prompt, darunter die zwei Bilder nebeneinander - was
 * reingeht und was rauskam -, dann der Probelauf und erst danach Speichern.
 * Die Reihenfolge ist Absicht: **erst sehen, dann festschreiben.** Wer
 * speichern muss, um ausprobieren zu koennen, hat im Fehlerfall eine
 * kaputte Vorlage und kein gutes Bild.
 *
 * Geaendert werden Name, Prompt und Referenzbild - die drei, die sich im
 * Alltag bewegen. Modell, Format und Anzahl bleiben draussen: die haben
 * unten im Komponisten ihre eigenen Menues, und ein zweiter Satz derselben
 * Regler waere ein zweiter Ort mit derselben Wahrheit.
 */
function formular(ziel) {
  const v = entwurf;
  const kasten = document.createElement('div');
  kasten.className = 'einstellungen vl-form';

  // Zurueck ganz oben, nicht nur unten neben Speichern. Der Bereich ist mit
  // den zwei Bildern und dem Verlauf laenger als der Bildschirm - wer oben
  // steht, kam sonst nur ueber einen Neustart der App wieder raus.
  const kopf = document.createElement('div');
  kopf.className = 'vl-kopf';

  const zurueck = document.createElement('button');
  zurueck.type = 'button';
  zurueck.className = 'vl-zurueck';
  zurueck.textContent = '← Alle Vorlagen';
  zurueck.title = 'Zurück zur Übersicht — ungespeicherte Änderungen verfallen';
  zurueck.addEventListener('click', schliesseFormular);

  const titel = document.createElement('h3');
  titel.textContent = 'Vorlage bearbeiten';

  kopf.append(zurueck, titel);

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

  // Die zwei Bilder nebeneinander: was reingeht und was rauskam. Erst so
  // sieht man, ob eine Vorlage taugt - ein Prompt allein sagt das nicht.
  const bilder = document.createElement('div');
  bilder.className = 'vl-bilder';
  bilder.append(
    bildKachel({
      titel: 'Referenzbild',
      pfad: v.referenz,
      // Nach einer Bildwahl im Formular ist die Datei frisch gewaehlt und
      // damit sicher da - referenzDa stammt noch vom Laden der Liste.
      da: v.referenz === entwurf.referenz ? v.referenzDa !== false : true,
      leerText: 'Keins — läuft ohne Referenz',
      unterschrift: 'geht als Vorlage an das Bildmodell',
    }),
    bildKachel({
      titel: probelauf ? 'Probelauf' : 'Zuletzt daraus entstanden',
      pfad: probelauf || v.miniatur,
      // Ein Probelauf ist gerade erst entstanden, den gibt es sicher.
      da: probelauf ? true : v.miniaturDa !== false,
      leerText: 'Noch nichts erzeugt',
      unterschrift: probelauf
        ? 'noch nicht gespeichert — wird beim Speichern das Vorschaubild'
        : 'das Bild, aus dem diese Vorlage entstanden ist',
    }),
  );

  const tauschen = document.createElement('button');
  tauschen.type = 'button';
  tauschen.className = 'neben';
  tauschen.textContent = v.referenz ? 'Anderes Referenzbild' : 'Referenzbild wählen';
  // Der Entwurf bleibt stehen, waehrend man im Bestand sucht - sonst waere
  // ein halb getippter Prompt nach der Bildwahl weg. Zurueck kommt das
  // gewaehlte Bild ueber nimmBild().
  tauschen.addEventListener('click', () => beiBildwahl());

  const refWeg = document.createElement('button');
  refWeg.type = 'button';
  refWeg.className = 'neben';
  refWeg.textContent = 'Referenz entfernen';
  refWeg.hidden = !v.referenz;
  refWeg.addEventListener('click', () => {
    entwurf.referenz = null;
    zeichneNeu();
  });

  const meldung = document.createElement('em');
  meldung.className = 'gr-meldung';

  // Der Preis steht VOR dem Knopf, nicht daneben - man soll ihn gelesen
  // haben, bevor die Hand am Auslöser ist. Wie unten im Komponisten.
  const schaetzZeile = document.createElement('div');
  schaetzZeile.className = 'vl-schaetzung';
  schaetzZeile.textContent = 'Preis wird geholt …';
  api.schaetzung({ modell: v.modell, formatId: v.formatId, anzahl: 1, klein: false })
    .then((s) => {
      const preis = s.dollar == null
        ? 'Preis erst nach dem ersten Lauf bekannt'
        : `${s.dollar < 0.01 ? `${(s.dollar * 100).toFixed(2)} ¢` : `${s.dollar.toFixed(3)} $`}${s.gemessen ? '' : ' geschätzt'}`;
      schaetzZeile.textContent = `Ein Bild · ${s.masse} → ${s.ziel} · ${preis}`;
    })
    .catch(() => { schaetzZeile.textContent = 'Preis nicht abrufbar.'; });

  const probeKnopf = document.createElement('button');
  probeKnopf.type = 'button';
  probeKnopf.className = 'fest';
  probeKnopf.textContent = 'Bild erzeugen';
  probeKnopf.title = 'Erzeugt EIN Bild mit dem Stand von oben — die Vorlage '
    + 'bleibt dabei unverändert';
  probeKnopf.addEventListener('click', async () => {
    if (!String(entwurf.motiv || '').trim()) {
      meldung.textContent = 'Ohne Motiv geht nichts.';
      return;
    }
    probeKnopf.disabled = true;
    probeKnopf.textContent = 'Erzeugt …';
    meldung.textContent = '';
    try {
      // Derselbe Weg wie der Knopf unten im Komponisten: POST /api/erzeugen.
      // Es gibt keinen zweiten Weg zum Erzeugen, nur einen zweiten Knopf -
      // und der wird von einem Menschen gedrueckt.
      const e = await api.erzeugen({
        motiv: entwurf.motiv,
        modell: entwurf.modell,
        formatId: entwurf.formatId,
        anzahl: 1,
        klein: false,
        mitStil: entwurf.mitStil !== false,
        name: entwurf.dateiname || '',
        referenz: entwurf.referenz || null,
        // Damit das Bild spaeter unten im Gitter wieder auftaucht.
        vorlageId: entwurf.id,
      });
      probelauf = e.erzeugt[0] || null;
      await ladeGemacht();
      await zeichneNeu();
    } catch (fehler) {
      probeKnopf.disabled = false;
      probeKnopf.textContent = 'Bild erzeugen';
      meldung.textContent = fehler.message;
    }
  });

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
      // mitkommt, waere danach weg. Lief ein Probelauf, wird SEIN Bild das
      // neue Vorschaubild - sonst zeigte die Karte weiter das alte und man
      // haette den Unterschied nicht gesehen.
      await sichere({ ...entwurf, miniatur: probelauf || entwurf.miniatur });
      offen = null;
      entwurf = null;
      probelauf = null;
      gemacht = [];
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
  // Abbrechen laesst die Vorlage, wie sie war. Das Bild aus einem
  // Probelauf bleibt trotzdem in der Galerie liegen - es ist erzeugt und
  // bezahlt, es zu loeschen waere eine Entscheidung, die nur der Mensch
  // trifft.
  abbrechen.addEventListener('click', schliesseFormular);

  const knoepfe = document.createElement('div');
  knoepfe.className = 'stil-knoepfe';
  knoepfe.append(tauschen, refWeg, probeKnopf, speichern, abbrechen, meldung);

  // Alles, was diese Vorlage schon hervorgebracht hat. Steht ganz unten,
  // weil man es beim Arbeiten nicht braucht - aber wer einen Prompt
  // wiederholen will, findet ihn hier statt im Verlauf.
  const verlaufKasten = document.createElement('div');
  verlaufKasten.className = 'vl-gemacht';

  const vTitel = document.createElement('div');
  vTitel.className = 'vl-bild-titel';
  vTitel.textContent = gemacht.length
    ? `Aus dieser Vorlage entstanden (${gemacht.length})`
    : 'Aus dieser Vorlage entstanden';
  verlaufKasten.append(vTitel);

  if (!gemacht.length) {
    const leer = document.createElement('p');
    leer.className = 'gr-erklaerung gr-klein';
    leer.textContent = 'Noch nichts — oder die Bilder sind älter als diese '
      + 'Funktion. Zugeordnet wird erst, was über diese Vorlage erzeugt wurde.';
    verlaufKasten.append(leer);
  } else {
    const gitter = document.createElement('div');
    gitter.className = 'vl-gemacht-gitter';
    for (const e of gemacht) gitter.append(gemachtKachel(e));
    verlaufKasten.append(gitter);
  }

  kasten.append(kopf, nameFeld, motivFeld, bilder, schaetzZeile, knoepfe, verlaufKasten);
  ziel.append(kasten);
}

/** Eine Vorlage zum Bearbeiten aufmachen. */
export function oeffneBearbeiten(id) {
  const v = liste.find((x) => x.id === id);
  if (!v) return;
  offen = id;
  probelauf = null;
  gemacht = [];
  // Kopie: solange nicht gespeichert ist, bleibt die Liste unberuehrt.
  entwurf = { ...v };
  zeichneNeu();
  // Nachreichen: das Formular steht sofort da, das Gitter faellt hinterher
  // hinein. Ein Ladebalken fuer eine Handvoll Dateien waere Zeremonie.
  ladeGemacht();
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
