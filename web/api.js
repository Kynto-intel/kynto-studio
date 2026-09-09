// Duenne Huelle um fetch. Einzige Stelle, die HTTP kennt.

async function ruf(pfad, optionen = {}) {
  const antwort = await fetch(pfad, {
    headers: { 'content-type': 'application/json' },
    ...optionen,
  });
  const daten = await antwort.json().catch(() => ({ fehler: 'Antwort war kein JSON' }));
  if (!antwort.ok || daten.fehler) {
    const f = new Error(daten.fehler || `HTTP ${antwort.status}`);
    // Der Server haengt bei Fehlern den aktuellen Verbrauchsstand an,
    // damit die Anzeige sofort den echten Zustand zeigen kann.
    if (daten.verbrauch) f.verbrauch = daten.verbrauch;
    throw f;
  }
  return daten;
}

export const api = {
  start: () => ruf('/api/start'),

  // Legt die Datei in den Windows-Papierkorb, samt Sidecar.
  loeschen: (pfad) => ruf('/api/loeschen', { method: 'POST', body: JSON.stringify({ pfad }) }),

  kostenGeschichte: (monate = 0) => ruf(`/api/kosten-geschichte?monate=${monate}`),

  // vorlage: nur, was ueber diese Vorlage erzeugt wurde. Die Zuordnung
  // steht im Sidecar, nicht in einem Index.
  bestand: ({ ordner, art, nurFavoriten, suche, vorlage } = {}) => {
    const p = new URLSearchParams();
    if (ordner) p.set('ordner', ordner);
    if (art) p.set('art', art);
    if (nurFavoriten) p.set('favoriten', '1');
    if (suche) p.set('suche', suche);
    if (vorlage) p.set('vorlage', vorlage);
    return ruf(`/api/bestand?${p}`);
  },

  schaetzung: (koerper) => ruf('/api/schaetzung', { method: 'POST', body: JSON.stringify(koerper) }),
  erzeugen: (koerper) => ruf('/api/erzeugen', { method: 'POST', body: JSON.stringify(koerper) }),
  animieren: (koerper) => ruf('/api/animieren', { method: 'POST', body: JSON.stringify(koerper) }),
  sidecar: (pfad, aenderungen) => ruf('/api/sidecar', { method: 'POST', body: JSON.stringify({ pfad, aenderungen }) }),
  umbenennen: (pfad, neuerName) => ruf('/api/umbenennen', { method: 'POST', body: JSON.stringify({ pfad, neuerName }) }),
  textAnwenden: (pfad, ebenen) => ruf('/api/text-anwenden', { method: 'POST', body: JSON.stringify({ pfad, ebenen }) }),
  // art: 'bild' oder 'video' - es gibt einen Block je Gattung.
  stilSpeichern: (text, art = 'bild') => ruf('/api/stil', { method: 'POST', body: JSON.stringify({ text, art }) }),
  regieSpeichern: (text) => ruf('/api/regie', { method: 'POST', body: JSON.stringify({ text }) }),
  standardSpeichern: (koerper) => ruf('/api/standard', { method: 'POST', body: JSON.stringify(koerper) }),
  chatModelle: (alle = false) => ruf(`/api/chat-modelle${alle ? '?alle=1' : ''}`),
  chatLeeren: () => ruf('/api/chat-leeren', { method: 'POST' }),
  eintrag: (pfad) => ruf('/api/eintrag?pfad=' + encodeURIComponent(pfad)),
  grenzen: () => ruf('/api/grenzen'),
  grenzenSpeichern: (koerper) => ruf('/api/grenzen', { method: 'POST', body: JSON.stringify(koerper) }),
  vorlagen: () => ruf('/api/vorlagen'),
  vorlageSichern: (vorlage) => ruf('/api/vorlage', { method: 'POST', body: JSON.stringify(vorlage) }),
  vorlageLoeschen: (id) => ruf('/api/vorlage-loeschen', { method: 'POST', body: JSON.stringify({ id }) }),
  konfig: () => ruf('/api/konfig'),
  konfigSpeichern: (koerper) => ruf('/api/konfig', { method: 'POST', body: JSON.stringify(koerper) }),
  modelleAktualisieren: (art) => ruf('/api/modelle-aktualisieren', { method: 'POST', body: JSON.stringify({ art }) }),
};

/** Vorschau-Adresse einer Datei aus der Bibliothek. */
export function dateiUrl(pfad) {
  return `/datei?pfad=${encodeURIComponent(pfad)}`;
}
