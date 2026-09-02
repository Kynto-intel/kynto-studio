// Sofort-Vorschau im Browser.
//
// Warum ueberhaupt zwei Renderer: Der Server rendert mit System.Drawing und
// braucht dafuer jedes Mal einen frischen PowerShell-Prozess - rund eine
// Sekunde. Beim Tippen und Ziehen ist das unbrauchbar.
//
// Deshalb zeichnet der Browser sofort mit, waehrend im Hintergrund die exakte
// Fassung vom Server nachgeladen wird und die Zeichnung ersetzt. Der
// Umbruch-Algorithmus ist hier bewusst derselbe wie in text.ps1 - gleiche
// Reihenfolge, gleiche relativen Masse, gleicher Rand von 6 %.

const RAND_ANTEIL = 0.06;

/** Zerlegt Text in farbige Stuecke. Muss zu Split-Auszeichnung passen. */
export function zerlege(roh) {
  // Typografische Anfuehrungszeichen zuerst auf das gerade Zeichen bringen
  const text = String(roh).replace(/[“”„«»]/g, '"');
  const stuecke = [];
  const muster = /^([\s\S]*?)(?:\*([^*]+)\*|"+([^"]+)"+)([\s\S]*)$/;

  let rest = text;
  let treffer = rest.match(muster);
  while (treffer) {
    if (treffer[1]) stuecke.push({ text: treffer[1], akzent: false });
    const wort = treffer[2] || treffer[3];
    if (wort) stuecke.push({ text: wort, akzent: true });
    rest = treffer[4];
    treffer = rest.match(muster);
  }
  if (rest) stuecke.push({ text: rest, akzent: false });
  return stuecke.length ? stuecke : [{ text: '', akzent: false }];
}

/** Bricht auf Zeilen um, ohne Woerter zu zerschneiden. Wie Split-Zeilen. */
function umbrechen(ctx, stuecke, maxBreite) {
  const zeilen = [];
  let aktuell = [];
  let breite = 0;

  for (const stueck of stuecke) {
    for (const wort of stueck.text.split(/(\s+)/).filter((w) => w !== '')) {
      const istLeer = /^\s+$/.test(wort);
      const mass = ctx.measureText(wort).width;

      if (!istLeer && breite + mass > maxBreite && aktuell.length) {
        zeilen.push(aktuell);
        aktuell = [];
        breite = 0;
      }
      if (istLeer && !aktuell.length) continue;

      aktuell.push({ text: wort, akzent: stueck.akzent, breite: mass });
      breite += mass;
    }
  }
  if (aktuell.length) zeilen.push(aktuell);
  return zeilen;
}

/**
 * Zeichnet Bild und Textebene auf die Flaeche.
 * @param {HTMLCanvasElement} flaeche
 * @param {HTMLImageElement} quelle  bereits geladenes Bild
 */
export function zeichne(flaeche, quelle, ebene) {
  const ctx = flaeche.getContext('2d');
  const breite = flaeche.width;
  const hoehe = flaeche.height;

  ctx.clearRect(0, 0, breite, hoehe);
  ctx.drawImage(quelle, 0, 0, breite, hoehe);
  if (!ebene?.text?.trim()) return;

  const groesse = Math.max(6, hoehe * (Number(ebene.groesse) || 0.08));
  ctx.font = `${groesse}px "${ebene.schrift}", sans-serif`;
  ctx.textBaseline = 'top';

  // Canvas setzt bei textBaseline "top" die Oberkante des GEVIERTS an, GDI+
  // beim GraphicsPath die Oberkante des ZEILENKASTENS - der liegt um den
  // Ueberhang darueber tiefer. Ohne Ausgleich sass der Servertext rund 16 %
  // der Schriftgroesse tiefer als die Vorschau und ruckte beim Eintreffen
  // sichtbar nach. Gemessen ueber drei Schriften und drei Groessen: 0,156.
  const versatz = geviertVersatz(ctx, groesse);

  const text = ebene.versalien ? ebene.text.toUpperCase() : ebene.text;
  const stuecke = zerlege(text);

  const rand = breite * RAND_ANTEIL;
  const maxBreite = breite - (2 * rand);
  const zeilen = umbrechen(ctx, stuecke, maxBreite);

  const zeilenHoehe = groesse * (Number(ebene.zeilenabstand) || 1.1);
  const gesamtHoehe = zeilenHoehe * zeilen.length;
  const mitteX = breite * (ebene.x == null ? 0.5 : Number(ebene.x));

  // Senkrecht im Bild halten - das Bild ist die Grenze.
  const obenGrenze = rand;
  const untenGrenze = Math.max(obenGrenze, hoehe - rand - gesamtHoehe);
  let y = (hoehe * (ebene.y == null ? 0.75 : Number(ebene.y))) - (gesamtHoehe / 2);
  y = Math.min(untenGrenze, Math.max(obenGrenze, y));

  const konturBreite = breite * (Number(ebene.kontur?.breite) || 0);
  const schattenVersatz = breite * (Number(ebene.schatten?.versatz) || 0);

  for (const zeile of zeilen) {
    const zeilenBreite = zeile.reduce((summe, w) => summe + w.breite, 0);

    // Das BILD ist die Grenze, nicht die Ziehposition. Links und rechts
    // sitzen am Bildrand, die Mitte folgt dem Ziehen - aber nie hinaus.
    let x;
    if (ebene.ausrichtung === 'links') x = rand;
    else if (ebene.ausrichtung === 'rechts') x = breite - rand - zeilenBreite;
    else x = mitteX - (zeilenBreite / 2);

    const linkeGrenze = rand;
    const rechteGrenze = Math.max(linkeGrenze, breite - rand - zeilenBreite);
    x = Math.min(rechteGrenze, Math.max(linkeGrenze, x));

    for (const w of zeile) {
      // Reihenfolge wie im Server-Renderer: Schatten, Kontur, Fuellung
      const zy = y + versatz;   // Ausgleich zur Zeilenkasten-Oberkante
      if (schattenVersatz > 0) {
        ctx.fillStyle = mitDeckkraft(ebene.schatten?.farbe || '#000000', 0.59);
        ctx.fillText(w.text, x + schattenVersatz, zy + schattenVersatz);
      }
      if (konturBreite > 0) {
        ctx.lineWidth = konturBreite;
        ctx.strokeStyle = ebene.kontur?.farbe || '#000000';
        ctx.lineJoin = 'round';
        ctx.strokeText(w.text, x, zy);
      }
      ctx.fillStyle = w.akzent ? (ebene.akzentFarbe || '#8B1A1A') : (ebene.farbe || '#FFFFFF');
      ctx.fillText(w.text, x, zy);
      x += w.breite;
    }
    y += zeilenHoehe;
  }
}

/**
 * Wie weit liegt die Zeilenkasten-Oberkante ueber dem Geviert?
 * Wird aus den Schriftmetriken gelesen, wenn der Browser sie liefert -
 * sonst greift der gemessene Mittelwert.
 */
function geviertVersatz(ctx, groesse) {
  try {
    const m = ctx.measureText('Hg');
    if (typeof m.fontBoundingBoxAscent === 'number' && typeof m.emHeightAscent === 'number') {
      const d = m.fontBoundingBoxAscent - m.emHeightAscent;
      if (d > 0 && d < groesse) return d;
    }
  } catch {
    // Metriken nicht verfuegbar
  }
  return groesse * 0.156;
}

/** #RRGGBB plus Deckkraft -> rgba(), fuer den halbtransparenten Schatten. */
function mitDeckkraft(hex, deckkraft) {
  const rein = String(hex).replace('#', '');
  const zahl = parseInt(rein.length === 3
    ? rein.split('').map((z) => z + z).join('')
    : rein, 16);
  const r = (zahl >> 16) & 255;
  const g = (zahl >> 8) & 255;
  const b = zahl & 255;
  return `rgba(${r}, ${g}, ${b}, ${deckkraft})`;
}
