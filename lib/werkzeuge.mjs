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
import * as anleitungen from './anleitungen.mjs';
import * as bibliothek from './bibliothek.mjs';
import * as konfig from './konfig.mjs';
import * as kosten from './kosten.mjs';
import * as modelleBild from './modelle-bild.mjs';
import * as preise from './preise.mjs';
import * as schriften from './schriften.mjs';
import * as sidecar from './sidecar.mjs';
import * as stil from './stil.mjs';
import * as textebene from './text.mjs';
import * as verlauf from './verlauf.mjs';
import * as vorlagen from './vorlagen.mjs';
import { absolut, relativ, ordnerNach, stelleOrdnerSicher } from './pfade.mjs';
import { masse } from './format.mjs';

/** Formate als Text, fuer die Beschreibung im Werkzeug-Schema. */
function formatListe() {
  return Object.entries(konfig.FORMATE)
    .map(([id, f]) => `${id} (${f.label})`)
    .join(', ');
}

/** Datum eines Zeitpunkts nach der Uhr dieses Rechners, als JJJJ-MM-TT. */
function tagVon(zeit) {
  const d = new Date(zeit);
  if (Number.isNaN(d.getTime())) return null;
  const z = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

/**
 * Faellt dieser Eintrag auf den gefragten Tag?
 *
 * Gerechnet wird in ORTSZEIT. Im Verlauf steht UTC, und wer abends um zehn
 * ein Bild macht, hat es nach UTC schon am naechsten Tag gemacht - "gestern"
 * waere dann falsch, und niemand wuerde den Fehler bemerken.
 */
function amTag(zeit, wunsch) {
  const jetzt = new Date();
  let ziel = String(wunsch || '').trim().toLowerCase();
  if (ziel === 'heute') ziel = tagVon(jetzt);
  else if (ziel === 'gestern') ziel = tagVon(new Date(jetzt.getTime() - 86400000));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ziel)) return true;
  return tagVon(zeit) === ziel;
}

/**
 * Ein Verlaufseintrag, auf das gekuerzt, was eine Antwort braucht.
 *
 * Der volle Eintrag traegt den ganzen Prompt und jede erzeugte Datei mit -
 * mehrere hundert Zeichen pro Zeile. Bei jedem Gespraechszug geht das
 * komplette Werkzeug-Ergebnis erneut ans Modell und wird erneut bezahlt.
 * Also nur das, wonach gefragt sein koennte.
 */
function schlank(e, mitPrompt) {
  const d = e.details || {};
  const eintrag = {
    zeit: e.zeit,
    tag: tagVon(e.zeit),
    uhr: new Date(e.zeit).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    was: e.was,
    quelle: e.quelle,
    text: e.text,
  };
  for (const [feld, wert] of Object.entries({
    motiv: d.motiv, modell: d.modellName || d.modell || null,
    format: d.formatId, anzahl: d.anzahl,
    dauer: d.dauer, aufloesung: d.aufloesung,
    dollar: d.dollar ?? null,
    dateien: d.dateien,
  })) {
    if (wert !== undefined && wert !== null) eintrag[feld] = wert;
  }
  if (mitPrompt && d.prompt) eintrag.prompt = d.prompt;
  return eintrag;
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
      const verbrauch = kosten.stand();
      return {
        modellBild: s.modellBild,
        modellBildName: info?.name || s.modellBild,
        modellVideo: s.modellVideo,
        videoDauer: s.videoDauer,
        videoAufloesung: s.videoAufloesung,
        format: s.formatId,
        masse: `${m.genW}x${m.genH} -> ${m.zielW || m.genW}x${m.zielH || m.genH}`,
        zielordner: m.ordner,
        kostenProBild: proBild,
        kostenGesamt: proBild == null ? null : Number((proBild * n).toFixed(4)),
        preisHerkunft: gemessen == null ? 'geschaetzt' : 'gemessen',
        // Damit der Assistent nicht etwas vorschlaegt, das der Server
        // gleich ablehnt. Er soll es vorher sagen, nicht hinterher.
        tagesgrenzen: { ...konfig.GRENZEN },
        heuteVerbraucht: {
          gesamt: verbrauch.dollar,
          bild: verbrauch.bildDollar,
          video: verbrauch.videoDollar,
          chat: verbrauch.chatDollar,
        },
        hinweis: 'Modell, Format und Grenzen aendert nur der Mensch in der App.',
      };
    },
  },

  vorlage_lesen: {
    beschreibung: 'Die gespeicherten Vorlagen des Menschen: Name, Prompt, '
      + 'Format und Referenzbild. Schlag hier ZUERST nach, wenn jemand nach '
      + 'einer wiederkehrenden Sache fragt - Mockup, Spruchbild, Post. Nimm '
      + 'den Prompt der passenden Vorlage als Grundlage und tausche nur, was '
      + 'diesmal anders ist. Aendern kannst du Vorlagen nicht, nur lesen.',
    felder: {},
    async fuehreAus() {
      // Ohne Miniatur und ohne Zeitstempel - das Modell soll den Aufbau
      // lesen, nicht Dateipfade von Ergebnisbildern.
      const alle = vorlagen.mitBestand().map((v) => ({
        name: v.name,
        art: v.art,
        motiv: v.motiv,
        format: v.formatId,
        anzahl: v.anzahl,
        mitStil: v.mitStil,
        referenz: v.referenz || null,
        referenzFehlt: Boolean(v.referenz) && !v.referenzDa,
      }));
      return { treffer: alle.length, vorlagen: alle };
    },
  },

  prompt_vorschlagen: {
    beschreibung: 'Schreibt einen fertigen Bild-Prompt in das Motivfeld der '
      + 'Vorlage, die der Mensch gerade offen hat. Nutze es, wenn er eine '
      + 'Vorlage umschreiben lassen will - dann muss er nichts abtippen. '
      + 'GESPEICHERT WIRD NICHTS: der Text steht nur im Feld, klicken muss '
      + 'er selbst. Hat er keine Vorlage offen, passiert nichts sichtbares - '
      + 'schreib den Prompt dann zusaetzlich in deine Antwort.',
    felder: {
      text: { type: 'string', description: 'der vollstaendige Prompt, englisch, ein Absatz' },
    },
    erfordert: ['text'],
    async fuehreAus({ text }) {
      const sauber = String(text || '').trim();
      if (!sauber) throw new Error('Kein Text angegeben.');
      // Absichtlich ohne jede Wirkung auf der Platte. Der Vorschlag reist
      // als Werkzeug-Ereignis zum Browser, und NUR der traegt ihn ins Feld
      // ein - wenn ueberhaupt eines offen ist. Nichts hiervon landet in
      // vorlagen.json; das tut allein der Speichern-Knopf.
      return { vorgeschlagen: sauber };
    },
  },

  verlauf_lesen: {
    beschreibung: 'Was in dieser App passiert ist: erzeugte Bilder, Clips, '
      + 'Umbenennungen, geaenderte Einstellungen - mit Zeit, Motiv und Preis. '
      + 'Hier nachsehen bei Fragen wie "was habe ich gestern gemacht", "was '
      + 'hat der letzte Clip gekostet", "wie hiess der Prompt von heute '
      + 'frueh". Nicht fuer die Frage, WELCHE Dateien es gibt - dafuer ist '
      + 'bestand_suchen da. "dollarZusammen" summiert ALLE Treffer, auch die, '
      + 'die wegen der Grenze nicht mit aufgelistet sind.',
    felder: {
      was: {
        type: 'string',
        enum: ['erzeugt', 'animiert', 'text', 'umbenannt', 'stil', 'vorlage', 'einstellung'],
        description: 'nur eine Art von Vorgang, optional',
      },
      tag: {
        type: 'string',
        description: '"heute", "gestern" oder ein Datum als JJJJ-MM-TT. '
          + 'Ohne Angabe: alles, was aufbewahrt ist',
      },
      grenze: { type: 'integer', description: 'hoechstens so viele Eintraege, Standard 15' },
      mitPrompt: {
        type: 'boolean',
        description: 'den vollstaendigen Prompt mitliefern. Standard aus - '
          + 'Prompts sind lang und jeder Buchstabe wird mitbezahlt. Nur '
          + 'einschalten, wenn wirklich nach dem Wortlaut gefragt ist',
      },
    },
    async fuehreAus({ was = null, tag = null, grenze = 15, mitPrompt = false }) {
      const alle = verlauf.alle();
      const gefiltert = alle
        .filter((e) => (was ? e.was === was : true))
        .filter((e) => (tag ? amTag(e.zeit, tag) : true));

      const n = Math.min(Math.max(1, Number(grenze) || 15), 60);
      const gezeigt = gefiltert.slice(0, n);

      // Summiert wird ueber ALLE Treffer, nicht nur ueber die gezeigten -
      // sonst waere "was habe ich gestern ausgegeben" bei 20 Laeufen und
      // Grenze 15 eine zu kleine Zahl, und zwar unbemerkt.
      const summe = gefiltert.reduce((a, e) => a + (Number(e.details?.dollar) || 0), 0);

      return {
        treffer: gefiltert.length,
        gezeigt: gezeigt.length,
        dollarZusammen: Number(summe.toFixed(4)),
        eintraege: gezeigt.map((e) => schlank(e, mitPrompt)),
        // Der Verlauf ist gedeckelt. Ohne diesen Hinweis wuerde ein leeres
        // Ergebnis fuer "letzten Monat" wie "da war nichts" aussehen - dabei
        // ist es nur herausgefallen.
        hinweis: alle.length >= verlauf.GRENZE
          ? `Aufbewahrt werden die letzten ${verlauf.GRENZE} Vorgaenge. Aelteres steht nicht mehr drin.`
          : null,
      };
    },
  },

  anleitung_lesen: {
    beschreibung: 'Der volle Text einer Anleitung - Handwerk fuer EINE Aufgabe: '
      + 'wie der Prompt aufgebaut wird, welche Masse gelten, welche Fehler '
      + 'typisch sind. Welche es gibt, steht im Systemhinweis. Passt eine zur '
      + 'Frage, lies sie BEVOR du einen Prompt schreibst - nicht danach. Ohne '
      + 'Kennung kommt die Liste.',
    felder: {
      kennung: { type: 'string', description: 'Kennung aus der Liste, z. B. shirt-mockup. Leer lassen fuer die Liste' },
    },
    async fuehreAus({ kennung = null }) {
      // Ohne Kennung nur die Liste - dann kostet ein Blick in die
      // Werkzeugkiste nicht den Inhalt aller Faecher.
      if (!kennung) return { anleitungen: anleitungen.liste() };
      return anleitungen.lies(kennung);
    },
  },

  kosten_lesen: {
    beschreibung: 'Was ueber die Zeit ausgegeben wurde, je Monat und je Tag, '
      + 'aufgeteilt nach Bildern, Clips und Assistent. Hier nachsehen bei '
      + '"was habe ich diesen Monat ausgegeben", "was kostet mich das im '
      + 'Schnitt", "wofuer ging das Geld drauf". Nicht fuer die Frage, was '
      + 'ein Lauf JETZT kosten wuerde - dafuer ist einstellung_lesen da. '
      + '"ohneAufteilung" ist Geld, das vor dem 2.9.2026 nur als Tagessumme '
      + 'festgehalten wurde: es zaehlt in die Summe, aber in keine Spalte. '
      + 'Rechne es nicht einer Spalte zu.',
    felder: {
      monate: { type: 'integer', description: 'wie viele Monate zurueck, Standard 3, 0 fuer alle' },
      mitTagen: { type: 'boolean', description: 'auch die einzelnen Tage mitliefern. Standard aus' },
    },
    async fuehreAus({ monate = 3, mitTagen = false }) {
      const n = Math.min(Math.max(0, Number(monate) || 0), 24);
      const g = kosten.geschichte(n || 0);
      return {
        seit: g.seit,
        gesamt: g.gesamt,
        proMonat: g.proMonat,
        ...(mitTagen ? { proTag: g.proTag } : {}),
        heute: kosten.stand(),
      };
    },
  },

  stil_lesen: {
    beschreibung: 'Gibt beide Stil-Bloecke zurueck: einen fuer Bild-Prompts, '
      + 'einen fuer Clips. Der passende wird automatisch angehaengt. Wichtig '
      + 'zu kennen: was dort schon steht, gehoert NICHT noch einmal ins Motiv.',
    felder: {},
    async fuehreAus() {
      // Beide auf einmal, nicht zwei Werkzeuge: wer einen Clip aus einem
      // Bild plant, braucht ohnehin beide - und ein zweiter Aufruf waere
      // eine weitere bezahlte Runde fuer zwei Zeilen Text.
      return { bild: stil.ladeStil(), video: stil.ladeStilVideo() };
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
