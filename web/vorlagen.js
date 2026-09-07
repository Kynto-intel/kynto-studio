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

/**
 * Woher das Vorschaubild einer Vorlage kommt.
 *
 * Zuerst die eigene Kopie in der Ablage - die haelt, auch wenn das
 * Ergebnisbild in der Galerie geloescht wurde. Erst wenn es keine gibt
 * (Vorlagen von vor dieser Aenderung), die Originaldatei. Ist auch die weg,
 * kommt null zurueck und der Aufrufer zeigt seinen Leertext.
 */
function vorschauUrl(v) {
  if (v.eigenesBild) return `/api/vorlage-bild?id=${encodeURIComponent(v.id)}`;
  if (v.miniatur && v.miniaturDa) return dateiUrl(v.miniatur);
  return null;
}

/** Motiv fuer die Karte kuerzen - der ganze Prompt gehoert nicht ins Raster. */
function kurz(text, zeichen = 90) {
  const sauber = String(text || '').replace(/\s+/g, ' ').trim();
  return sauber.length > zeichen ? `${sauber.slice(0, zeichen - 1)}…` : sauber;
}

function vorschau(v) {
  const kasten = document.createElement('div');
  kasten.className = 'vorschau';

  // Eigene Kopie zuerst, Originaldatei als Rueckfall. Ein <img> auf einen
  // toten Pfad zeigt sonst das kaputte Bildsymbol des Browsers.
  //
  // Clips brauchen ein <video>: ein <img> auf eine mp4 bleibt schlicht
  // leer, und genau so sah eine Video-Vorlage bis 7.9.2026 aus. Eine eigene
  // Kopie gibt es fuer Clips nicht - aus einer mp4 laesst sich mit
  // System.Drawing kein Standbild schneiden -, also zeigt sie immer die
  // Originaldatei.
  const url = vorschauUrl(v);
  if (v.art === 'video' && v.miniatur && v.miniaturDa) {
    const clip = document.createElement('video');
    clip.src = dateiUrl(v.miniatur);
    clip.muted = true;
    clip.playsInline = true;
    clip.preload = 'metadata';
    kasten.append(clip);
  } else if (url) {
    const bild = document.createElement('img');
    bild.src = url;
    bild.alt = v.name;
    bild.loading = 'lazy';
    kasten.append(bild);
  } else {
    const leer = document.createElement('span');
    leer.className = 'vl-ohne-bild';
    leer.textContent = v.art === 'video' && v.miniatur ? 'Clip gelöscht' : 'ohne Bild';
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
  rahmen.className = 'vl-bild-rahmen vl-anklickbar';
  rahmen.tabIndex = 0;
  rahmen.setAttribute('role', 'button');
  rahmen.title = 'Groß ansehen';
  const bild = document.createElement('img');
  bild.src = dateiUrl(e.pfad);
  bild.alt = e.motiv || e.name;
  bild.loading = 'lazy';
  rahmen.append(bild);

  const gross = () => zeigeGross(e.pfad, e.motiv || e.name);
  rahmen.addEventListener('click', gross);
  rahmen.addEventListener('keydown', (t) => {
    if (t.key === 'Enter' || t.key === ' ') { t.preventDefault(); gross(); }
  });

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

/**
 * Holt, was ueber die offene Vorlage erzeugt wurde. Fehler bleiben stumm.
 *
 * Gefiltert wird ZWEIMAL: der Server kennt `?vorlage=`, und hier wird das
 * Ergebnis noch einmal geprueft. Doppelt gemoppelt mit Grund - laeuft der
 * Server noch mit einem aelteren Stand, ignoriert er den Parameter und
 * schickt den ganzen Bestand. Ohne die zweite Pruefung stuenden dann alle
 * Bilder des Nutzers unter "aus dieser Vorlage entstanden", und das ist
 * schlimmer als eine leere Liste: es behauptet etwas Falsches.
 * (Genau so passiert am 6.9.2026 - eine brandneue Vorlage zeigte 5.)
 */
async function ladeGemacht() {
  if (!entwurf) return;
  const id = entwurf.id;
  try {
    const { eintraege } = await api.bestand({ vorlage: id });
    gemacht = (eintraege || []).filter((e) => e.vorlage === id);
  } catch {
    gemacht = [];
  }
  // Zwischendurch geschlossen? Dann nichts mehr zeichnen.
  if (entwurf && entwurf.id === id) await zeichneNeu();
}

/**
 * Ein Bild gross ansehen - und wirklich nur das Bild.
 *
 * Bewusst NICHT die Detailansicht: die bringt Datenblatt, Prompt und sechs
 * Knoepfe mit. Hier will man sehen, ob das Bild etwas geworden ist, und
 * sonst nichts. Kein Rahmen, kein Kasten, nur die Datei auf dunklem Grund.
 *
 * Zu geht es mit jedem Klick und mit Escape - ein Schliessknopf waere schon
 * wieder Beiwerk auf einem Bild, das fuer sich stehen soll.
 */
function zeigeGross(pfad, beschriftung) {
  const grund = document.createElement('div');
  grund.className = 'vl-gross';

  const bild = document.createElement('img');
  bild.src = dateiUrl(pfad);
  bild.alt = beschriftung || '';
  grund.append(bild);

  const zu = () => {
    grund.remove();
    document.removeEventListener('keydown', beiTaste);
  };
  function beiTaste(e) {
    if (e.key !== 'Escape') return;
    // Nicht weiterreichen: sonst schliesst dasselbe Escape auch noch das
    // Vorlagen-Formular darunter.
    e.preventDefault();
    e.stopPropagation();
    zu();
  }

  grund.addEventListener('click', zu);
  document.addEventListener('keydown', beiTaste);
  document.body.append(grund);
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
 * Bekommt eine fertige URL oder null. Wer sie baut, entscheidet auch, ob
 * die eigene Kopie oder die Originaldatei gemeint ist - siehe vorschauUrl().
 */
function bildKachel({ titel, url, video = false, leerText, unterschrift }) {
  const kasten = document.createElement('div');
  kasten.className = 'vl-bild';

  const kopf = document.createElement('div');
  kopf.className = 'vl-bild-titel';
  kopf.textContent = titel;

  const rahmen = document.createElement('div');
  rahmen.className = 'vl-bild-rahmen';
  if (url && video) {
    // Mit Bedienleiste, damit man den Clip wirklich ansehen kann. Ob die
    // Bewegung sitzt, beantwortet kein Standbild.
    const clip = document.createElement('video');
    clip.src = url;
    clip.controls = true;
    clip.muted = true;
    clip.playsInline = true;
    clip.preload = 'metadata';
    rahmen.append(clip);
  } else if (url) {
    const bild = document.createElement('img');
    bild.src = url;
    bild.alt = titel;
    bild.loading = 'lazy';
    rahmen.append(bild);
  } else {
    const leer = document.createElement('span');
    leer.className = 'vl-ohne-bild';
    leer.textContent = leerText;
    rahmen.append(leer);
  }

  const fuss = document.createElement('div');
  fuss.className = 'vl-bild-fuss';
  fuss.textContent = unterschrift;

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
      url: v.referenz ? dateiUrl(v.referenz) : null,
      leerText: 'Keins — läuft ohne Referenz',
      // Bewusst KEINE eigene Kopie: dieses Bild geht an das Bildmodell und
      // muss dafuer in der Bibliothek liegen. Loescht man es dort, kann die
      // Vorlage nicht mehr erzeugen - und das soll man sehen.
      unterschrift: 'geht als Vorlage an das Bildmodell — muss in der Bibliothek bleiben',
    }),
    bildKachel({
      titel: probelauf ? 'Probelauf' : 'Zuletzt daraus entstanden',
      video: v.art === 'video',
      // Ein frischer Probelauf liegt in der Galerie, alles andere kommt aus
      // der eigenen Ablage der Vorlage - die haelt auch nach dem Aufraeumen.
      url: probelauf ? dateiUrl(probelauf) : vorschauUrl(v),
      leerText: 'Noch nichts erzeugt',
      unterschrift: probelauf
        ? 'noch nicht gespeichert — wird beim Speichern das Vorschaubild'
        : 'eigene Kopie der Vorlage — bleibt, auch wenn du das Original löschst',
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
  // Eine Video-Vorlage erzeugt einen CLIP, kein Bild. Bis 7.9.2026 fragte
  // diese Zeile immer nach dem Bildpreis und der Knopf rief immer
  // /api/erzeugen - bei einer Video-Vorlage haette er das Falsche gemacht,
  // und zwar fuer Geld.
  const istVideo = v.art === 'video';
  const geld = (d) => (d < 0.01 ? `${(d * 100).toFixed(2)} ¢` : `${d.toFixed(3)} $`);

  const schaetzZeile = document.createElement('div');
  schaetzZeile.className = 'vl-schaetzung';
  schaetzZeile.textContent = 'Preis wird geholt …';
  api.schaetzung(istVideo
    ? { modellVideo: v.modell, dauer: v.dauer, aufloesung: v.aufloesung }
    : { modell: v.modell, formatId: v.formatId, anzahl: 1, klein: false })
    .then((s) => {
      if (istVideo) {
        const d = s.video?.dollar;
        schaetzZeile.textContent = `Ein Clip · ${s.video.dauer} s · ${s.video.aufloesung} · `
          + (d == null ? 'Preis erst nach dem ersten Clip bekannt' : `${geld(d)} gemessen`);
        if (d != null) probeKnopf.textContent = `Clip erzeugen · ${geld(d)}`;
        return;
      }
      const preis = s.dollar == null
        ? 'Preis erst nach dem ersten Lauf bekannt'
        : `${geld(s.dollar)}${s.gemessen ? '' : ' geschätzt'}`;
      schaetzZeile.textContent = `Ein Bild · ${s.masse} → ${s.ziel} · ${preis}`;
      if (s.dollar != null) probeKnopf.textContent = `Bild erzeugen · ${geld(s.dollar)}`;
    })
    .catch(() => { schaetzZeile.textContent = 'Preis nicht abrufbar.'; });

  // EIGENE Klasse, nicht "fest" wie Speichern. Am 6.9.2026 stand er in
  // derselben Reihe mit derselben Klasse davor - und ein Klick, der
  // "Speichern" treffen sollte, hat ein Bild erzeugt und Geld gekostet.
  // Was Geld ausgibt, sieht anders aus und steht woanders.
  const probeKnopf = document.createElement('button');
  probeKnopf.type = 'button';
  probeKnopf.className = 'erzeugt-jetzt';
  probeKnopf.textContent = istVideo ? 'Clip erzeugen' : 'Bild erzeugen';
  probeKnopf.title = istVideo
    ? 'Erzeugt EINEN Clip mit dem Stand von oben — die Vorlage bleibt unverändert'
    : 'Erzeugt EIN Bild mit dem Stand von oben — die Vorlage bleibt unverändert';
  probeKnopf.addEventListener('click', async () => {
    if (!String(entwurf.motiv || '').trim()) {
      meldung.textContent = 'Ohne Motiv geht nichts.';
      return;
    }
    const beschriftung = probeKnopf.textContent;
    probeKnopf.disabled = true;
    probeKnopf.textContent = istVideo ? 'Animiert … (Minuten)' : 'Erzeugt …';
    meldung.textContent = '';
    try {
      // Dieselben Wege wie die Knoepfe unten im Komponisten:
      // POST /api/erzeugen und POST /api/animieren. Es gibt keinen zweiten
      // Weg zum Erzeugen, nur einen zweiten Knopf - und der wird von einem
      // Menschen gedrueckt.
      const e = istVideo
        ? await api.animieren({
          motiv: entwurf.motiv,
          modell: entwurf.modell,
          formatId: entwurf.formatId,
          dauer: entwurf.dauer,
          aufloesung: entwurf.aufloesung,
          mitStil: entwurf.mitStil !== false,
          name: entwurf.dateiname || '',
          quellBild: entwurf.referenz || null,
        })
        : await api.erzeugen({
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
      probeKnopf.textContent = beschriftung;
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

  // Zwei getrennte Reihen: was Geld ausgibt, steht bei seinem Preis - was
  // nur Einstellungen sichert, steht darunter. Nicht Kosmetik, sondern der
  // Abstand zwischen "kostet" und "kostet nicht".
  const laufZeile = document.createElement('div');
  laufZeile.className = 'vl-lauf';
  laufZeile.append(schaetzZeile, probeKnopf);

  const knoepfe = document.createElement('div');
  knoepfe.className = 'stil-knoepfe';
  knoepfe.append(tauschen, refWeg, speichern, abbrechen, meldung);

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

  kasten.append(kopf, nameFeld, motivFeld, bilder, laufZeile, knoepfe, verlaufKasten);
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

/**
 * Einen Prompt-Vorschlag des Assistenten ins offene Formular schreiben.
 *
 * Nur ins Feld, nicht auf die Platte: `vorlagen.json` fasst das hier nicht
 * an. Der Mensch sieht den Text, vergleicht ihn mit dem alten und
 * entscheidet mit dem Speichern-Knopf. Ist kein Formular offen, passiert
 * nichts - der Assistent hat den Prompt dann ohnehin in seiner Antwort
 * stehen.
 *
 * Gibt zurueck, ob es angekommen ist, damit der Chat es sagen kann.
 */
export function uebernimmVorschlag(text) {
  if (!entwurf || !String(text || '').trim()) return false;
  entwurf.motiv = String(text).trim();
  zeichneNeu();
  return true;
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
