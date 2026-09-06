// Vorlagen: ein Lauf, der sitzt, unter eigenem Namen aufbewahrt.
//
// Gespeichert wird der ganze Zustand, aus dem ein Bild oder ein Clip
// entstanden ist - Motiv, Modell, Format, Anzahl, Haken, Referenzbild -
// plus das Ergebnis als Miniatur. Damit sieht man in der Liste, was hinten
// rauskommt, statt nur einen Prompt zu lesen.
//
// Was hier NICHT drinsteht: der Stil-Block. Nur der Haken "mit Stil" wird
// festgehalten. Der Stil-Block ist absichtlich eine einzige lebende Quelle
// (stil.mjs) - eine Vorlage mit eigener eingefrorener Fassung waere eine
// zweite Wahrheit, und man wuesste bei einem Bild nie, welche gegolten hat.
//
// Das Modul rechnet nicht mit Pfaden und prueft sie nicht. Es speichert
// Zeichenketten. Die Pruefung auf die Wurzel passiert in server.mjs, bevor
// hier etwas ankommt.
//
// EINE Ausnahme: das Vorschaubild wird kopiert. Bis 6.9.2026 zeigte eine
// Vorlage auf die Ergebnisdatei in der Galerie - wer die im Explorer
// wegraeumte, hatte eine Vorlage ohne Bild. Eine Vorlage soll aber halten,
// auch wenn man aufraeumt. Deshalb liegt in daten/vorlagen-bilder/ eine
// eigene, verkleinerte Kopie je Vorlage; das Original darf verschwinden.

import fs from 'node:fs';
import path from 'node:path';
import { datenPfad, WURZEL } from './konfig.mjs';
import { kleineFassung } from './format.mjs';

const DATEI = datenPfad('vorlagen.json');

/** Eigene Bildablage der Vorlagen. Eine Datei je Vorlage, benannt nach ihrer id. */
const BILDER = datenPfad('vorlagen-bilder');

/** Kante der Kopie. Gross genug fuer die Karte und das Formular, klein
    genug, dass hundert Vorlagen keinen Ordner sprengen. */
const KANTE = 640;

/**
 * Dateiname der Kopie.
 *
 * Die Kennung wird auf harmlose Zeichen beschnitten, damit aus ihr nie ein
 * Pfad wird - kein Schraegstrich, kein `..`. Sie kommt zwar aus der App
 * selbst, aber die Route nimmt sie aus einer URL entgegen, und dort kann
 * alles Moegliche stehen.
 */
function bildDatei(id) {
  const sauber = String(id).replace(/[^A-Za-z0-9_.-]/g, '').replace(/\.+/g, '.');
  if (!sauber || sauber === '.') throw new Error('Unbrauchbare Vorlagen-Kennung.');
  return path.join(BILDER, `${sauber}.png`);
}

/** Hat diese Vorlage eine eigene Kopie? */
export function hatBild(id) {
  try {
    return fs.existsSync(bildDatei(id));
  } catch {
    return false;
  }
}

/** Die Kopie ausliefern. Wirft, wenn es keine gibt. */
export function liesBild(id) {
  return fs.readFileSync(bildDatei(id));
}

/**
 * Legt die eigene Kopie an - verkleinert, damit die Ablage klein bleibt.
 *
 * `quelleAbsolut` ist ein fertig gepruefter Pfad; die Pruefung auf die
 * Wurzel passiert in der Route. Schlaegt das Verkleinern fehl, bleibt es
 * bei der alten Kopie oder bei keiner - eine Vorlage ohne Vorschaubild ist
 * unschoen, ein abgebrochenes Speichern waere schlimmer.
 */
export async function merkeBild(id, quelleAbsolut) {
  if (!id || !quelleAbsolut) return false;
  try {
    if (!fs.existsSync(BILDER)) fs.mkdirSync(BILDER, { recursive: true });
    const bytes = await kleineFassung(quelleAbsolut, KANTE);
    fs.writeFileSync(bildDatei(id), bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fehlende Kopien nachtraeglich anlegen.
 *
 * Ohne das haengt der Schutz daran, dass jemand nach dem Erzeugen noch
 * einmal auf Speichern klickt - und wer vorher aufraeumt, hat trotzdem eine
 * Vorlage ohne Bild. Genau so passiert am 6.9.2026. Deshalb holt die App es
 * selbst nach, solange das Original noch da ist.
 *
 * `aufloesen` macht aus dem gespeicherten relativen Pfad einen absoluten und
 * prueft ihn gegen die Wurzel - dieses Modul rechnet nicht mit Pfaden.
 * Laeuft nur fuer Vorlagen ohne Kopie, also im Normalfall gar nicht.
 */
export async function holeBilderNach(aufloesen) {
  for (const v of lade()) {
    if (!v.miniatur || hatBild(v.id)) continue;
    try {
      const quelle = aufloesen(v.miniatur);
      if (fs.existsSync(quelle)) await merkeBild(v.id, quelle);
    } catch {
      // Pfad ausserhalb der Wurzel oder nicht lesbar: dann eben nicht.
    }
  }
}

/** Die Kopie wegraeumen - gehoert zum Loeschen der Vorlage. */
function vergissBild(id) {
  try {
    const d = bildDatei(id);
    if (fs.existsSync(d)) fs.unlinkSync(d);
  } catch {
    // Bleibt sie liegen, stoert sie niemanden - sie wird nie wieder gesucht.
  }
}

/** Laengster erlaubter Name. Reicht fuer jede sinnvolle Bezeichnung. */
const NAME_MAX = 60;

function lade() {
  try {
    if (fs.existsSync(DATEI)) {
      const inhalt = JSON.parse(fs.readFileSync(DATEI, 'utf8'));
      if (Array.isArray(inhalt)) return inhalt;
    }
  } catch {
    // Kaputte Datei: lieber mit leerer Liste weiterlaufen als den Start
    // verweigern. Vorlagen sind Bequemlichkeit, kein Betriebsmittel.
  }
  return [];
}

function schreibe(liste) {
  fs.writeFileSync(DATEI, JSON.stringify(liste, null, 2), 'utf8');
  return liste;
}

/** Die rohe Liste, so wie sie auf der Platte liegt. */
export function lies() {
  return lade();
}

/**
 * Die Liste, angereichert um zwei Angaben, die nur das Dateisystem kennt:
 * ob die Miniatur und ob das Referenzbild ueberhaupt noch existieren.
 *
 * Bewusst hier und nicht per `onerror` im Browser: so flackert kein
 * Platzhalter nach, und der Ladeknopf weiss vorher, dass eine Referenz
 * fehlt - statt den Lauf spaeter am toten Pfad scheitern zu lassen.
 */
export function mitBestand() {
  const da = (p) => {
    if (!p) return false;
    try {
      return fs.existsSync(path.join(WURZEL, p));
    } catch {
      return false;
    }
  };
  return lade().map((v) => ({
    ...v,
    miniaturDa: da(v.miniatur),
    referenzDa: da(v.referenz),
    // Die eigene Kopie. Ist sie da, ist die Vorlage vom Bestand unabhaengig.
    eigenesBild: hatBild(v.id),
  }));
}

/**
 * Anlegen oder ueberschreiben. Ohne id entsteht eine neue Vorlage.
 * Gibt die vollstaendige Liste zurueck, damit die Oberflaeche nach dem
 * Speichern nicht noch einmal nachfragen muss.
 */
export function sichere(roh = {}) {
  const name = String(roh.name || '').trim().slice(0, NAME_MAX);
  if (!name) throw new Error('Die Vorlage braucht einen Namen.');

  const art = roh.art === 'video' ? 'video' : 'bild';
  if (!String(roh.motiv || '').trim()) {
    throw new Error('Die Vorlage braucht ein Motiv.');
  }

  const vorlage = {
    id: roh.id || `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    art,
    motiv: String(roh.motiv),
    modell: roh.modell || null,
    formatId: roh.formatId || null,
    // Video laeuft immer als einzelner Clip - anzahlWahl ist dort versteckt.
    anzahl: art === 'video' ? 1 : Math.min(Math.max(1, Number(roh.anzahl) || 1), 10),
    klein: Boolean(roh.klein),
    mitStil: roh.mitStil !== false,
    dateiname: String(roh.dateiname || ''),
    // Nur beim Clip. Beim Bild waeren sie Ballast, der spaeter jemanden
    // ratlos macht, warum in einer Bild-Vorlage eine Dauer steht.
    dauer: art === 'video' ? Number(roh.dauer) || null : null,
    aufloesung: art === 'video' ? roh.aufloesung || null : null,
    referenz: roh.referenz || null,
    miniatur: roh.miniatur || null,
    erstellt: roh.erstellt || new Date().toISOString(),
  };

  const liste = lade();
  const stelle = liste.findIndex((v) => v.id === vorlage.id);
  if (stelle >= 0) liste[stelle] = vorlage;
  else liste.unshift(vorlage);

  schreibe(liste);
  return vorlage;
}

/** Loeschen. Die Bilddateien bleiben unberuehrt - es geht nur die Notiz weg. */
export function entferne(id) {
  const liste = lade();
  const weg = liste.find((v) => v.id === id);
  if (!weg) throw new Error('Diese Vorlage gibt es nicht.');
  schreibe(liste.filter((v) => v.id !== id));
  vergissBild(id);
  return weg;
}
