// Ein Bildauftrag von Anfang bis Ende.
//
// Der ganze Weg an einem Ort: Tagesgrenze pruefen, Modell und Format
// aufloesen, Ordner sicherstellen, Referenzbild laden, Prompt bauen,
// rendern, formatiert schreiben, Sidecar dazu, buchen, in den Verlauf.
//
// Vorher stand das alles in `POST /api/erzeugen` und machte server.mjs zu
// dem, was es laut eigenem Kopfkommentar nicht sein soll. Hier ist es
// Fachlogik unter Fachlogik.
//
// Was diese Datei bewusst NICHT kennt: HTTP. Kein `req`, kein `res`, keine
// Kopfzeilen. `quelle` kommt fertig herein - wer sie aus dem X-Quelle-Kopf
// liest, ist die Route. Deshalb laesst sich der Auftrag auch von einem
// Skript aufrufen, ohne einen Server zu erfinden.
//
// Und was es ebenfalls nicht tut: ein Modell waehlen. Fehlt eine Angabe,
// gilt `konfig.STANDARD` - also das, was der Mensch in der App eingestellt
// hat. Das ist Regel 2 des Projekts, und sie steht genau deshalb hier und
// nicht im Aufrufer.

import path from 'node:path';
import * as konfig from './konfig.mjs';
import {
  absolut, relativ, ordnerNach, saubererName, stelleOrdnerSicher,
} from './pfade.mjs';
import * as bibliothek from './bibliothek.mjs';
import * as format from './format.mjs';
import * as modelleBild from './modelle-bild.mjs';
import * as openrouterBild from './anbieter-openrouter-bild.mjs';
import * as sidecar from './sidecar.mjs';
import * as stil from './stil.mjs';
import * as kosten from './kosten.mjs';
import * as verlauf from './verlauf.mjs';

/** Mehr als zehn auf einmal nimmt niemand entgegen - auch nicht aus Versehen. */
const HOECHSTZAHL = 10;

export async function erzeuge({
  motiv = '', anzahl = 1, klein = false, mitStil = true, name = '',
  modell: modellWunsch = null, formatId: formatWunsch = null, referenz = null,
  vorlageId = null, quelle = 'studio',
} = {}) {
  // Kein Modell, kein Format angegeben? Dann gilt, was in der App steht.
  // Genau darauf verlaesst sich der Chat: Die KI waehlt
  // nie ein Modell, sie erbt die Einstellung des Menschen.
  const modell = modellWunsch || konfig.STANDARD.modellBild;
  const formatId = formatWunsch || konfig.STANDARD.formatId;

  if (!String(motiv).trim()) throw new Error('Kein Motiv angegeben.');
  // Vor allem anderen: reicht das Tagesbudget ueberhaupt noch?
  kosten.pruefe('bild');
  const wieViele = Math.min(Math.max(1, Number(anzahl) || 1), HOECHSTZAHL);

  const modellInfo = modelleBild.finde(modell);
  if (!modellInfo) throw new Error(`Unbekanntes Modell: ${modell}`);

  const m = format.masse(formatId, klein);
  const ordnerDef = ordnerNach(m.ordner);
  stelleOrdnerSicher(ordnerDef.pfad);

  // Referenzbild ist optional. Angegeben heisst mit, weggelassen heisst ohne.
  let referenzBytes = null;
  let referenzTyp = 'image/png';
  if (referenz) {
    if (!modellInfo.kannReferenz) {
      throw new Error(`"${modellInfo.name}" nimmt keine Referenzbilder entgegen.`);
    }
    const refPfad = absolut(referenz);
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
      referenzBild: referenz || null,
      vorlage: vorlageId || null,
      // Nur eintragen, wenn das Modell das gewuenschte Verhaeltnis nicht
      // konnte und ein anderes gerendert hat. Dann wurde beschnitten, und
      // man soll es nachlesen koennen statt zu raten.
      verhaeltnis: lauf.verhaeltnis !== lauf.verhaeltnisGewuenscht
        ? `${lauf.verhaeltnis} statt ${lauf.verhaeltnisGewuenscht}`
        : null,
      kosten: { dollar: lauf.kosten ?? null },
    });

    erzeugt.push(relativ(datei));
  }

  kosten.buche({ bilder: wieViele, dollar: dollarGesamt, modell });
  verlauf.halteFest({
    was: 'erzeugt',
    quelle,
    text: `${wieViele}× ${modellInfo.name} · ${formatId} · "${motiv}"`,
    details: {
      motiv, prompt, modell, modellName: modellInfo.name, formatId, anzahl: wieViele,
      mitStil, referenz: referenz || null,
      dollar: Number(dollarGesamt.toFixed(4)),
      dateien: erzeugt,
    },
  });

  return {
    erzeugt,
    dollar: Number(dollarGesamt.toFixed(4)),
    verbrauch: kosten.stand(),
  };
}
