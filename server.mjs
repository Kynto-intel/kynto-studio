// Kynto Studio - HTTP-Server.
//
// Ausschliesslich Routing: Anfrage aufmachen, an ein lib-Modul weiterreichen,
// Antwort zurueckschreiben. Keine Ausnahme mehr - die drei dicken Bloecke,
// die hier lange lagen (Bild erzeugen, Clip erzeugen, Gespraechsschleife),
// stehen jetzt in lib/auftrag-bild, lib/auftrag-video und lib/gespraech.
//
// Bindet nur an 127.0.0.1, damit nichts ins Netzwerk faellt.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import * as konfig from './lib/konfig.mjs';
import { PORT, HOST, APP, anbieterBereit, schluesselStand, speichereStandard } from './lib/konfig.mjs';
import {
  absolut, relativ, stelleOrdnerSicher, ordnerNach, pruefeInnerhalb,
} from './lib/pfade.mjs';
import * as bibliothek from './lib/bibliothek.mjs';
import * as auftragBild from './lib/auftrag-bild.mjs';
import * as auftragVideo from './lib/auftrag-video.mjs';
import * as gespraech from './lib/gespraech.mjs';
import * as chatverlauf from './lib/chatverlauf.mjs';
import * as modelleChat from './lib/modelle-chat.mjs';
import * as ollama from './lib/ollama.mjs';
import * as sidecar from './lib/sidecar.mjs';
import * as stil from './lib/stil.mjs';
import * as textverlauf from './lib/textverlauf.mjs';
import * as gelernt from './lib/gelernt.mjs';
import * as regie from './lib/regie.mjs';
import * as kosten from './lib/kosten.mjs';
import * as format from './lib/format.mjs';
import * as modelleBild from './lib/modelle-bild.mjs';
import * as modelleVideo from './lib/modelle-video.mjs';
// Nur noch wegen des Guthabenstands - erzeugt wird hier nichts mehr.
import * as openrouterBild from './lib/anbieter-openrouter-bild.mjs';
import * as preise from './lib/preise.mjs';
import * as verlauf from './lib/verlauf.mjs';
import * as vorlagen from './lib/vorlagen.mjs';
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
    videoDauern: konfig.VIDEO_DAUERN,
    videoAufloesungen: konfig.VIDEO_AUFLOESUNGEN,
    grenzen: { ...konfig.GRENZEN },
    chatVerlauf: chatverlauf.lies(),
    vorlagen: vorlagen.mitBestand(),
    stil: stil.ladeStil(),
    standardStil: stil.STANDARD_STIL,
    stilVideo: stil.ladeStilVideo(),
    standardStilVideo: stil.STANDARD_STIL_VIDEO,
    stilVideoDatei: stil.STIL_DATEI_VIDEO,
    regie: regie.ladeRegie(),
    standardRegie: regie.STANDARD_REGIE,
    regieDatei: regie.REGIE_DATEI,
    stilDatei: stil.STIL_DATEI,
    // Wie viele frueheren Fassungen aufgehoben sind. Ohne die Angabe in der
    // Oberflaeche wuesste niemand, dass es den Ordner ueberhaupt gibt.
    textVerlauf: {
      ordner: textverlauf.VERLAUF_ORDNER,
      stil: textverlauf.fassungen('stil-block').length,
      stilVideo: textverlauf.fassungen('stil-block-video').length,
      regie: textverlauf.fassungen('regie').length,
    },
    verbrauch: kosten.stand(),
    zaehlung: bibliothek.zaehlung(),

    schriften: await schriften.verfuegbar(),
    textVorlagen: schriften.VORLAGEN,
  }),

  'GET /api/bestand': async (_req, url) => ({
    ...bibliothek.bestandFuerAnsicht({
      ordner: url.searchParams.get('ordner'),
      art: url.searchParams.get('art'),
      nurFavoriten: url.searchParams.get('favoriten') === '1',
      suche: url.searchParams.get('suche') || '',
      vorlage: url.searchParams.get('vorlage') || null,
    }),
    zaehlung: bibliothek.zaehlung(),
  }),

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
      // Was beim Clip herauskaeme. Steht hier mit drin, weil das die
      // Frage ist, die diese Route beantwortet: was passiert, wenn ich
      // jetzt drücke. Der Vorschlag im Chat zeigt es damit an.
      //
      // Der Preis kommt aus der eigenen Messung je SEKUNDE, nicht aus dem
      // Schnitt je Lauf: ein 8-Sekuender kostet 60 % mehr als ein
      // 5-Sekuender, und ein gemittelter Lauf-Preis waere vor dem Klick
      // eine falsche Zahl. Gemessen 6.9.2026: 0,168 $/s bei 720p auf
      // kling-v3.0-pro, an zwei Laeufen streng linear.
      video: (() => {
        const dauer = Number(k.dauer) || konfig.STANDARD.videoDauer;
        const modellVideo = k.modellVideo || konfig.STANDARD.modellVideo;
        const aufloesung = k.aufloesung || konfig.STANDARD.videoAufloesung;
        const mv = kosten.gemessen()[modellVideo];
        const proSekunde = mv?.proSekunde || null;
        return {
          dauer,
          aufloesung,
          proSekunde,
          dollar: proSekunde ? Number((proSekunde * dauer).toFixed(3)) : null,
          // Hat dieses Modell genau diese Aufloesung schon einmal woertlich
          // abgelehnt, steht es hier - VOR dem Klick statt danach. Das ist
          // der ganze Zweck von gelernt.json: die Ablehnung kostet zwar
          // nichts, aber sie kostet Zeit und einen Moment Ratlosigkeit.
          //
          // null heisst: noch nie probiert. Dann wird nichts behauptet.
          nimmtAufloesung: gelernt.nimmtAufloesung(modellVideo, aufloesung),
          erlaubteAufloesungen: gelernt.bekannteAufloesungen(modellVideo),
        };
      })(),
      verbrauch: kosten.stand(),
    };
  },

  // Erzeugen. Passiert ausschliesslich auf ausdruecklichen Klick - der
  // einzige Weg, der ein Bild erzeugt, fuer den Knopf unten wie fuer jedes
  // fremde Skript. Der Assistent hat keinen; er darf nur vorschlagen.
  'POST /api/erzeugen': async (req) => auftragBild.erzeuge({
    ...await koerperLesen(req),
    quelle: quelleVon(req),
  }),

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

  /**
   * Ohne Parameter die kurze Auswahl, mit ?alle=1 alle rund 360.
   * Zehn Eintraege liest man, vierzig Gruppen durchsucht man vergeblich.
   */
  'GET /api/chat-modelle': async (_req, url) => {
    const vollstaendig = url.searchParams.get('alle') === '1';
    return {
      modelle: vollstaendig
        ? [...await ollama.alle(), ...await modelleChat.alle()]
        : await modelleChat.empfohlen(konfig.STANDARD.chatModell),
      vollstaendig,
      gesamt: (await modelleChat.alle()).length,
    };
  },

  'POST /api/chat-leeren': async () => ({ nachrichten: chatverlauf.leere() }),

  'POST /api/standard': async (req) => {
    const koerper = await koerperLesen(req);
    return { standard: speichereStandard(koerper) };
  },

  'POST /api/regie': async (req) => {
    const { text } = await koerperLesen(req);
    return { regie: regie.speichereRegie(text) };
  },

  // Ein Block je Gattung. `art` fehlt heisst Bild - so bleiben aeltere
  // Aufrufe gueltig, die es nur einen Block lang gab.
  'POST /api/stil': async (req) => {
    const { text, art } = await koerperLesen(req);
    const video = art === 'video';
    const neu = video ? stil.speichereStilVideo(text) : stil.speichereStil(text);
    const wie = video ? 'Video-Stil-Block' : 'Stil-Block';
    verlauf.halteFest({
      was: 'stil',
      quelle: quelleVon(req),
      text: text?.trim() ? `${wie} geändert` : `${wie} auf Standard zurückgesetzt`,
      details: { stil: neu, art: video ? 'video' : 'bild' },
    });
    return { stil: neu, art: video ? 'video' : 'bild' };
  },

  // ------------------------------------------------------------- Grenzen

  'GET /api/grenzen': async () => ({ grenzen: { ...konfig.GRENZEN }, verbrauch: kosten.stand() }),

  'POST /api/grenzen': async (req) => {
    const koerper = await koerperLesen(req);
    const grenzen = konfig.speichereGrenzen(koerper);
    const benennung = { gesamt: 'Gesamt', bild: 'Bild', video: 'Video', chat: 'Assistent' };
    const gesetzt = Object.entries(grenzen)
      .map(([k, v]) => `${benennung[k]} ${v ? `${v} $` : 'aus'}`)
      .join(' · ');
    verlauf.halteFest({
      was: 'einstellung',
      quelle: quelleVon(req),
      text: `Tagesgrenzen geändert: ${gesetzt}`,
      details: { grenzen },
    });
    return { grenzen, verbrauch: kosten.stand() };
  },

  // ------------------------------------------------------------- Vorlagen

  // Beim Ansehen der Vorlagen fehlende Vorschau-Kopien nachholen. Kostet
  // nur beim allerersten Mal je Vorlage etwas und macht den Schutz
  // unabhaengig davon, ob jemand nach dem Erzeugen noch gespeichert hat.
  'GET /api/vorlagen': async () => {
    await vorlagen.holeBilderNach(absolut);
    return { vorlagen: vorlagen.mitBestand() };
  },

  /**
   * Vorlage anlegen oder aendern.
   *
   * Die beiden Pfade laufen hier durch absolut(), bevor irgendetwas
   * geschrieben wird. Damit steht in vorlagen.json garantiert nichts, was
   * ausserhalb der Wurzel zeigt - das Modul selbst prueft keine Pfade.
   */
  'POST /api/vorlage': async (req) => {
    const koerper = await koerperLesen(req);
    for (const feld of ['referenz', 'miniatur']) {
      if (koerper[feld]) absolut(koerper[feld]);
    }

    const vorlage = vorlagen.sichere(koerper);

    // Eigene Kopie des Vorschaubildes anlegen, damit die Vorlage haelt,
    // wenn das Original spaeter im Explorer verschwindet. Schlaegt es fehl,
    // ist die Vorlage trotzdem gespeichert - ein fehlendes Vorschaubild
    // waere aergerlich, ein abgebrochenes Speichern schlimmer.
    if (vorlage.miniatur) {
      const quelle = absolut(vorlage.miniatur);
      if (fs.existsSync(quelle)) await vorlagen.merkeBild(vorlage.id, quelle);
    }

    verlauf.halteFest({
      was: 'vorlage',
      quelle: quelleVon(req),
      text: `Vorlage gespeichert: "${vorlage.name}"`,
      details: {
        name: vorlage.name, art: vorlage.art, modell: vorlage.modell,
        formatId: vorlage.formatId, motiv: vorlage.motiv,
        dateien: vorlage.miniatur ? [vorlage.miniatur] : [],
      },
    });
    return { vorlage, vorlagen: vorlagen.mitBestand() };
  },

  /** Nur die Notiz verschwindet. Bilder und Clips bleiben, wo sie sind. */
  'POST /api/vorlage-loeschen': async (req) => {
    const { id } = await koerperLesen(req);
    const weg = vorlagen.entferne(id);
    verlauf.halteFest({
      was: 'vorlage',
      quelle: quelleVon(req),
      text: `Vorlage gelöscht: "${weg.name}"`,
      details: { name: weg.name, art: weg.art },
    });
    return { vorlagen: vorlagen.mitBestand() };
  },

  'POST /api/modelle-aktualisieren': async (req) => {
    const { art = 'bild' } = await koerperLesen(req);
    const liste = art === 'video'
      ? await modelleVideo.aktualisiere()
      : await modelleBild.aktualisiere();
    return { art, anzahl: liste.length, modelle: liste, preise: await preise.aktualisiere(art) };
  },

  // Clip aus einem Bild, dauert Minuten. Teuerster Weg der App - die
  // Bremse sitzt im Auftrag und nicht hier, damit sie auch greift, wenn ihn
  // jemand ohne diese Route aufruft.
  'POST /api/animieren': async (req) => auftragVideo.erzeuge({
    ...await koerperLesen(req),
    quelle: quelleVon(req),
  }),
};

// ---------------------------------------------------------------- Server

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const schluessel = `${req.method} ${url.pathname}`;

  try {
    if (routen[schluessel]) {
      return json(res, 200, await routen[schluessel](req, url));
    }

    // Ein Gespraechszug als offener Strom. Was hier steht, ist alles, was
    // der Server davon weiss: Kopfzeilen aufmachen, jedes Ereignis als
    // SSE-Zeile durchreichen, am Ende zumachen. Der Zug selbst - Werkzeuge,
    // Kosten, Runden - laeuft in lib/gespraech.mjs.
    if (req.method === 'POST' && url.pathname === '/api/chat') {
      const koerper = await koerperLesen(req);
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store',
        connection: 'keep-alive',
      });
      await gespraech.fuehre({
        nachrichten: koerper.nachrichten,
        sende: (daten) => res.write(`data: ${JSON.stringify(daten)}\n\n`),
      });
      return res.end();
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

    // Das eigene Vorschaubild einer Vorlage. Eigene Route und nicht /datei,
    // weil die Ablage ausserhalb der Wurzel liegt - hier kommt kein Pfad
    // von aussen herein, nur eine Kennung, und geliefert wird ausschliesslich
    // aus daten/vorlagen-bilder/.
    if (req.method === 'GET' && url.pathname === '/api/vorlage-bild') {
      const id = url.searchParams.get('id') || '';
      if (!vorlagen.hatBild(id)) return json(res, 404, { fehler: 'Kein Vorschaubild.' });
      const bytes = vorlagen.liesBild(id);
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
regie.stelleDateiSicher();

server.listen(PORT, HOST, () => {
  const bereit = anbieterBereit();
  const stand = schluesselStand();
  const woher = { datei: 'aus .env', umgebung: 'aus der Umgebung' }[stand.quelle] || '';
  console.log(`Kynto Studio laeuft auf http://${HOST}:${PORT}`);
  console.log(bereit.openrouter
    ? `  OpenRouter: bereit (${woher})`
    : '  OpenRouter: kein Schluessel - OPENROUTER_API_KEY setzen oder .env anlegen');
});
