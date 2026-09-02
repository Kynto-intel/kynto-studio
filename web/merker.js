// Kleine Erinnerung im Browser.
//
// Wer das Studio neu laedt, will nicht Modell, Format und Haken jedes Mal
// wieder von Hand einstellen. Gemerkt wird nur, was die Oberflaeche steuert
// - nie Prompts, nie Dateinamen, nie Schluessel.
//
// localStorage und nicht der Server: das sind Vorlieben dieses Browsers,
// keine Daten der App. Der Verlauf und die Bilder bleiben davon unberuehrt,
// und wer den Speicher leert, bekommt einfach wieder die Standardwerte.

const SCHLUESSEL = 'kynto-studio';

/** Alles auf einmal lesen. Kaputter Inhalt gibt einen leeren Satz. */
function alles() {
  try {
    return JSON.parse(localStorage.getItem(SCHLUESSEL)) || {};
  } catch {
    return {};
  }
}

/**
 * Einen gemerkten Wert holen.
 * `gueltig` prueft, ob er heute noch passt - ein Modell kann aus dem
 * Katalog verschwunden sein, ein Ordner geloescht. Faellt die Pruefung
 * durch, kommt der Standard zurueck.
 */
export function hole(name, standard, gueltig = null) {
  const wert = alles()[name];
  if (wert === undefined || wert === null) return standard;
  if (gueltig && !gueltig(wert)) return standard;
  return wert;
}

/** Einen Wert merken. Schlaegt das fehl (privates Fenster), ist das egal. */
export function merke(name, wert) {
  try {
    const daten = alles();
    daten[name] = wert;
    localStorage.setItem(SCHLUESSEL, JSON.stringify(daten));
  } catch {
    // Ohne Speicher laeuft alles weiter, nur ohne Gedaechtnis.
  }
}
