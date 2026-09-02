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

  bestand: ({ ordner, art, nurFavoriten, suche } = {}) => {
    const p = new URLSearchParams();
    if (ordner) p.set('ordner', ordner);
    if (art) p.set('art', art);
    if (nurFavoriten) p.set('favoriten', '1');
    if (suche) p.set('suche', suche);
    return ruf(`/api/bestand?${p}`);
  },

  schaetzung: (koerper) => ruf('/api/schaetzung', { method: 'POST', body: JSON.stringify(koerper) }),
  erzeugen: (koerper) => ruf('/api/erzeugen', { method: 'POST', body: JSON.stringify(koerper) }),
  animieren: (koerper) => ruf('/api/animieren', { method: 'POST', body: JSON.stringify(koerper) }),
  sidecar: (pfad, aenderungen) => ruf('/api/sidecar', { method: 'POST', body: JSON.stringify({ pfad, aenderungen }) }),
  umbenennen: (pfad, neuerName) => ruf('/api/umbenennen', { method: 'POST', body: JSON.stringify({ pfad, neuerName }) }),
  textAnwenden: (pfad, ebenen) => ruf('/api/text-anwenden', { method: 'POST', body: JSON.stringify({ pfad, ebenen }) }),
  stilSpeichern: (text) => ruf('/api/stil', { method: 'POST', body: JSON.stringify({ text }) }),
  standardSpeichern: (koerper) => ruf('/api/standard', { method: 'POST', body: JSON.stringify(koerper) }),
  chatModelle: () => ruf('/api/chat-modelle'),
  chatLeeren: () => ruf('/api/chat-leeren', { method: 'POST' }),
  konfig: () => ruf('/api/konfig'),
  konfigSpeichern: (koerper) => ruf('/api/konfig', { method: 'POST', body: JSON.stringify(koerper) }),
  modelleAktualisieren: (art) => ruf('/api/modelle-aktualisieren', { method: 'POST', body: JSON.stringify({ art }) }),
};

/** Vorschau-Adresse einer Datei aus der Bibliothek. */
export function dateiUrl(pfad) {
  return `/datei?pfad=${encodeURIComponent(pfad)}`;
}
