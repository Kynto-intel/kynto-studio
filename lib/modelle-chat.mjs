// KATALOG: TEXTMODELLE FUERS GESPRAECH (OpenRouter)
// Ausschliesslich Daten und Nachladen. Keine Aufruf-Logik - die steht in
// anbieter-openrouter-chat.mjs.
//
// ACHTUNG: Nur Modelle mit `tools` in supported_parameters taugen hier.
// Ein Modell ohne Werkzeug-Aufrufe kann im Studio nichts tun ausser reden -
// es koennte weder suchen noch etwas vorschlagen.
//
// Davon gibt es bei OpenRouter rund 360, in ueber vierzig Gruppen. Alle
// anzubieten heisst, dass man keins mehr findet. Deshalb steht unten eine
// kurze Auswahl quer durch die Preisklassen; der Rest ist weiter erreichbar,
// aber erst auf Wunsch.

const OR = 'https://openrouter.ai/api/v1/models';

/**
 * Die kurze Auswahl.
 *
 * Ein Modell pro Preisklasse und Anbieter, mehr braucht niemand zum Reden.
 * Gemessen ist hier nur eins: Gemini 3.8 Flash fuehrt das Gespraech im
 * Studio zuverlaessig, inklusive Werkzeugen. Die anderen sind nach ihrer
 * bekannten Werkzeug-Tauglichkeit gewaehlt, nicht nachgemessen - das steht
 * so in den Notizen, statt Sicherheit vorzutaeuschen.
 *
 * Kennungen, die OpenRouter fallen laesst, verschwinden von allein: die
 * Auswahl wird gegen die Live-Liste geschnitten.
 */
export const AUSWAHL = [
  // --- kostet nichts -------------------------------------------------------
  // Gratis heisst bei OpenRouter: begrenzte Anfragen pro Tag und keine
  // Zusage, dass das Modell morgen noch da ist. Zum Ausprobieren gut,
  // fuer verlaessliche Arbeit nicht.
  { id: 'z-ai/glm-5.2:free', bereich: 'Kostenlos', notiz: 'Staerkstes Gratis-Modell hier.' },
  { id: 'minimax/minimax-m3:free', bereich: 'Kostenlos', notiz: 'Sehr grosser Kontext.' },

  // --- guenstig ------------------------------------------------------------
  { id: 'qwen/qwen3.7-flash', bereich: 'Günstig', notiz: 'Billigste bezahlte Wahl.' },
  { id: 'openai/gpt-5-nano', bereich: 'Günstig', notiz: 'Kleinstes GPT-5.' },
  { id: 'deepseek/deepseek-v4-flash', bereich: 'Günstig', notiz: 'Viel Kontext fuers Geld.' },
  { id: 'google/gemini-3.1-flash-lite', bereich: 'Günstig', notiz: '' },

  // --- Alltag --------------------------------------------------------------
  { id: 'openai/gpt-5-mini', bereich: 'Alltag', notiz: '' },
  { id: 'mistralai/mistral-medium-3.1', bereich: 'Alltag', notiz: 'Europaeischer Anbieter.' },
  { id: 'moonshotai/kimi-k2.5', bereich: 'Alltag', notiz: '' },
  { id: 'google/gemini-3.8-flash', bereich: 'Alltag', notiz: 'Standard. Hier gemessen, laeuft zuverlaessig.' },
  { id: 'anthropic/claude-haiku-4.5', bereich: 'Alltag', notiz: '' },

  // --- stark ---------------------------------------------------------------
  { id: 'x-ai/grok-4.3', bereich: 'Stark', notiz: 'Guenstigstes der starken.' },
  { id: 'openai/gpt-5', bereich: 'Stark', notiz: '' },
  { id: 'anthropic/claude-sonnet-5', bereich: 'Stark', notiz: 'Versteht auch krumme Formulierungen.' },
  { id: 'anthropic/claude-opus-5', bereich: 'Stark', notiz: 'Teuerste Wahl, fuer den Alltag zu viel.' },
];

/**
 * Zwischenspeicher fuer diesen Serverlauf.
 *
 * Ohne ihn holt jedes Oeffnen der Chat-Leiste 425 Modelle neu. Die Liste
 * aendert sich hoechstens taeglich, nicht minuetlich - ein Neustart oder
 * `aktualisiere()` reicht als Auffrischung.
 */
let zwischenspeicher = null;

/** Preis je Million Zeichen, lesbar aufbereitet. */
function preisNotiz(m) {
  const rein = Number(m.pricing?.prompt) * 1e6;
  const raus = Number(m.pricing?.completion) * 1e6;
  if (!Number.isFinite(rein)) return '';
  if (rein <= 0) return 'kostenlos';
  return `${rein.toFixed(2)} $ / ${raus.toFixed(2)} $ je 1M`;
}

/**
 * Der Anbieter, so wie ein Mensch ihn schreibt.
 *
 * Zwei Fallen stecken in den Rohdaten:
 *
 * 1. Manche Kennungen fangen mit einer Tilde an - `~anthropic/claude-haiku-latest`.
 *    Das sind Verweise auf die jeweils neueste Fassung. Nimmt man das Praefix
 *    roh, steht Anthropic zweimal in der Liste, einmal als "anthropic" und
 *    einmal als "~anthropic". Die Tilde faellt deshalb weg.
 * 2. Das Praefix selbst ist eine Kennung, kein Name: "bytedance-seed",
 *    "ibm-granite", "z-ai". Der Anzeigename traegt den Anbieter meist schon
 *    sauber vor einem Doppelpunkt - "Google: Gemini 3.8 Flash". Den nehmen
 *    wir, wenn er da ist.
 */
function gruppeVon(m) {
  const ausName = m.name?.includes(':') ? m.name.split(':')[0].trim() : '';
  if (ausName) return { label: ausName, ausName: true };

  const kennung = (m.id.split('/')[0] || 'andere').replace(/^~/, '');
  const label = kennung
    .split('-')
    .map((teil) => teil.charAt(0).toUpperCase() + teil.slice(1))
    .join(' ');
  return { label, ausName: false };
}

/**
 * Eine Schreibweise je Anbieter durchsetzen.
 *
 * Sonst steht derselbe Anbieter zweimal in der Liste: "DeepSeek" aus dem
 * Anzeigenamen und "Deepseek" aus der Kennung, weil ein einzelnes Modell
 * keinen Doppelpunkt im Namen hat. Die Schreibweise des Anbieters gewinnt.
 */
function vereinheitliche(modelle) {
  const bevorzugt = new Map();
  for (const m of modelle) {
    const schluessel = m.gruppe.toLowerCase();
    if (m.gruppeAusName || !bevorzugt.has(schluessel)) bevorzugt.set(schluessel, m.gruppe);
  }
  for (const m of modelle) {
    m.gruppe = bevorzugt.get(m.gruppe.toLowerCase()) || m.gruppe;
    delete m.gruppeAusName;
  }
  return modelle;
}

/** Verweist die Kennung auf "die jeweils neueste Fassung"? */
function istVerweis(id) {
  return id.startsWith('~');
}

function baue(roh) {
  const modelle = roh
    .filter((m) => m.supported_parameters?.includes('tools'))
    .map((m) => {
      const preis = preisNotiz(m);
      const g = gruppeVon(m);
      return {
        id: m.id,
        name: m.name || m.id,
        gruppe: g.label,
        gruppeAusName: g.ausName,
        anbieter: 'openrouter',
        // Kann das Modell ein Bild ansehen? Davon haengt ab, ob das
        // Werkzeug bild_ansehen ueberhaupt angeboten wird - ein Modell,
        // das nur Text kann, wuerde es sonst aufrufen und ins Leere greifen.
        siehtBilder: (m.architecture?.input_modalities || []).includes('image'),
        // Bei den Verweisen ist der Hinweis wichtiger als der Preis: sie
        // zeigen auf ein Modell, das sich unter der Hand aendern kann.
        notiz: istVerweis(m.id)
          ? [preis, 'zeigt immer auf die neueste Fassung'].filter(Boolean).join(' · ')
          : preis,
        preisRein: Number.isFinite(Number(m.pricing?.prompt) * 1e6)
          ? Number(m.pricing.prompt) * 1e6
          : null,
      };
    });

  // Erst die Schreibweisen zusammenfuehren, dann sortieren - sonst landen
  // "Deepseek" und "DeepSeek" an verschiedenen Stellen der Liste.
  return vereinheitliche(modelle)
    // Anbieter alphabetisch, innerhalb davon die guenstigsten zuerst. Nach
    // reinem Preis sortiert stehen vierzig Gruppen in scheinbar zufaelliger
    // Folge - man sucht aber nach "Google", nicht nach "0,02 $".
    .sort((a, b) => a.gruppe.localeCompare(b.gruppe, 'de')
      || (a.preisRein ?? 1e9) - (b.preisRein ?? 1e9));
}

/** Holt die Liste live von OpenRouter und legt sie ab. */
export async function aktualisiere() {
  const antwort = await fetch(OR, { headers: { accept: 'application/json' } });
  if (!antwort.ok) throw new Error(`OpenRouter antwortete mit ${antwort.status}`);
  zwischenspeicher = baue((await antwort.json()).data || []);
  return zwischenspeicher;
}

/**
 * Die kurze Auswahl, in vier Bereichen: Kostenlos, Günstig, Alltag, Stark.
 *
 * Nach Bereich statt nach Anbieter, weil die Frage beim Aussuchen nicht
 * "von wem" lautet, sondern "was darf es kosten". Innerhalb eines Bereichs
 * steht das Guenstigste oben - die Reihenfolge aus AUSWAHL.
 *
 * Ein Modell, das der Nutzer selbst aus der vollen Liste gewaehlt hat,
 * bleibt drin, auch wenn es nicht in der Auswahl steht - sonst faellt
 * seine Wahl beim naechsten Laden lautlos auf etwas anderes zurueck.
 */
export async function empfohlen(zusaetzlich = null) {
  const liste = await alle();
  const nachId = new Map(liste.map((m) => [m.id, m]));

  const raus = [];
  for (const e of AUSWAHL) {
    const m = nachId.get(e.id);
    if (!m) continue;
    raus.push({
      ...m,
      gruppe: e.bereich,
      // Ob ein Modell Bilder ansehen kann, entscheidet mit darueber, wozu
      // es taugt - das gehoert neben den Preis, nicht in eine Fussnote.
      notiz: [m.notiz, e.notiz, m.siehtBilder ? null : 'sieht keine Bilder']
        .filter(Boolean).join(' · '),
    });
  }

  if (zusaetzlich && !raus.some((m) => m.id === zusaetzlich)) {
    const m = nachId.get(zusaetzlich);
    if (m) {
      raus.push({
        ...m,
        gruppe: 'Selbst gewählt',
        notiz: m.notiz,
      });
    }
  }
  return raus;
}

/** Die vollstaendige Liste - beim ersten Aufruf wird sie geholt. */
export async function alle() {
  if (!zwischenspeicher) await aktualisiere();
  return zwischenspeicher;
}

/**
 * Ein Modell nachschlagen.
 *
 * Gibt null zurueck, wenn die Liste noch nicht geladen ist - der Aufrufer
 * soll deswegen nichts blockieren. Ein unbekanntes Modell faellt spaetestens
 * beim ersten Gespraechszug auf, und die Meldung von OpenRouter ist dann
 * genauer als jede Vermutung hier.
 */
export function finde(id) {
  if (!zwischenspeicher) return null;
  return zwischenspeicher.find((m) => m.id === id) || null;
}
