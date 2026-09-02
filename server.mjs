// Kynto Studio - HTTP-Server.
// Ausschliesslich Routing. Jede Fachlogik liegt in lib/.
// Bindet nur an 127.0.0.1, damit nichts ins Netzwerk faellt.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import * as konfig from './lib/konfig.mjs';
import { PORT, HOST, APP, anbieterBereit, schluesselStand, speichereStandard } from './lib/konfig.mjs';
import {
  absolut, relativ, stelleOrdnerSicher, ordnerNach, saubererName, pruefeInnerhalb,
} from './lib/pfade.mjs';
import * as bibliothek from './lib/bibliothek.mjs';
import * as chat from './lib/anbieter-openrouter-chat.mjs';
import * as chatverlauf from './lib/chatverlauf.mjs';
import * as modelleChat from './lib/modelle-chat.mjs';
import * as werkzeuge from './lib/werkzeuge.mjs';
import * as sidecar from './lib/sidecar.mjs';
import * as stil from './lib/stil.mjs';
import * as kosten from './lib/kosten.mjs';
import * as format from './lib/format.mjs';
import * as modelleBild from './lib/modelle-bild.mjs';
import * as modelleVideo from './lib/modelle-video.mjs';
import * as openrouterBild from './lib/anbieter-openrouter-bild.mjs';
import * as openrouterVideo from './lib/anbieter-openrouter-video.mjs';
import * as preise from './lib/preise.mjs';
import * as verlauf from './lib/verlauf.mjs';
import * as textebene from './lib/text.mjs';
import * as schriften from './lib/schriften.mjs';

const WEB = path.join(APP, 'web');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

function json(res, code, daten) {
  const koerper = JSON.stringify(daten);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(koerper),
    'cache-control': 'no-store',
  });
  res.end(koerper);
}

/**
 * Wer hat die Anfrage ausgeloest?
 *
 * Die Oberflaeche laesst das Feld leer. Ein Programm von aussen, das die
 * API benutzt, kann sich mit dem Kopf X-Quelle melden - dann steht das im
 * Verlauf und man sieht, dass es nicht man selbst war.
 */
function quelleVon(req) {
  const roh = String(req.headers['x-quelle'] || '').toLowerCase();
  return roh === 'claude' ? 'claude' : 'studio';
}

async function koerperLesen(req) {
  const teile = [];
  for await (const stueck of req) teile.push(stueck);
  if (!teile.length) return {};
  try {
    return JSON.parse(Buffer.concat(teile).toString('utf8'));
  } catch {
    throw new Error('Ungueltiges JSON im Anfrage-Koerper');
  }
}

// ---------------------------------------------------------------- Gespraech

/**
 * Was das Modell ueber sich und die App wissen muss.
 *
 * Die zwei harten Regeln stehen absichtlich ganz oben und doppelt: einmal
 * hier, einmal in den Werkzeugbeschreibungen. Ein Modell, das sie ueberliest,
 * kann trotzdem nichts anrichten - `werkzeuge.fuehreAus` weigert sich - aber
 * es soll gar nicht erst danach fragen.
 */
function systemHinweis() {
  const s = konfig.STANDARD;
  return [
    'Du bist der Assistent in Kynto Studio, einer lokalen App fuer Bilder und Videos.',
    '',
    'ZWEI REGELN, die du nicht umgehen kannst:',
    '1. Du waehlst KEIN Modell. Womit gerendert wird, stellt der Mensch in der',
    `   App ein. Aktuell: ${s.modellBild} fuer Bilder, ${s.modellVideo} fuer Video,`,
    `   Format ${s.formatId}. Wenn jemand ein anderes Modell will, sage ihm, dass`,
    '   er es unten in der Leiste umstellt - du kannst es nicht.',
    '2. Erzeugen kostet echtes Geld. Du schlaegst es vor, der Mensch klickt.',
    '   Nenne vorher, was es kostet - `einstellung_lesen` sagt es dir.',
    '',
    'Zum Bildaufbau:',
    '- Motive auf Englisch, und NUR den Bildinhalt beschreiben. Palette, Licht',
    '  und Stimmung haengt der Stil-Block automatisch an jeden Prompt. Wiederhole',
    '  sie nicht, das verwaessert nur. Mit `stil_lesen` siehst du, was drinsteht.',
    `- Formate: ${werkzeuge.formateAlsText()}`,
    '- Text im Bild kann kein Bildmodell. Ein einzelnes Wort ja, ein ganzer Satz',
    '  nicht. Fuer Sprueche erst das Motiv rendern, dann `text_aufs_bild` - das',
    '  laeuft lokal und kostet nichts.',
    '',
    'Antworte auf Deutsch, kurz und direkt. Keine Aufzaehlung deiner Werkzeuge,',
    'keine Entschuldigungen. Wenn du etwas nicht kannst, sag es in einem Satz.',
  ].join('\n');
}

/** Ein Ereignis an den Browser schicken. */
function sende(res, daten) {
  res.write(`data: ${JSON.stringify(daten)}\n\n`);
}

/**
 * Ein Gespraechszug, moeglicherweise ueber mehrere Werkzeug-Runden.
 *
 * Endet in einem von drei Zustaenden:
 *   - Text: das Modell hat geantwortet, fertig.
 *   - Vorschlag: das Modell will etwas erzeugen. Die Schleife bricht ab und
 *     wartet auf den Klick des Menschen. Der Browser fuehrt dann selbst
 *     /api/erzeugen aus und schickt das Ergebnis als naechsten Zug zurueck.
 *   - Fehler.
 */
async function fuehreGespraech(req, res) {
  const koerper = await koerperLesen(req);
  const modell = konfig.STANDARD.chatModell;

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    connection: 'keep-alive',
  });

  const nachrichten = Array.isArray(koerper.nachrichten) ? [...koerper.nachrichten] : [];
  if (!nachrichten.length) {
    sende(res, { typ: 'fehler', text: 'Keine Nachricht angegeben.' });
    return res.end();
  }
  if (!modell) {
    sende(res, { typ: 'fehler', text: 'Kein Chat-Modell eingestellt.' });
    return res.end();
  }

  const mitSystem = [{ role: 'system', content: systemHinweis() }, ...nachrichten];
  let dollarGesamt = 0;

  try {
    for (let runde = 1; runde <= chat.MAX_RUNDEN; runde++) {
      const { nachricht, kosten: preis } = await chat.frage({
        nachrichten: mitSystem,
        modell,
        werkzeuge: werkzeuge.schema(),
      });

      if (preis) {
        dollarGesamt += preis;
        kosten.buche({ dollar: preis, modell, chat: true });
      }
      mitSystem.push(nachricht);
      nachrichten.push(nachricht);

      const aufrufe = nachricht.tool_calls || [];
      if (!aufrufe.length) {
        sende(res, { typ: 'text', inhalt: nachricht.content || '' });
        break;
      }

      let wartetAufKlick = false;
      for (const a of aufrufe) {
        const name = a.function?.name;
        let argumente = {};
        try {
          argumente = JSON.parse(a.function?.arguments || '{}');
        } catch { /* kaputte Argumente wie leer behandeln */ }

        if (werkzeuge.brauchtBestaetigung(name)) {
          sende(res, { typ: 'vorschlag', id: a.id, name, argumente });
          wartetAufKlick = true;
          continue;
        }

        let ergebnis;
        try {
          ergebnis = await werkzeuge.fuehreAus(name, argumente);
        } catch (fehler) {
          ergebnis = { fehler: fehler.message };
        }
        sende(res, { typ: 'werkzeug', name, argumente, ergebnis });

        const zeile = { role: 'tool', tool_call_id: a.id, content: JSON.stringify(ergebnis) };
        mitSystem.push(zeile);
        nachrichten.push(zeile);
      }

      // Auf einen Klick zu warten heisst: hier ist Schluss. Die Antwort auf
      // den Vorschlag kommt als neuer Zug, mit dem Ergebnis als tool-Zeile.
      if (wartetAufKlick) break;

      if (runde === chat.MAX_RUNDEN) {
        sende(res, { typ: 'text', inhalt: 'Ich drehe mich im Kreis - formulier die Frage bitte anders.' });
      }
    }
  } catch (fehler) {
    sende(res, { typ: 'fehler', text: fehler.message });
  }

  // Erst speichern, dann melden: was der Browser bekommt, ist genau das,
  // was auf der Platte steht - inklusive Kuerzung und Heilung.
  const gespeichert = chatverlauf.schreibe(nachrichten);

  sende(res, {
    typ: 'fertig',
    nachrichten: gespeichert,
    dollar: Number(dollarGesamt.toFixed(6)),
    verbrauch: kosten.stand(),
  });
  res.end();
}

// ---------------------------------------------------------------- Routen

const routen = {
  /** Alles, was die Oberflaeche zum Start braucht. */
  'GET /api/start': async () => ({
    guthaben: await openrouterBild.guthaben(),
    preise: { bild: await preise.fuer('bild'), video: await preise.fuer('video') },
    gemessen: kosten.gemessen(),
    ordner: konfig.ORDNER.map(({ id, label, hinweis, schreibbar }) => ({ id, label, hinweis, schreibbar })),
    formate: Object.entries(konfig.FORMATE).map(([id, f]) => ({
      id, label: f.label, genW: f.genW, genH: f.genH, zielW: f.zielW, zielH: f.zielH,
    })),
    modelleBild: modelleBild.alle().map((m) => ({ ...m, art: 'bild' })),
    modelleVideo: modelleVideo.fuerBildZuVideo().map((m) => ({ ...m, art: 'video', kannReferenz: m.kannBildEingang })),
    anbieter: anbieterBereit(),
    schluessel: schluesselStand(),
    standard: { ...konfig.STANDARD },
    chatVerlauf: chatverlauf.lies(),
    stil: stil.ladeStil(),
    standardStil: stil.STANDARD_STIL,
    stilDatei: stil.STIL_DATEI,
    verbrauch: kosten.stand(),
    zaehlung: bibliothek.zaehlung(),

    schriften: await schriften.verfuegbar(),
    textVorlagen: schriften.VORLAGEN,
  }),

  'GET /api/bestand': async (_req, url) => ({
    ...bibliothek.bestandFuerAnsicht({
      ordner: url.searchParams.get('ordner') || null,
      art: url.searchParams.get('art') || null,
      nurFavoriten: url.searchParams.get('favoriten') === '1',
      suche: url.searchParams.get('suche') || '',
    }),
    zaehlung: bibliothek.zaehlung(),
  }),

  /**
   * Kostenschaetzung VOR dem Erzeugen. Nichts wird gerendert.
   * Gemessene Preise schlagen die Schaetzung aus der Modell-Liste.
   */
  'POST /api/schaetzung': async (req) => {
    const k = await koerperLesen(req);
    const modell = k.modell || konfig.STANDARD.modellBild;
    const formatId = k.formatId || konfig.STANDARD.formatId;
    const { anzahl = 1, klein = false } = k;
    const m = format.masse(formatId, klein);
    const gemessen = kosten.gemessen()[modell]?.schnitt || null;
    const geschaetzt = (await preise.fuer('bild'))[modell]?.schaetzungProBild || null;
    const proBild = gemessen || geschaetzt;
    return {
      anzahl,
      proBild,
      gemessen: Boolean(gemessen),
      dollar: proBild ? Number((proBild * anzahl).toFixed(4)) : null,
      masse: `${m.genW}x${m.genH}`,
      ziel: m.zielW ? `${m.zielW}x${m.zielH}` : 'roh',
      verbrauch: kosten.stand(),
    };
  },

  /** Erzeugen. Passiert ausschliesslich auf ausdruecklichen Klick. */
  'POST /api/erzeugen': async (req) => {
    const koerper = await koerperLesen(req);
    const {
      motiv = '', anzahl = 1, klein = false, mitStil = true, name = '',
    } = koerper;

    // Kein Modell, kein Format angegeben? Dann gilt, was in der App steht.
    // Genau darauf verlaesst sich der Chat: Die KI waehlt
    // nie ein Modell, sie erbt die Einstellung des Menschen.
    const modell = koerper.modell || konfig.STANDARD.modellBild;
    const formatId = koerper.formatId || konfig.STANDARD.formatId;

    if (!String(motiv).trim()) throw new Error('Kein Motiv angegeben.');
    const wieViele = Math.min(Math.max(1, Number(anzahl) || 1), 10);

    const modellInfo = modelleBild.finde(modell);
    if (!modellInfo) throw new Error(`Unbekanntes Modell: ${modell}`);

    const m = format.masse(formatId, klein);
    const ordnerDef = ordnerNach(m.ordner);
    stelleOrdnerSicher(ordnerDef.pfad);

    // Referenzbild ist optional. Angegeben heisst mit, weggelassen heisst ohne.
    let referenzBytes = null;
    let referenzTyp = 'image/png';
    if (koerper.referenz) {
      if (!modellInfo.kannReferenz) {
        throw new Error(`"${modellInfo.name}" nimmt keine Referenzbilder entgegen.`);
      }
      const refPfad = absolut(koerper.referenz);
      referenzBytes = bibliothek.lieferDatei(refPfad);
      referenzTyp = path.extname(refPfad).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
    }

    const prompt = stil.bauePrompt(motiv, mitStil);
    const stempel = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const basis = saubererName(name || motiv.split(/\s+/).slice(0, 4).join('-'));

    const erzeugt = [];
    let dollarGesamt = 0;

    for (let i = 1; i <= wieViele; i++) {
      const lauf = await openrouterBild.erzeugeBild({
        prompt, modell, breite: m.genW, hoehe: m.genH,
        referenzBild: referenzBytes, referenzTyp,
      });

      const nummer = wieViele > 1 ? `_v${i}` : '';
      const datei = path.join(ordnerDef.pfad, `${basis}_${stempel}${nummer}_${m.suffix}.png`);
      await format.schreibeFormatiert({
        bytes: lauf.bytes, zielDatei: datei, zielW: m.zielW, zielH: m.zielH,
      });

      dollarGesamt += lauf.kosten || 0;

      sidecar.schreibe(datei, {
        prompt, motiv, stilBlock: mitStil ? stil.ladeStil() : '', mitStil,
        anbieter: modellInfo.anbieter, modell, format: formatId,
        erstellt: new Date().toISOString(),
        referenzBild: koerper.referenz || null,
        kosten: { dollar: lauf.kosten ?? null },
      });

      erzeugt.push(relativ(datei));
    }

    kosten.buche({ bilder: wieViele, dollar: dollarGesamt, modell });
    verlauf.halteFest({
      was: 'erzeugt',
      quelle: quelleVon(req),
      text: `${wieViele}× ${modellInfo.name} · ${formatId} · "${motiv}"`,
      details: {
        motiv, prompt, modell, modellName: modellInfo.name, formatId, anzahl: wieViele,
        mitStil, referenz: koerper.referenz || null,
        dollar: Number(dollarGesamt.toFixed(4)),
        dateien: erzeugt,
      },
    });

    return {
      erzeugt,
      dollar: Number(dollarGesamt.toFixed(4)),
      verbrauch: kosten.stand(),
    };
  },

  /**
   * Datei wirklich umbenennen - nicht nur die Anzeige.
   * Das Sidecar zieht mit um, die Endung bleibt wie sie war.
   */
  'POST /api/umbenennen': async (req) => {
    const { pfad, neuerName } = await koerperLesen(req);
    const alt = absolut(pfad);
    if (!fs.existsSync(alt)) throw new Error('Datei nicht gefunden.');

    const roh = String(neuerName || '').trim();
    if (!roh) throw new Error('Der Name darf nicht leer sein.');
    if (/[\\/:*?"<>|]/.test(roh)) {
      throw new Error('Diese Zeichen gehen nicht im Dateinamen: \\ / : * ? " < > |');
    }

    // Endung behalten, auch wenn sie mit eingetippt oder weggelassen wird.
    const endung = path.extname(alt);
    const ohneEndung = roh.toLowerCase().endsWith(endung.toLowerCase())
      ? roh.slice(0, -endung.length)
      : roh;
    if (!ohneEndung.trim()) throw new Error('Der Name darf nicht nur aus der Endung bestehen.');

    const neu = path.join(path.dirname(alt), `${ohneEndung.trim()}${endung}`);
    pruefeInnerhalb(neu);
    if (neu === alt) return { pfad: relativ(alt), name: path.basename(alt), unveraendert: true };
    if (fs.existsSync(neu)) throw new Error(`"${path.basename(neu)}" gibt es hier schon.`);

    fs.renameSync(alt, neu);
    sidecar.benenneUm(alt, neu);

    verlauf.halteFest({
      was: 'umbenannt',
      quelle: quelleVon(req),
      text: `${path.basename(alt)} → ${path.basename(neu)}`,
      details: { vorher: relativ(alt), nachher: relativ(neu) },
    });

    return { pfad: relativ(neu), name: path.basename(neu) };
  },

  /**
   * Text aufs Bild anwenden. Legt eine NEUE Datei an, das Original bleibt
   * unangetastet. Die Ebenen wandern ins Sidecar, damit man das Textbild
   * spaeter wieder oeffnen und aendern kann.
   */
  'POST /api/text-anwenden': async (req) => {
    const { pfad, ebenen } = await koerperLesen(req);
    const quelle = absolut(pfad);
    if (!fs.existsSync(quelle)) throw new Error('Bild nicht gefunden.');

    const bytes = await textebene.rendere({ quellDatei: quelle, ebenen });

    // Das Ergebnis landet normalerweise neben dem Original. Liegt das
    // Original aber in einem Ordner, der auf "nur anzeigen" steht, waere
    // das ein Verstoss gegen genau die Einstellung - dann geht es in den
    // Zielordner des aktuellen Formats, wie ein erzeugtes Bild auch.
    const quellOrdner = konfig.ORDNER.find((o) => quelle.startsWith(o.pfad + path.sep));
    let zielOrdner = null;
    if (quellOrdner && !quellOrdner.schreibbar) {
      const m = format.masse(konfig.STANDARD.formatId, false);
      zielOrdner = stelleOrdnerSicher(ordnerNach(m.ordner).pfad);
    }

    const ziel = textebene.freierName(quelle, zielOrdner);
    fs.writeFileSync(ziel, bytes);

    const elternMeta = sidecar.lies(quelle);
    sidecar.schreibe(ziel, {
      ...elternMeta,
      eltern: relativ(quelle),
      version: (Number(elternMeta.version) || 1) + 1,
      erstellt: new Date().toISOString(),
      textEbenen: (Array.isArray(ebenen) ? ebenen : [ebenen]).map(textebene.normalisiere),
    });

    const ersteZeile = (Array.isArray(ebenen) ? ebenen : [ebenen])[0]?.text || '';
    verlauf.halteFest({
      was: 'text',
      quelle: quelleVon(req),
      text: `Text auf ${path.basename(quelle)}: "${ersteZeile.slice(0, 60)}"`,
      details: { vorlage: relativ(quelle), dateien: [relativ(ziel)] },
    });

    return { pfad: relativ(ziel), name: path.basename(ziel) };
  },

  'POST /api/sidecar': async (req) => {
    const { pfad, aenderungen } = await koerperLesen(req);
    return sidecar.aktualisiere(absolut(pfad), aenderungen || {});
  },

  /** Aktuelle Ordner-Einstellungen fuer den Einstellungsdialog. */
  'GET /api/konfig': async () => konfig.rohKonfig(),

  /**
   * Ordner aendern. Wirkt sofort, ohne Neustart - die Module lesen ihre
   * Werte ueber lebende Bindungen aus konfig.mjs.
   */
  'POST /api/konfig': async (req) => {
    const { wurzel, ordner } = await koerperLesen(req);
    const neu = konfig.speichereKonfig({ wurzel, ordner });

    // Fehlende Ordner anlegen - sonst zeigt die Galerie leere Eintraege
    // fuer Verzeichnisse, die es gar nicht gibt.
    for (const o of konfig.ORDNER) {
      if (o.schreibbar) stelleOrdnerSicher(o.pfad);
    }

    verlauf.halteFest({
      was: 'einstellung',
      quelle: quelleVon(req),
      text: `Ordner geändert · ${neu.ordner.length} Ordner unter ${neu.wurzel}`,
      details: { wurzel: neu.wurzel, ordner: neu.ordner.map((o) => o.label) },
    });

    return { ...neu, zaehlung: bibliothek.zaehlung() };
  },

  /**
   * Die Einstellung der Oberflaeche festhalten: Modell und Format.
   * Wird bei jeder Aenderung gerufen, damit Oberflaeche, Chat und ein
   * Agent von aussen dieselbe Wahl sehen wie das Browserfenster.
   */
  /**
   * Textmodelle, die Werkzeuge beherrschen. Wird erst geholt, wenn der Chat
   * das erste Mal aufgeht - die Liste ist gross und beim Start nicht noetig.
   */
  /**
   * Alles fuer das Verlaufsfenster in einem Aufruf: was passiert ist und
   * das Gespraech. Bewusst getrennt von /api/start - das Fenster braucht
   * weder Modellkataloge noch Schriften, und /api/start braucht keine
   * fuenfhundert Verlaufseintraege.
   */
  'GET /api/verlauf': async (_req, url) => {
    const anzahl = Math.min(Math.max(1, Number(url.searchParams.get('anzahl')) || 500), 2000);

    // Welche Dateien es noch gibt, weiss nur der Server. Ohne diese
    // Markierung muesste der Browser jede Miniatur laden, um zu merken,
    // dass sie fehlt - und der Verlauf reicht weiter zurueck als der
    // Bestand, geloescht wird ausserhalb der App.
    const eintraege = verlauf.letzte(anzahl).map((e) => {
      const dateien = e.details?.dateien;
      if (!dateien?.length) return e;
      const da = dateien.filter((p) => {
        try {
          return fs.existsSync(absolut(p));
        } catch {
          return false;
        }
      });
      return { ...e, details: { ...e.details, dateienDa: da } };
    });

    return { eintraege, chat: chatverlauf.lies() };
  },

  /** Ein einzelner Bestandseintrag - fuer die Detailansicht aus dem Verlauf. */
  'GET /api/eintrag': async (_req, url) => {
    const roh = url.searchParams.get('pfad') || '';
    const e = bibliothek.einzeln(absolut(roh));
    if (!e) throw new Error('Datei nicht mehr vorhanden.');
    return { eintrag: e };
  },

  'GET /api/chat-modelle': async () => ({ modelle: await modelleChat.alle() }),

  'POST /api/chat-leeren': async () => ({ nachrichten: chatverlauf.leere() }),

  'POST /api/standard': async (req) => {
    const koerper = await koerperLesen(req);
    return { standard: speichereStandard(koerper) };
  },

  'POST /api/stil': async (req) => {
    const { text } = await koerperLesen(req);
    const neu = stil.speichereStil(text);
    verlauf.halteFest({
      was: 'stil',
      quelle: quelleVon(req),
      text: text?.trim() ? 'Stil-Block geändert' : 'Stil-Block auf Standard zurückgesetzt',
      details: { stil: neu },
    });
    return { stil: neu };
  },

  'POST /api/modelle-aktualisieren': async (req) => {
    const { art = 'bild' } = await koerperLesen(req);
    const liste = art === 'video'
      ? await modelleVideo.aktualisiere()
      : await modelleBild.aktualisiere();
    return { art, anzahl: liste.length, modelle: liste, preise: await preise.aktualisiere(art) };
  },

  /** Clip aus einem Bild. Laeuft asynchron und dauert Minuten. */
  'POST /api/animieren': async (req) => {
    const koerper = await koerperLesen(req);
    const {
      motiv = '', quellBild = null,
      dauer = 5, aufloesung = '1080p', name = '',
    } = koerper;

    // Wie beim Bild: ohne Angabe gilt die Einstellung aus der App.
    const modell = koerper.modell || konfig.STANDARD.modellVideo;
    const formatId = koerper.formatId || 'story';

    if (!String(motiv).trim()) throw new Error('Kein Bewegungs-Prompt angegeben.');
    const modellInfo = modelleVideo.finde(modell);
    if (!modellInfo) throw new Error(`Unbekanntes Videomodell: ${modell}`);

    let startBytes = null;
    let startTyp = 'image/png';
    if (quellBild) {
      if (!modellInfo.kannBildEingang) {
        throw new Error(`"${modellInfo.name}" nimmt kein Standbild entgegen.`);
      }
      const p = absolut(quellBild);
      startBytes = bibliothek.lieferDatei(p);
      startTyp = path.extname(p).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
    }

    const m = format.masse(formatId, false);
    const ordnerDef = ordnerNach(m.ordner);
    stelleOrdnerSicher(ordnerDef.pfad);

    const lauf = await openrouterVideo.erzeugeVideo({
      prompt: motiv, modell, breite: m.zielW || m.genW, hoehe: m.zielH || m.genH,
      dauer, aufloesung, startBild: startBytes, startBildTyp: startTyp,
    });

    const stempel = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const basis = saubererName(name || motiv.split(/\s+/).slice(0, 4).join('-'));
    const endung = lauf.typ.includes('webm') ? 'webm' : 'mp4';
    const datei = path.join(ordnerDef.pfad, `${basis}_${stempel}_clip.${endung}`);
    fs.writeFileSync(datei, lauf.bytes);

    sidecar.schreibe(datei, {
      prompt: motiv, motiv, anbieter: 'openrouter', modell, format: formatId,
      erstellt: new Date().toISOString(),
      referenzBild: quellBild || null,
      kosten: { dollar: lauf.kosten ?? null },
    });

    kosten.buche({ clips: 1, dollar: lauf.kosten || 0, modell });

    verlauf.halteFest({
      was: 'animiert',
      quelle: quelleVon(req),
      text: `Clip · ${modellInfo.name} · "${motiv}"`,
      details: {
        motiv, modell, modellName: modellInfo.name, formatId,
        quellBild: quellBild || null, dollar: lauf.kosten, sekunden: lauf.dauer,
        dateien: [relativ(datei)],
      },
    });

    return {
      erzeugt: [relativ(datei)],
      dollar: lauf.kosten,
      sekunden: lauf.dauer,
      verbrauch: kosten.stand(),
    };
  },
};

// ---------------------------------------------------------------- Server

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const schluessel = `${req.method} ${url.pathname}`;

  try {
    if (routen[schluessel]) {
      return json(res, 200, await routen[schluessel](req, url));
    }

    // Offener Strom: der Browser sieht jeden Vorgang sofort, auch wenn
    // ein Programm ihn ueber die API ausgeloest hat.
    if (req.method === 'POST' && url.pathname === '/api/chat') {
      return fuehreGespraech(req, res);
    }

    if (req.method === 'GET' && url.pathname === '/api/verlauf-strom') {
      return verlauf.melde(req, res);
    }

    // Vorschau: liefert das PNG direkt zurueck, nicht als JSON.
    // Gerendert wird kleiner - alle Masse sind relativ, das Ergebnis sieht
    // deshalb identisch aus, nur in weniger Pixeln.
    if (req.method === 'POST' && url.pathname === '/api/text-vorschau') {
      const { pfad, ebenen, maxHoehe = 620 } = await koerperLesen(req);
      const bytes = await textebene.rendere({
        quellDatei: absolut(pfad), ebenen, maxHoehe,
      });
      res.writeHead(200, {
        'content-type': 'image/png',
        'content-length': bytes.length,
        'cache-control': 'no-store',
      });
      return res.end(bytes);
    }

    // Dateien aus der Bibliothek ausliefern
    if (req.method === 'GET' && url.pathname === '/datei') {
      const voll = absolut(url.searchParams.get('pfad') || '');
      const bytes = bibliothek.lieferDatei(voll);
      res.writeHead(200, {
        'content-type': MIME[path.extname(voll).toLowerCase()] || 'application/octet-stream',
        'content-length': bytes.length,
        'cache-control': 'no-store',
      });
      return res.end(bytes);
    }

    // Oberflaeche
    if (req.method === 'GET') {
      const rein = url.pathname === '/' ? '/index.html' : url.pathname;
      const datei = path.join(WEB, rein.replace(/^\/+/, ''));
      if (datei.startsWith(WEB) && fs.existsSync(datei) && fs.statSync(datei).isFile()) {
        const bytes = fs.readFileSync(datei);
        res.writeHead(200, {
          'content-type': MIME[path.extname(datei).toLowerCase()] || 'text/plain; charset=utf-8',
          'content-length': bytes.length,
          // Kein Zwischenspeichern: sonst zeigt der Browser nach einer
          // Aenderung an CSS oder JS noch den alten Stand.
          'cache-control': 'no-store',
        });
        return res.end(bytes);
      }
    }

    json(res, 404, { fehler: 'Nicht gefunden' });
  } catch (fehler) {
    json(res, 400, { fehler: fehler.message, verbrauch: kosten.stand() });
  }
});

// Stil-Datei beim Start anlegen, damit sie immer existiert und auch
// ausserhalb der App bearbeitet werden kann.
stil.stelleDateiSicher();

server.listen(PORT, HOST, () => {
  const bereit = anbieterBereit();
  const stand = schluesselStand();
  const woher = { datei: 'aus .env', umgebung: 'aus der Umgebung' }[stand.quelle] || '';
  console.log(`Kynto Studio laeuft auf http://${HOST}:${PORT}`);
  console.log(bereit.openrouter
    ? `  OpenRouter: bereit (${woher})`
    : '  OpenRouter: kein Schluessel - OPENROUTER_API_KEY setzen oder .env anlegen');
});
