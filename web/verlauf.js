// Live-Verbindung zum Geschehen - im Hauptfenster.
//
// Zeigt hier nichts an. Der Verlauf selbst steht in einem eigenen Fenster
// (verlauf.html); dieses Modul haelt nur die Verbindung, damit zwei Dinge
// sofort passieren:
//   - Neue Dateien erscheinen in der Galerie, ohne neu zu laden.
//   - Der Punkt am Knopf sagt, ob die Verbindung steht.

let beiNeuemBild = () => {};

const el = (id) => document.getElementById(id);

export function setzeNachladeZiel(fn) { beiNeuemBild = fn; }

/** Verbindet mit dem Strom. EventSource verbindet von allein neu. */
export function verbinde() {
  const punkt = el('verlaufPunkt');
  const strom = new EventSource('/api/verlauf-strom');

  strom.addEventListener('open', () => {
    punkt.className = 'punkt an';
    punkt.title = 'Live verbunden';
  });

  strom.addEventListener('message', (e) => {
    let eintrag;
    try {
      eintrag = JSON.parse(e.data);
    } catch {
      return;
    }
    // Neue Dateien -> Galerie nachladen, damit man sie sofort sieht.
    if (eintrag.details?.dateien?.length || eintrag.was === 'umbenannt') beiNeuemBild();
  });

  strom.addEventListener('error', () => {
    punkt.className = 'punkt';
    punkt.title = 'Verbindung unterbrochen — versucht neu';
  });
}

/**
 * Der Knopf oeffnet ein eigenes Fenster.
 *
 * Ein eigenes und kein Reiter: man will im Verlauf nachsehen, waehrend man
 * im Studio weiterarbeitet. Ist das Fenster schon offen, holt der zweite
 * Klick es nach vorn, statt ein zweites aufzumachen.
 */
export function verdrahte() {
  let fenster = null;
  el('verlaufKnopf').addEventListener('click', () => {
    if (fenster && !fenster.closed) {
      fenster.focus();
      return;
    }
    fenster = window.open('/verlauf.html', 'kynto-verlauf', 'width=640,height=860');
  });
}
