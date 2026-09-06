// Live-Verbindung zum Geschehen - im Hauptfenster.
//
// Zeigt selbst nichts an. Eine Verbindung fuer die ganze App, nicht eine
// je Ansicht - wer Vorgaenge braucht, meldet sich hier an:
//   - Die Galerie laedt nach, wenn neue Dateien entstehen.
//   - Das Verlaufsfenster zeichnet neue Zeilen nach.
//   - Der Punkt am Knopf sagt, ob die Verbindung steht.

let beiNeuemBild = () => {};
let beiEreignis = () => {};

const el = (id) => document.getElementById(id);

export function setzeNachladeZiel(fn) { beiNeuemBild = fn; }

/** Wer sonst noch von neuen Vorgaengen erfahren will - das Verlaufsfenster. */
export function setzeEreignisZiel(fn) { beiEreignis = fn; }

/** Verbindet mit dem Strom. EventSource verbindet von allein neu. */
export function verbinde() {
  // Den Punkt gibt es nur, solange der Verlauf einen eigenen Knopf in der
  // Seitenleiste hat. Seit er als Reiter in den Einstellungen sitzt, fehlt
  // er - der Strom laeuft trotzdem weiter. Deshalb haengt hier NUR die
  // Punkt-Anzeige an seiner Existenz und nicht der ganze Anschluss: sonst
  // wuerde die Galerie nach einem neuen Bild nicht mehr nachladen.
  const punkt = el('verlaufPunkt');
  const strom = new EventSource('/api/verlauf-strom');

  if (punkt) {
    strom.addEventListener('open', () => {
      punkt.className = 'punkt an';
      punkt.title = 'Live verbunden';
    });
  }

  strom.addEventListener('message', (e) => {
    let eintrag;
    try {
      eintrag = JSON.parse(e.data);
    } catch {
      return;
    }
    // Neue Dateien -> Galerie nachladen, damit man sie sofort sieht.
    if (eintrag.details?.dateien?.length || eintrag.was === 'umbenannt') beiNeuemBild();
    beiEreignis(eintrag);
  });

  strom.addEventListener('error', () => {
    if (!punkt) return;   // EventSource verbindet von allein neu
    punkt.className = 'punkt';
    punkt.title = 'Verbindung unterbrochen — versucht neu';
  });
}
