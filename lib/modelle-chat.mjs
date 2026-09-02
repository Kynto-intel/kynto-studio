// KATALOG: TEXTMODELLE FUERS GESPRAECH (OpenRouter)
// Ausschliesslich Daten und Nachladen. Keine Aufruf-Logik - die steht in
// anbieter-openrouter-chat.mjs.
//
// Anders als bei Bild und Video gibt es hier KEINE eingebaute Liste. Das
// waeren ueber dreihundert Eintraege, die schneller veralten als jede
// Pflege hinterherkommt - und im Gegensatz zu Bildmodellen gibt es hier
// nichts zu kuratieren: was zaehlt, steht in den Daten (Preis, Anbieter,
// beherrscht Werkzeuge). Deshalb kommt die Liste vollstaendig live.
//
// ACHTUNG: Nur Modelle mit `tools` in supported_parameters taugen hier.
// Ein Modell ohne Werkzeug-Aufrufe kann im Studio nichts tun ausser reden -
// es koennte weder suchen noch etwas vorschlagen.

const OR = 'https://openrouter.ai/api/v1/models';

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

function baue(roh) {
  return roh
    .filter((m) => m.supported_parameters?.includes('tools'))
    .map((m) => ({
      id: m.id,
      name: m.name || m.id,
      // Der Anbieter steckt im Praefix der id - "google/gemini-3.8-flash".
      gruppe: m.id.split('/')[0] || 'andere',
      anbieter: 'openrouter',
      notiz: preisNotiz(m),
      preisRein: Number.isFinite(Number(m.pricing?.prompt) * 1e6)
        ? Number(m.pricing.prompt) * 1e6
        : null,
    }))
    // Guenstige zuerst. Wer im Studio chattet, will keine Rechnung, sondern
    // ein Werkzeug, das versteht was er meint - und das koennen die
    // mittleren Modelle laengst.
    .sort((a, b) => (a.preisRein ?? 1e9) - (b.preisRein ?? 1e9));
}

/** Holt die Liste live von OpenRouter und legt sie ab. */
export async function aktualisiere() {
  const antwort = await fetch(OR, { headers: { accept: 'application/json' } });
  if (!antwort.ok) throw new Error(`OpenRouter antwortete mit ${antwort.status}`);
  zwischenspeicher = baue((await antwort.json()).data || []);
  return zwischenspeicher;
}

/** Die Liste - beim ersten Aufruf wird sie geholt. */
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
