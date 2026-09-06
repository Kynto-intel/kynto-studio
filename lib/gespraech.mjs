// Der Gespraechszug: Systemhinweis, Werkzeugschleife, Buchung, Speichern.
//
// Das hier ist die Stelle, an der alles zusammenlaeuft - Werkzeuge, Kosten,
// Regie, Verlauf, lokal oder fern. Es stand lange in server.mjs, mit dem
// Argument, es passe in kein einzelnes lib-Modul. Das Argument war schwach:
// die einzige echte Bindung an HTTP war das Schreiben in `res`, und daraus
// wird hier ein Rueckruf `sende`. Wer Ereignisse wohin schickt, weiss die
// Route; was passiert, weiss dieses Modul.
//
// `sende(daten)` wird mit fertigen Ereignissen aufgerufen:
//   { typ: 'text'      , inhalt }              die Antwort
//   { typ: 'werkzeug'  , name, argumente, ergebnis }
//   { typ: 'vorschlag' , id, name, argumente } wartet auf einen Klick
//   { typ: 'fehler'    , text }
//   { typ: 'fertig'    , nachrichten, dollar, verbrauch }
//
// Es gibt bewusst keinen Rueckgabewert: der Zug ist eine Folge von
// Ereignissen, kein Ergebnis. Wer ihn ohne Browser aufruft, sammelt sie
// selbst ein.

import * as konfig from './konfig.mjs';
import { absolut } from './pfade.mjs';
import * as chat from './anbieter-openrouter-chat.mjs';
import * as ollama from './ollama.mjs';
import * as modelleChat from './modelle-chat.mjs';
import * as chatverlauf from './chatverlauf.mjs';
import * as werkzeuge from './werkzeuge.mjs';
import * as regie from './regie.mjs';
import * as kosten from './kosten.mjs';
import * as format from './format.mjs';

/**
 * Was das Modell ueber sich und die App wissen muss.
 *
 * Die zwei harten Regeln stehen absichtlich ganz oben und doppelt: einmal
 * hier, einmal in den Werkzeugbeschreibungen. Ein Modell, das sie ueberliest,
 * kann trotzdem nichts anrichten - `werkzeuge.fuehreAus` weigert sich - aber
 * es soll gar nicht erst danach fragen.
 */
export function systemHinweis(siehtBilder = false) {
  const s = konfig.STANDARD;
  const regieText = regie.ladeRegie();
  const ansehen = siehtBilder
    ? [
      '',
      'Du kannst Bilder wirklich ansehen: bild_ansehen legt dir eines vor.',
      'Nutze es, bevor du etwas ueber ein Bild behauptest - nach dem Erzeugen,',
      'und bevor du Text daraufsetzt. Sag was du siehst, auch wenn es nicht',
      'passt: schiefe Haende, unlesbare Schrift, falsche Stimmung. Ein ehrliches',
      '"das ist nichts geworden" spart ein zweites Bild.',
    ]
    : [
      '',
      'Das eingestellte Modell kann keine Bilder ansehen. Behaupte deshalb',
      'nichts ueber den Inhalt eines Bildes - du kennst nur Dateiname, Motiv',
      'und Prompt aus der Bibliothek.',
    ];
  return [
    'Du bist der Assistent in Kynto Studio, einer lokalen App fuer Bilder und Videos.',
    '',
    'ZWEI REGELN, die du nicht umgehen kannst:',
    '1. Du waehlst KEIN Modell. Womit gerendert wird, stellt der Mensch in der',
    `   App ein. Aktuell: ${s.modellBild} fuer Bilder, ${s.modellVideo} fuer Video`,
    `   (${s.videoDauer} s, ${s.videoAufloesung}), Format ${s.formatId}. Wenn jemand etwas`,
    '   anderes will, sage ihm, dass er es unten in der Leiste umstellt - du',
    '   kannst es nicht.',
    '2. Erzeugen kostet echtes Geld. Du schlaegst es vor, der Mensch klickt.',
    '   Nenne vorher, was es kostet - `einstellung_lesen` sagt es dir.',
    '   Dort stehen auch die Tagesgrenzen und was heute schon verbraucht ist.',
    '   Ist eine Grenze erreicht, schlage nichts vor, was sie sprengt - sag',
    '   es stattdessen. Der Server weist es ohnehin ab, aber ein Vorschlag,',
    '   der gar nicht laufen kann, verschwendet nur die Zeit des Menschen.',
    '',
    // Ohne diese Zuordnung raten schwaechere Modelle: sie antworten aus dem
    // Nichts statt nachzuschlagen. Gemessen 6.9.2026 - gemma4:12b beantwortet
    // "wie viele Bilder habe ich" ohne einen einzigen Werkzeug-Aufruf, rein
    // erfunden. Die Werkzeugbeschreibungen allein reichen dafuer nicht; es
    // muss dastehen, WANN etwas dran ist.
    'WANN DU WAS AUFRUFST - rate nie, schlag nach:',
    '- Frage nach Bestand, Anzahl, "habe ich", "welche Bilder"',
    '    -> bestand_suchen',
    '- Frage nach Kosten, Preis, Modell, Format, Tagesgrenze',
    '    -> einstellung_lesen',
    '- Mockup, Spruchbild, Post - etwas, das er oefter so macht',
    '    -> vorlage_lesen, BEVOR du einen Prompt erfindest',
    '- Bevor du irgendetwas ueber den INHALT eines Bildes sagst',
    '    -> bild_ansehen',
    '- Bevor du das erste Motiv in diesem Gespraech schreibst',
    '    -> stil_lesen, damit du nichts wiederholst was schon drinsteht',
    '- Spruch oder Text soll ins Bild',
    '    -> text_aufs_bild, kostet nichts',
    '- Favorit, Freigabe oder Bildunterschrift setzen',
    '    -> datei_markieren',
    '- Neues Bild oder Clip gewuenscht',
    '    -> bild_erzeugen / video_erzeugen als VORSCHLAG',
    '',
    'Denselben Aufruf nicht wiederholen. Kommt ein Werkzeug mit einem Ergebnis',
    'zurueck, arbeite damit - auch wenn es leer ist. "Nichts gefunden" ist eine',
    'Antwort, kein Grund es dreimal anders zu formulieren.',
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
    ...ansehen,
    // Das Handwerk steht in daten/regie.txt und wird bei jedem Zug frisch
    // gelesen. Leer heisst: der Mensch will keine Hinweise - dann kommt
    // auch keiner, statt ihm einen Standard aufzudraengen.
    ...(regieText ? ['', regieText] : []),
    '',
    'Antworte auf Deutsch, kurz und direkt. Keine Aufzaehlung deiner Werkzeuge,',
    'keine Entschuldigungen. Wenn du etwas nicht kannst, sag es in einem Satz.',
  ].join('\n');
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
export async function fuehre({ nachrichten: rohNachrichten, sende }) {
  const modell = konfig.STANDARD.chatModell;

  // Was aus dem Browser kommt, geht nie ungeprueft weiter. Der Browser
  // haelt seinen eigenen Stand des Gespraechs, und der kann schief sein -
  // eine einzige verwaiste Werkzeug-Antwort darin, und OpenRouter lehnt ab,
  // bis jemand die Datei loescht.
  const nachrichten = chatverlauf.heile(rohNachrichten);
  if (!nachrichten.length) {
    return sende({ typ: 'fehler', text: 'Keine Nachricht angegeben.' });
  }
  if (!modell) {
    return sende({ typ: 'fehler', text: 'Kein Chat-Modell eingestellt.' });
  }

  // Laeuft das Modell hier auf dem Rechner oder ueber OpenRouter? Davon
  // haengt alles Weitere ab: welcher Anbieter gefragt wird, ob die
  // Tagesgrenze greift und ob etwas gebucht wird.
  const lokal = ollama.istLokal(modell);
  const anbieter = lokal ? ollama : chat;

  // Auch Reden kostet - aber nur ueber OpenRouter. Ein lokales Modell
  // rechnet auf der eigenen Karte; die Bremse waere dort eine, die nichts
  // bremst ausser der Lust weiterzuarbeiten.
  if (!lokal) {
    try {
      kosten.pruefe('chat');
    } catch (fehler) {
      return sende({ typ: 'fehler', text: fehler.message });
    }
  }

  // Nur Modelle mit Bildeingang bekommen bild_ansehen angeboten. Ein reines
  // Textmodell wuerde es sonst aufrufen und nichts damit anfangen koennen.
  // Ollama sagt seine Faehigkeiten selbst, OpenRouter ueber die Modell-Liste.
  const modellInfo = lokal
    ? (await ollama.alle()).find((m) => m.id === modell)
    : (await modelleChat.alle()).find((m) => m.id === modell);
  const siehtBilder = Boolean(modellInfo?.siehtBilder);

  const mitSystem = [{ role: 'system', content: systemHinweis(siehtBilder) }, ...nachrichten];
  let dollarGesamt = 0;

  try {
    for (let runde = 1; runde <= chat.MAX_RUNDEN; runde++) {
      const { nachricht, kosten: preis } = await anbieter.frage({
        nachrichten: mitSystem,
        modell,
        werkzeuge: werkzeuge.schema({ siehtBilder }),
      });

      // Lokale Laeufe kosten nichts und werden nicht gebucht - sonst
      // stuende in der Preistabelle ein Modell mit Schnitt 0, das jede
      // Statistik daneben aussehen laesst.
      if (preis && !lokal) {
        dollarGesamt += preis;
        kosten.buche({ dollar: preis, modell, chat: true });
      }
      mitSystem.push(nachricht);
      nachrichten.push(nachricht);

      const aufrufe = nachricht.tool_calls || [];
      if (!aufrufe.length) {
        sende({ typ: 'text', inhalt: nachricht.content || '' });
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
          sende({ typ: 'vorschlag', id: a.id, name, argumente });
          wartetAufKlick = true;
          continue;
        }

        let ergebnis;
        try {
          ergebnis = await werkzeuge.fuehreAus(name, argumente);
        } catch (fehler) {
          ergebnis = { fehler: fehler.message };
        }
        sende({ typ: 'werkzeug', name, argumente, ergebnis });

        const zeile = { role: 'tool', tool_call_id: a.id, content: JSON.stringify(ergebnis) };
        mitSystem.push(zeile);
        nachrichten.push(zeile);

        // Das Bild geht NUR in den Verlauf dieses Zuges, nicht in den
        // gespeicherten. Als Base64 waeren es zweihunderttausend Zeichen -
        // die laegen in chat.json und wuerden bei jedem weiteren Zug erneut
        // bezahlt. Will das Modell es spaeter nochmal sehen, ruft es das
        // Werkzeug wieder auf; das kostet einmal statt immer.
        if (ergebnis.angesehen) {
          try {
            const bytes = await format.kleineFassung(absolut(ergebnis.angesehen));
            mitSystem.push({
              role: 'user',
              content: [
                { type: 'text', text: `Das ist ${ergebnis.angesehen}.` },
                {
                  type: 'image_url',
                  image_url: { url: `data:image/png;base64,${bytes.toString('base64')}` },
                },
              ],
            });
          } catch (fehler) {
            mitSystem.push({
              role: 'user',
              content: `Das Bild liess sich nicht laden: ${fehler.message}`,
            });
          }
        }
      }

      // Auf einen Klick zu warten heisst: hier ist Schluss. Die Antwort auf
      // den Vorschlag kommt als neuer Zug, mit dem Ergebnis als tool-Zeile.
      if (wartetAufKlick) break;

      if (runde === chat.MAX_RUNDEN) {
        sende({ typ: 'text', inhalt: 'Ich drehe mich im Kreis - formulier die Frage bitte anders.' });
      }
    }
  } catch (fehler) {
    sende({ typ: 'fehler', text: fehler.message });
  }

  // Gespeichert wird der geheilte Stand: ein Aufruf, den niemand mehr
  // beantwortet, hat auf der Platte nichts verloren.
  chatverlauf.schreibe(nachrichten);

  // Der Browser bekommt bewusst eine andere Fassung - mit dem offenen
  // Aufruf, falls gerade eine Vorschlagskarte steht. Er beantwortet ihn
  // sofort. Schickte man ihm die gekuerzte, haenge er seine Antwort an
  // einen Aufruf, den er nicht mehr hat, und das Gespraech waere hin.
  sende({
    typ: 'fertig',
    nachrichten: chatverlauf.fuerBrowser(nachrichten),
    dollar: Number(dollarGesamt.toFixed(6)),
    verbrauch: kosten.stand(),
  });
}
