// Ein Videoauftrag von Anfang bis Ende.
//
// Gleicher Bau wie auftrag-bild.mjs, gleiche Grenze: kein HTTP hier drin.
// Zwei Dateien und nicht eine, weil ein Clip an drei Stellen anders laeuft -
// Dauer und Aufloesung kommen dazu, es gibt nur einen Lauf statt einer
// Schleife, und geschrieben wird roh statt formatiert. Zusammengelegt
// waere es eine Funktion mit einem Schalter obendrauf.
//
// Video ist der teuerste Weg der App - ein Clip kostet rund das
// Fuenfhundertfache eines Bildes. Deshalb steht `kosten.pruefe('video')`
// hier ganz vorn, noch vor jedem Byte, das gelesen wird.

import fs from 'node:fs';
import path from 'node:path';
import * as konfig from './konfig.mjs';
import {
  absolut, relativ, ordnerNach, saubererName, stelleOrdnerSicher,
} from './pfade.mjs';
import * as bibliothek from './bibliothek.mjs';
import * as format from './format.mjs';
import * as modelleVideo from './modelle-video.mjs';
import * as openrouterVideo from './anbieter-openrouter-video.mjs';
import * as sidecar from './sidecar.mjs';
import * as kosten from './kosten.mjs';
import * as verlauf from './verlauf.mjs';

export async function erzeuge({
  motiv = '', quellBild = null, name = '',
  modell: modellWunsch = null, formatId: formatWunsch = null,
  dauer: dauerWunsch = null, aufloesung: aufloesungWunsch = null,
  quelle = 'studio',
} = {}) {
  // Wie beim Bild: ohne Angabe gilt die Einstellung aus der App. Das
  // betrifft auch Dauer und Aufloesung - der Assistent schlaegt einen
  // Clip vor, wie lang und wie gross er wird, stellt der Mensch ein.
  const modell = modellWunsch || konfig.STANDARD.modellVideo;
  const formatId = formatWunsch || 'story';
  const dauer = konfig.VIDEO_DAUERN.includes(Number(dauerWunsch))
    ? Number(dauerWunsch) : konfig.STANDARD.videoDauer;
  const aufloesung = konfig.VIDEO_AUFLOESUNGEN.includes(aufloesungWunsch)
    ? aufloesungWunsch : konfig.STANDARD.videoAufloesung;

  if (!String(motiv).trim()) throw new Error('Kein Bewegungs-Prompt angegeben.');
  kosten.pruefe('video');
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
    // Ohne diese zwei laesst sich ein Clip spaeter nicht wiederholen -
    // und genau das soll eine Vorlage aus der Detailansicht koennen.
    dauer,
    aufloesung,
    kosten: { dollar: lauf.kosten ?? null },
  });

  kosten.buche({ clips: 1, dollar: lauf.kosten || 0, modell });

  verlauf.halteFest({
    was: 'animiert',
    quelle,
    text: `Clip · ${modellInfo.name} · ${dauer} s · ${aufloesung} · "${motiv}"`,
    details: {
      motiv, modell, modellName: modellInfo.name, formatId, dauer, aufloesung,
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
}
