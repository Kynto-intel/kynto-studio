// Was die KI im Chat tun darf - und was nicht.
//
// Zwei Klassen, und der Unterschied ist der wichtigste im ganzen Modul:
//
//   frei      laeuft sofort, kostet nichts. Suchen, zaehlen, schaetzen,
//             Text aufs Bild brennen, umbenennen.
//   bestaetigt kostet Geld. Das Modell darf es nur VORSCHLAGEN. Ausgefuehrt
//             wird es erst, wenn der Mensch im Browser darauf klickt.
//
// Die zweite Klasse ist der Grund, warum es dieses Modul gibt. Ein Chat, der
// selbstaendig Bilder rendert, gibt fremdes Geld aus - und das Versprechen
// der ganzen App ist, dass vor jeder Ausgabe der Preis steht und jemand Ja
// sagt. Ein Sprachmodell ist kein "jemand".
//
// Ebenso bewusst: **kein Werkzeug hat ein Modell-Feld.** Womit gerendert
// wird, steht in der App (konfig.STANDARD) und waehlt der Mensch. Die KI
// beschreibt das Motiv, nicht die Technik.

import fs from 'node:fs';
import path from 'node:path';
import * as bibliothek from './bibliothek.mjs';
import * as konfig from './konfig.mjs';
import * as kosten from './kosten.mjs';
import * as modelleBild from './modelle-bild.mjs';
import * as preise from './preise.mjs';
import * as schriften from './schriften.mjs';
import * as sidecar from './sidecar.mjs';
import * as stil from './stil.mjs';
import * as textebene from './text.mjs';
import { absolut, relativ, ordnerNach, stelleOrdnerSicher } from './pfade.mjs';
import { masse } from './format.mjs';

/** Formate als Text, fuer die Beschreibung im Werkzeug-Schema. */
function formatListe() {
  return Object.entries(konfig.FORMATE)
    .map(([id, f]) => `${id} (${f.label})`)
    .join(', ');
}

// ------------------------------------------------------------ freie Werkzeuge

const frei = {
  bestand_suchen: {
    beschreibung: 'Durchsucht die Bibliothek nach Dateiname, Motiv, Prompt, '
      + 'Modell und Bildunterschrift. Ohne Suchwort kommt der ganze Bestand. '
      + 'Liefert relative Pfade, die andere Werkzeuge direkt annehmen.',
    felder: {
      suche: { type: 'string', description: 'Suchwort, optional' },
      art: { type: 'string', enum: ['bild', 'video'], description: 'nur Bilder oder nur Videos, optional' },
      ordner: { type: 'string', description: 'Ordner-Kennung, optional' },
      grenze: { type: 'integer', description: 'hoechstens so viele Treffer, Standard 20' },
    },
    async fuehreAus({ suche = '', art = null, ordner = null, grenze = 20 }) {
      const { eintraege, hatVideos } = bibliothek.bestandFuerAnsicht({ suche, art, ordner });
      const n = Math.min(Math.max(1, Number(grenze) || 20), 100);
      return {
        treffer: eintraege.length,
        hatVideos,
        eintraege: eintraege.slice(0, n).map((e) => ({
          pfad: e.pfad, name: e.name, art: e.art, ordner: e.ordner,
          motiv: e.motiv || null, modell: e.modell || null,
          format: e.format || null, favorit: Boolean(e.favorit),
          geaendert: e.geaendert,
        })),
      };
    },
  },

  einstellung_lesen: {
    beschreibung: 'Zeigt, womit gerendert wuerde: Modell fuer Bild und Video, '
      + 'Format, Zielordner, und was ein Lauf kosten wuerde. Diese Einstellung '
      + 'legt der Mensch in der App fest - du kannst sie nicht aendern.',
    felder: {
      anzahl: { type: 'integer', description: 'fuer die Kostenangabe, Standard 1' },
    },
    async fuehreAus({ anzahl = 1 }) {
      const s = konfig.STANDARD;
      const m = masse(s.formatId, false);
      const info = modelleBild.finde(s.modellBild);
      // Gemessen schlaegt geschaetzt - genau wie in der Oberflaeche.
      const gemessen = kosten.gemessen()[s.modellBild]?.schnitt || null;
      const geschaetzt = (await preise.fuer('bild'))[s.modellBild]?.schaetzungProBild || null;
      const proBild = gemessen || geschaetzt;
      const n = Math.min(Math.max(1, Number(anzahl) || 1), 10);
      return {
        modellBild: s.modellBild,
        modellBildName: info?.name || s.modellBild,
        modellVideo: s.modellVideo,
        format: s.formatId,
        masse: `${m.genW}x${m.genH} -> ${m.zielW || m.genW}x${m.zielH || m.genH}`,
        zielordner: m.ordner,
        kostenProBild: proBild,
        kostenGesamt: proBild == null ? null : Number((proBild * n).toFixed(4)),
        preisHerkunft: gemessen == null ? 'geschaetzt' : 'gemessen',
        hinweis: 'Modell und Format aendert nur der Mensch in der App.',
      };
    },
  },

  stil_lesen: {
    beschreibung: 'Gibt den Stil-Block zurueck, der automatisch an jeden '
      + 'Bild-Prompt gehaengt wird. Wichtig zu kennen: was hier schon steht, '
      + 'gehoert NICHT noch einmal ins Motiv.',
    felder: {},
    async fuehreAus() {
      return { stil: stil.ladeStil() };
    },
  },

  text_aufs_bild: {
    beschreibung: 'Brennt Text auf ein vorhandenes Bild. Laeuft lokal und '
      + 'kostet nichts. Das Original bleibt unangetastet, es entsteht eine '
      + 'neue Datei daneben. Ein Wort in *Sternchen* bekommt die Akzentfarbe. '
      + 'Fuer Sprueche im Bild ist das der richtige Weg - Bildmodelle koennen '
      + 'keine ganzen Saetze rendern.',
    felder: {
      pfad: { type: 'string', description: 'relativer Pfad aus bestand_suchen' },
      spruch: { type: 'string', description: 'der Text, *Wort* wird zum Akzent' },
      vorlage: { type: 'string', enum: ['spruch', 'statement', 'einWort'], description: 'optional' },
    },
    erfordert: ['pfad', 'spruch'],
    async fuehreAus({ pfad, spruch, vorlage = 'spruch' }) {
      const quelle = absolut(pfad);
      if (!fs.existsSync(quelle)) throw new Error('Bild nicht gefunden.');

      const grundlage = schriften.VORLAGEN[vorlage] || schriften.VORLAGEN.spruch;
      const ebenen = [{ ...grundlage, text: String(spruch) }];

      const bytes = await textebene.rendere({ quellDatei: quelle, ebenen });

      // Liegt das Original in einem Ordner auf "nur anzeigen", darf das
      // Ergebnis dort nicht landen - dieselbe Regel wie in der Oberflaeche.
      const quellOrdner = konfig.ORDNER.find((o) => quelle.startsWith(o.pfad + path.sep));
      let zielOrdner = null;
      if (quellOrdner && !quellOrdner.schreibbar) {
        const m = masse(konfig.STANDARD.formatId, false);
        zielOrdner = stelleOrdnerSicher(ordnerNach(m.ordner).pfad);
      }

      const ziel = textebene.freierName(quelle, zielOrdner);
      fs.writeFileSync(ziel, bytes);

      // Sidecar wie in der Oberflaeche: Herkunft und Ebenen mitschreiben,
      // damit sich das Textbild spaeter wieder oeffnen und aendern laesst.
      const elternMeta = sidecar.lies(quelle);
      sidecar.schreibe(ziel, {
        ...elternMeta,
        eltern: relativ(quelle),
        version: (Number(elternMeta.version) || 1) + 1,
        erstellt: new Date().toISOString(),
        textEbenen: ebenen.map(textebene.normalisiere),
      });

      return {
        pfad: relativ(ziel),
        name: path.basename(ziel),
        hinweis: 'Neue Datei, Original unveraendert.',
      };
    },
  },

  bild_ansehen: {
    beschreibung: 'Legt dir ein Bild aus der Bibliothek vor, damit du es '
      + 'wirklich ansiehst. Nutze es, bevor du etwas ueber ein Bild sagst - '
      + 'raten hilft niemandem. Sinnvoll nach dem Erzeugen (ist es geworden, '
      + 'was gewollt war?) und bevor du Text daraufsetzt (wo ist Platz, wie '
      + 'hell ist die Stelle?). Kostet keine Erzeugung, nur ein paar Zeichen.',
    felder: {
      pfad: { type: 'string', description: 'relativer Pfad aus bestand_suchen' },
    },
    erfordert: ['pfad'],
    async fuehreAus({ pfad }) {
      const voll = absolut(pfad);
      if (!fs.existsSync(voll)) throw new Error('Bild nicht gefunden.');
      if (/.(mp4|webm|mov)$/i.test(voll)) {
        throw new Error('Videos lassen sich nicht ansehen, nur Bilder.');
      }
      // Die Bytes holt der Server; hier steht nur, welches Bild gemeint ist.
      // Sonst laege ein Megabyte Base64 im gespeicherten Gespraech.
      return { angesehen: relativ(voll) };
    },
  },

  datei_markieren: {
    beschreibung: 'Setzt Favorit oder Freigabe auf einer Datei, oder schreibt '
      + 'eine Bildunterschrift ins Sidecar.',
    felder: {
      pfad: { type: 'string', description: 'relativer Pfad' },
      favorit: { type: 'boolean' },
      freigegeben: { type: 'boolean' },
      caption: { type: 'string' },
    },
    erfordert: ['pfad'],
    async fuehreAus({ pfad, ...rest }) {
      const aenderungen = {};
      for (const f of ['favorit', 'freigegeben', 'caption']) {
        if (rest[f] !== undefined) aenderungen[f] = rest[f];
      }
      if (!Object.keys(aenderungen).length) throw new Error('Nichts zu aendern angegeben.');
      return { sidecar: sidecar.aktualisiere(absolut(pfad), aenderungen) };
    },
  },
};

// ------------------------------------------------- Werkzeuge, die Geld kosten

const bestaetigt = {
  bild_erzeugen: {
    beschreibung: 'Schlaegt vor, ein Bild zu erzeugen. Wird NICHT sofort '
      + 'ausgefuehrt: der Mensch sieht Motiv, Format, Anzahl und Preis und '
      + 'klickt. Modell und Format kommen aus der App - gib sie nicht an. '
      + 'Das Motiv auf Englisch und nur den Bildinhalt beschreiben; Palette, '
      + 'Licht und Stimmung haengt der Stil-Block automatisch an.',
    felder: {
      motiv: { type: 'string', description: 'Bildinhalt auf Englisch, ohne Stilangaben' },
      anzahl: { type: 'integer', description: '1 bis 10, Standard 1' },
      name: { type: 'string', description: 'Dateiname-Praefix, optional' },
      referenz: { type: 'string', description: 'relativer Pfad zu einem Referenzbild, optional' },
    },
    erfordert: ['motiv'],
  },

  video_erzeugen: {
    beschreibung: 'Schlaegt vor, aus einem vorhandenen Bild einen Clip zu '
      + 'machen. Wird NICHT sofort ausgefuehrt. Ein Clip kostet ungefaehr so '
      + 'viel wie zwanzig Bilder - erwaehne das, bevor du es vorschlaegst.',
    felder: {
      motiv: { type: 'string', description: 'Bewegung auf Englisch, z. B. "slow push in, rain falling"' },
      quellBild: { type: 'string', description: 'relativer Pfad zum Standbild' },
      name: { type: 'string', description: 'Dateiname-Praefix, optional' },
    },
    erfordert: ['motiv'],
  },
};

/** Alle Werkzeuge im Format, das OpenRouter erwartet. */
export function schema({ siehtBilder = true } = {}) {
  const bauen = ([name, w]) => ({
    type: 'function',
    function: {
      name,
      description: w.beschreibung,
      parameters: {
        type: 'object',
        properties: w.felder,
        required: w.erfordert || [],
      },
    },
  });
  const auswahl = [...Object.entries(frei), ...Object.entries(bestaetigt)]
    .filter(([name]) => siehtBilder || name !== 'bild_ansehen');
  return auswahl.map(bauen);
}

/** Kostet dieses Werkzeug Geld, braucht also einen Klick? */
export function brauchtBestaetigung(name) {
  return Object.hasOwn(bestaetigt, name);
}

/**
 * Fuehrt ein freies Werkzeug aus.
 *
 * Werkzeuge, die Geld kosten, landen hier absichtlich NICHT - sie haben gar
 * keine fuehreAus-Funktion. Selbst wenn das Modell sie aufruft und dieser
 * Code sich irrt, kann nichts gerendert werden.
 */
export async function fuehreAus(name, argumente) {
  const w = frei[name];
  if (!w) {
    if (brauchtBestaetigung(name)) {
      throw new Error(`"${name}" muss der Mensch bestaetigen und laeuft nicht von selbst.`);
    }
    throw new Error(`Unbekanntes Werkzeug: ${name}`);
  }
  for (const feld of w.erfordert || []) {
    if (argumente?.[feld] === undefined) throw new Error(`"${name}" braucht das Feld ${feld}.`);
  }
  return w.fuehreAus(argumente || {});
}

/** Kurzfassung fuer den Systemhinweis an das Modell. */
export function formateAlsText() {
  return formatListe();
}
