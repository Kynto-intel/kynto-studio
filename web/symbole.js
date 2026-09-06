// Symbole fuer die Seitenleiste. Inline-SVG, damit nichts nachgeladen wird
// und die Farbe der Schrift folgt (currentColor).

const PFADE = {
  alles: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  bild: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M3 16l4.5-4.5a2 2 0 0 1 2.8 0L15 16 M14 12l2-2a2 2 0 0 1 2.8 0L21 12',
  pin: 'M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  text: 'M5 3h9l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M14 3v5h5 M8 13h8 M8 17h6',
  ordner: 'M3 6a1 1 0 0 1 1-1h5l2 2.5h8a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  // Zwei Blaetter uebereinander - eine Vorlage ist ein Bild, das man
  // beliebig oft neu abzieht.
  vorlagen: 'M8 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M4 7v12a1 1 0 0 0 1 1h10',
  // Zwei Schieberegler - was hier steht, stellt man ein.
  einstellungen: 'M4 8h10 M18 8h2 M4 16h4 M12 16h8 M16 6v4 M10 14v4',
};

/** Welches Symbol gehoert zu welchem Ordner? */
const ZUORDNUNG = {
  'fb-ig': 'bild',
  pinterest: 'pin',
  blog: 'text',
  assets: 'ordner',
  // Keine Ordner, sondern die Sonderansichten - deshalb Namen, die kein
  // echter Ordner tragen kann.
  __vorlagen__: 'vorlagen',
  __einstellungen__: 'einstellungen',
};

export function symbolFuer(ordnerId) {
  const name = ordnerId ? ZUORDNUNG[ordnerId] || 'ordner' : 'alles';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.classList.add('symbol');

  const pfad = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pfad.setAttribute('d', PFADE[name]);
  svg.append(pfad);
  return svg;
}
