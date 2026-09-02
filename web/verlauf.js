// Live-Verlauf in der Oberflaeche.
//
// Haengt an einem offenen Strom vom Server. Loest Claude ueber die
// Kommandozeile etwas aus, erscheint es hier sofort - mit Prompt, Modell
// und Kosten, ohne dass man etwas neu laden muss.

let beiNeuemBild = () => {};

const el = (id) => document.getElementById(id);

export function setzeNachladeZiel(fn) { beiNeuemBild = fn; }

const BESCHRIFTUNG = {
  erzeugt: 'Bild erzeugt',
  animiert: 'Clip erzeugt',
  umbenannt: 'Umbenannt',
  stil: 'Stil geändert',
};

function uhrzeit(iso) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function zeile(e) {
  const li = document.createElement('li');
  li.className = `verlauf-zeile quelle-${e.quelle}`;

  const kopf = document.createElement('div');
  kopf.className = 'verlauf-kopf';

  const wer = document.createElement('span');
  wer.className = 'wer';
  wer.textContent = e.quelle === 'claude' ? 'Claude' : 'Studio';

  const was = document.createElement('span');
  was.className = 'was';
  was.textContent = BESCHRIFTUNG[e.was] || e.was;

  const zeit = document.createElement('time');
  zeit.textContent = uhrzeit(e.zeit);

  kopf.append(wer, was, zeit);

  const text = document.createElement('div');
  text.className = 'verlauf-text';
  text.textContent = e.text;

  li.append(kopf, text);

  // Der vollstaendige Prompt ist das Interessante - aufklappbar, damit
  // die Liste nicht zugemuellt wird.
  if (e.details?.prompt) {
    const mehr = document.createElement('details');
    const titel = document.createElement('summary');
    titel.textContent = 'Vollständiger Prompt';
    const inhalt = document.createElement('pre');
    inhalt.textContent = e.details.prompt;
    mehr.append(titel, inhalt);
    li.append(mehr);
  }

  const zusatz = [];
  if (e.details?.dollar) zusatz.push(`${e.details.dollar.toFixed(3)} $`);
  if (e.details?.sekunden) zusatz.push(`${e.details.sekunden} s`);
  if (e.details?.referenz) zusatz.push('mit Referenzbild');
  if (zusatz.length) {
    const fuss = document.createElement('div');
    fuss.className = 'verlauf-fuss';
    fuss.textContent = zusatz.join(' · ');
    li.append(fuss);
  }

  return li;
}

export function zeige(eintraege) {
  const liste = el('verlaufListe');
  liste.replaceChildren();
  if (!eintraege.length) {
    const leer = document.createElement('li');
    leer.className = 'verlauf-leer';
    leer.textContent = 'Noch nichts passiert.';
    liste.append(leer);
    return;
  }
  for (const e of eintraege) liste.append(zeile(e));
}

function ergaenze(eintrag) {
  const liste = el('verlaufListe');
  liste.querySelector('.verlauf-leer')?.remove();
  const neu = zeile(eintrag);
  neu.classList.add('frisch');
  liste.prepend(neu);
  while (liste.children.length > 40) liste.lastElementChild.remove();

  // Neue Dateien -> Galerie nachladen, damit man sie sofort sieht.
  if (eintrag.details?.dateien?.length || eintrag.was === 'umbenannt') beiNeuemBild();
}

/** Verbindet mit dem Strom und haelt die Verbindung am Leben. */
export function verbinde() {
  const punkt = el('verlaufPunkt');
  const strom = new EventSource('/api/verlauf-strom');

  strom.addEventListener('open', () => {
    punkt.className = 'punkt an';
    punkt.title = 'Live verbunden';
  });

  strom.addEventListener('message', (e) => {
    try {
      ergaenze(JSON.parse(e.data));
    } catch {
      // kaputte Nachricht ueberspringen
    }
  });

  strom.addEventListener('error', () => {
    punkt.className = 'punkt';
    punkt.title = 'Verbindung unterbrochen — versucht neu';
    // EventSource verbindet von allein neu, hier nur die Anzeige.
  });
}

export function verdrahte() {
  const knopf = el('verlaufKnopf');
  const feld = el('verlaufFeld');
  knopf.addEventListener('click', () => {
    const zu = feld.hidden;
    feld.hidden = !zu;
    knopf.setAttribute('aria-expanded', String(zu));
  });
}
