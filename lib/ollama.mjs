// ANBIETER + KATALOG: Ollama, lokal auf dem eigenen Rechner.
//
// Ausnahme von der Regel "Katalog getrennt vom Anbieter". Bei OpenRouter
// ist der Katalog eine gepflegte Datenliste mit kuratierten Namen und
// Notizen - die gehoert nicht neben die Aufruf-Logik. Hier ist der Katalog
// drei Zeilen: frag den Dienst, was installiert ist. Das auf zwei Dateien
// zu verteilen waere Zeremonie ohne Nutzen.
//
// Warum ueberhaupt lokal, wenn OpenRouter laeuft: nicht wegen der Kosten.
// Der Chat ist gemessen 1 % der Ausgaben, Bilder und Clips sind 99 %. Es
// geht um Unabhaengigkeit - leeres Guthaben, abgelaufener Schluessel, kein
// Netz - und darum, dass Prompts den Rechner nicht verlassen muessen.
// Erzeugen kann Ollama nicht ersetzen: lokale Bildmodelle brauchen auf
// einem normalen Rechner Minuten je Bild, Video gar nicht.
//
// Ollama spricht dieselbe Schnittstelle wie OpenRouter (/v1/chat/completions,
// OpenAI-Form). Deshalb passt die Antwort ohne Umbau in dieselbe Schleife.

const BASIS = 'http://127.0.0.1:11434';

/** Kennungen bekommen dieses Praefix, damit man lokal von fern trennen kann. */
export const PRAEFIX = 'ollama/';

/** Ist eine Kennung ein lokales Modell? */
export function istLokal(id) {
  return typeof id === 'string' && id.startsWith(PRAEFIX);
}

/** Kennung ohne Praefix - so kennt Ollama sie. */
export function ohnePraefix(id) {
  return istLokal(id) ? id.slice(PRAEFIX.length) : id;
}

/**
 * Zwischenspeicher fuer diesen Serverlauf.
 *
 * `null` heisst "noch nicht nachgesehen", `[]` heisst "nachgesehen, nichts
 * da". Der Unterschied zaehlt: sonst wuerde bei jedem Aufruf neu gesucht,
 * obwohl klar ist, dass Ollama nicht laeuft.
 */
let zwischenspeicher = null;

/**
 * Kurzer Anschlag mit Abbruch.
 *
 * Ollama laeuft bei den meisten Leuten gar nicht. Ohne Zeitgrenze haengt
 * der Start der App an einem Dienst, den es nicht gibt - deshalb hier
 * bewusst knapp. Beim Erzeugen selbst gilt das NICHT: ein grosses Modell
 * braucht auf der eigenen Grafikkarte schon mal Minuten, und das ist kein
 * Fehler, sondern der Preis fuer lokal.
 */
async function hole(pfad, optionen = {}, msFrist = 1500) {
  const abbruch = AbortSignal.timeout(msFrist);
  const antwort = await fetch(BASIS + pfad, { ...optionen, signal: abbruch });
  if (!antwort.ok) throw new Error(`Ollama antwortete mit ${antwort.status}`);
  return antwort.json();
}

/**
 * Was man ueber ein lokales Modell wissen will, bevor man es waehlt.
 *
 * Hier stand kurzzeitig eine Warnung vor kleinen Modellen, weil
 * gemma4:12b im Test kein einziges Werkzeug aufgerufen hat. Das lag NICHT
 * am Modell: im Systemhinweis fehlte die Zuordnung, wann welches Werkzeug
 * dran ist. Mit ihr ruft dasselbe Modell sauber auf - erst
 * `bestand_suchen`, dann in einem zweiten Versuch `bild_ansehen`, beide
 * beim ersten Anlauf und beide mit richtiger Antwort. Die Warnung ist
 * damit widerlegt und wieder raus.
 *
 * Was bleibt, ist die Wartezeit: gemessen 48 bis 78 Sekunden je Zug auf
 * dieser Maschine, gegenueber ein bis zwei Sekunden ueber OpenRouter. Das
 * ist der eigentliche Unterschied und nicht die Faehigkeit. Eine Zahl
 * steht bewusst nicht dabei - sie haengt an Grafikkarte, Modellgroesse und
 * daran, ob das Modell noch im Speicher liegt.
 */
function hinweis() {
  return 'braucht Sekunden bis Minuten';
}

/**
 * Was ist installiert, und was kann es?
 *
 * Ollama sagt die Faehigkeiten selbst - /api/show liefert unter
 * `capabilities` Werte wie "tools", "vision", "thinking". Damit ist die
 * Erkennung genau und nicht geraten: ein Modell ohne "tools" kann im Studio
 * nichts tun ausser reden und faellt deshalb ganz aus der Liste.
 */
export async function aktualisiere() {
  try {
    const { models = [] } = await hole('/api/tags');
    const raus = [];

    for (const m of models) {
      let faehig = [];
      try {
        const zeige = await hole('/api/show', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ model: m.name }),
        }, 4000);
        faehig = zeige.capabilities || [];
      } catch {
        // Sagt ein Modell nichts ueber sich, lassen wir es weg statt zu
        // raten. Ein Modell, das im Gespraech stumm bleibt, weil es keine
        // Werkzeuge kann, ist aergerlicher als eins, das gar nicht dasteht.
        continue;
      }
      if (!faehig.includes('tools')) continue;

      const gb = m.size ? (m.size / 1024 ** 3).toFixed(1) : null;
      raus.push({
        id: PRAEFIX + m.name,
        name: m.name,
        gruppe: 'Lokal (Ollama)',
        anbieter: 'ollama',
        siehtBilder: faehig.includes('vision'),
        notiz: [gb ? `${gb} GB` : null, 'lokal, kostet nichts', hinweis()]
          .filter(Boolean).join(' · '),
        preisRein: 0,
      });
    }

    zwischenspeicher = raus.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  } catch {
    // Dienst nicht da. Kein Fehler nach aussen - Ollama ist eine Zugabe,
    // keine Voraussetzung.
    zwischenspeicher = [];
  }
  return zwischenspeicher;
}

/** Die lokalen Modelle. Beim ersten Aufruf wird nachgesehen. */
export async function alle() {
  if (zwischenspeicher === null) await aktualisiere();
  return zwischenspeicher;
}

/** Laeuft Ollama ueberhaupt? */
export async function erreichbar() {
  return (await alle()).length > 0;
}

/**
 * Eine Runde Gespraech - gleiche Form wie anbieter-openrouter-chat.frage().
 *
 * Ohne Zeitgrenze: ein 17-GB-Modell rechnet auf der eigenen Karte laenger
 * als jede Netzantwort, und ein Abbruch mittendrin waere hier ein Fehler,
 * den es nicht gibt.
 */
export async function frage({ nachrichten, modell, werkzeuge = [] }) {
  const koerper = {
    model: ohnePraefix(modell),
    messages: nachrichten,
    stream: false,
  };
  if (werkzeuge.length) {
    koerper.tools = werkzeuge;
    koerper.tool_choice = 'auto';
  }

  const antwort = await fetch(`${BASIS}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(koerper),
  });

  const roh = await antwort.text();
  let daten;
  try {
    daten = JSON.parse(roh);
  } catch {
    throw new Error(`Ollama antwortete kein JSON (HTTP ${antwort.status}): ${roh.slice(0, 200)}`);
  }

  if (!antwort.ok || daten.error) {
    const text = daten.error?.message || daten.error || `HTTP ${antwort.status}`;
    if (/not found|no such model/i.test(String(text))) {
      throw new Error(`Ollama kennt "${ohnePraefix(modell)}" nicht - vielleicht geloescht. `
        + 'Oben ein anderes Modell waehlen.');
    }
    throw new Error(`Ollama: ${text}`);
  }

  const wahl = daten.choices?.[0];
  if (!wahl?.message) throw new Error('Ollama lieferte keine Nachricht zurueck.');

  // Kosten sind null und nicht "unbekannt". Der Strom, den die Karte zieht,
  // taucht in keiner Abrechnung auf, die diese App fuehren koennte.
  return { nachricht: wahl.message, kosten: 0, modell };
}
