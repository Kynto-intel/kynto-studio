// Live-Preise von OpenRouter.
//
// Die Preise stehen in der Modell-Liste und aendern sich, wenn OpenRouter
// nachjustiert. Deshalb werden sie geholt statt eingetippt.
//
// FALLE: `pricing.image` ist der Preis fuer ein EINGABE-Bild, nicht fuer ein
// erzeugtes. Wer den nimmt, bekommt bei gemini-3-pro-image 0,000002 $ heraus -
// offensichtlich falsch. Der richtige Wert ist `image_output`, der Preis je
// AUSGABE-Token. Ein Bild in 1024er Groesse sind rund 1.290 Ausgabe-Token.
//
// Video liefert OpenRouter gar keinen Preis - dort bleibt nur messen.

const QUELLEN = {
  bild: 'https://openrouter.ai/api/v1/models?output_modalities=image',
  video: 'https://openrouter.ai/api/v1/models?output_modalities=video',
};

/** Ausgabe-Token eines Bildes in 1024er Groesse. Nur ein Richtwert. */
export const TOKEN_PRO_BILD = 1290;

/** Wie lange ein geholter Preis als frisch gilt. */
const FRISCH_MS = 30 * 60 * 1000;

const speicher = { bild: null, video: null };

async function hole(art) {
  const antwort = await fetch(QUELLEN[art], { headers: { accept: 'application/json' } });
  if (!antwort.ok) throw new Error(`OpenRouter antwortete mit ${antwort.status}`);
  const roh = (await antwort.json()).data || [];

  const karte = {};
  for (const m of roh) {
    const proToken = Number(m.pricing?.image_output || 0);
    karte[m.id] = {
      proAusgabeToken: proToken || null,
      // Schaetzung, ausdruecklich als solche gekennzeichnet.
      schaetzungProBild: proToken ? proToken * TOKEN_PRO_BILD : null,
    };
  }
  return karte;
}

/**
 * Preise fuer eine Gattung. Liefert aus dem Zwischenspeicher, solange er
 * frisch ist. Faellt die Abfrage aus, kommt der letzte bekannte Stand
 * zurueck statt eines Fehlers - die App soll deshalb nicht stehenbleiben.
 */
export async function fuer(art) {
  const jetzt = Date.now();
  const alt = speicher[art];
  if (alt && jetzt - alt.zeit < FRISCH_MS) return alt.karte;

  try {
    const karte = await hole(art);
    speicher[art] = { karte, zeit: jetzt };
    return karte;
  } catch {
    return alt?.karte || {};
  }
}

/** Erzwingt ein Neuladen, egal wie frisch der Stand ist. */
export async function aktualisiere(art) {
  speicher[art] = null;
  return fuer(art);
}
