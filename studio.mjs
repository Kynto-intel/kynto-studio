#!/usr/bin/env node
// Kommandozeile fuer Kynto Studio.
//
// Damit laesst sich das Studio ohne Browser bedienen. Jeder Aufruf setzt
// X-Quelle: claude und taucht sofort im Live-Verlauf der Oberflaeche auf -
// mit vollstaendigem Prompt zum Nachlesen.
//
// Der Server muss laufen (start.ps1 bzw. Kynto.bat).

const BASIS = process.env.STUDIO_URL || 'http://127.0.0.1:4890';

async function ruf(pfad, optionen = {}) {
  let antwort;
  try {
    antwort = await fetch(BASIS + pfad, {
      ...optionen,
      headers: {
        'Content-Type': 'application/json',
        'X-Quelle': 'claude',
        ...optionen.headers,
      },
    });
  } catch {
    throw new Error(
      'Kynto Studio antwortet nicht. Laeuft der Server? '
      + 'Starten mit start.ps1 bzw. Kynto.bat.',
    );
  }
  const daten = await antwort.json().catch(() => ({ fehler: 'Antwort war kein JSON' }));
  if (!antwort.ok || daten.fehler) throw new Error(daten.fehler || `HTTP ${antwort.status}`);
  return daten;
}

/** --schluessel wert aus den Argumenten ziehen. */
function flagge(argumente, name, standard = null) {
  const i = argumente.indexOf(`--${name}`);
  return i >= 0 && argumente[i + 1] ? argumente[i + 1] : standard;
}

function geld(betrag) {
  if (!betrag) return null;
  return betrag < 0.01 ? `${(betrag * 100).toFixed(2)} ct` : `${betrag.toFixed(3)} USD`;
}

const befehle = {
  async status() {
    const s = await ruf('/api/start');
    const v = s.verbrauch;
    // Herkunft mit ausgeben: eine gesetzte Umgebungsvariable sticht die
    // .env aus, und ohne diese Zeile sucht man den Grund lange.
    const woher = { datei: ' (aus .env)', umgebung: ' (aus der Umgebung)' }[s.schluessel?.quelle] || '';
    console.log(s.anbieter.openrouter
      ? `OpenRouter : bereit${woher}`
      : 'OpenRouter : kein Schluessel - OPENROUTER_API_KEY setzen oder .env anlegen');
    if (s.guthaben) {
      const uebrig = s.guthaben.uebrig;
      const warnung = uebrig <= 0 ? '   LEER - aufladen' : '';
      console.log(`Guthaben   : ${uebrig.toFixed(2)} USD${warnung}`);
    }
    console.log(`Heute      : ${v.bilder} Bild(er), ${v.clips} Clip(s), ${geld(v.dollar) || '0 USD'}`);
    console.log(`Gesamt     : ${geld(v.gesamtDollar) || '0 USD'}`);
    console.log(`Modelle    : ${s.modelleBild.length} Bild, ${s.modelleVideo.length} Video`);
    const bestand = Object.entries(s.zaehlung).map(([k, n]) => `${k}=${n}`).join(', ');
    console.log(`Bestand    : ${bestand}`);
  },

  async modelle(art = 'bild', suche = '') {
    const s = await ruf('/api/start');
    const liste = art === 'video' ? s.modelleVideo : s.modelleBild;
    const preise = s.preise?.[art] || {};
    const gefiltert = suche
      ? liste.filter((m) => `${m.id} ${m.name} ${m.gruppe}`.toLowerCase().includes(suche.toLowerCase()))
      : liste;

    for (const m of gefiltert) {
      const gemessen = s.gemessen?.[m.id]?.schnitt;
      const geschaetzt = preise[m.id]?.schaetzungProBild;
      let preis = '';
      if (gemessen) preis = `${geld(gemessen)} gemessen`;
      else if (geschaetzt) preis = `ca. ${geld(geschaetzt)}`;
      console.log(`${m.id.padEnd(42)} ${(m.name || '').padEnd(26)} ${preis}`);
    }
    console.log(`\n${gefiltert.length} von ${liste.length} Modellen`);
  },

  async kosten(modell, formatId = 'feed', anzahl = '1') {
    if (!modell) throw new Error('Aufruf: kosten <modell> [format] [anzahl]');
    const s = await ruf('/api/schaetzung', {
      method: 'POST',
      body: JSON.stringify({ modell, formatId, anzahl: Number(anzahl) }),
    });
    console.log(`${anzahl}x ${s.masse} -> ${s.ziel}`);
    if (s.dollar == null) {
      console.log('Fuer dieses Modell liegt noch kein Preis vor - erst nach dem ersten Lauf bekannt.');
      return;
    }
    const art = s.gemessen ? 'gemessen' : 'geschaetzt';
    console.log(`${geld(s.dollar)} gesamt, ${geld(s.proBild)} pro Bild (${art})`);
    console.log(`heute bisher ${geld(s.verbrauch.dollar) || '0 USD'}`);
  },

  async erzeugen(motiv, ...rest) {
    if (!motiv) throw new Error('Kein Motiv angegeben.');
    const koerper = {
      motiv,
      modell: flagge(rest, 'modell', 'google/gemini-3.1-flash-image'),
      formatId: flagge(rest, 'format', 'feed'),
      anzahl: Number(flagge(rest, 'anzahl', '1')),
      name: flagge(rest, 'name', ''),
      referenz: flagge(rest, 'referenz', null),
      klein: rest.includes('--klein'),
      mitStil: !rest.includes('--ohne-stil'),
    };
    const e = await ruf('/api/erzeugen', { method: 'POST', body: JSON.stringify(koerper) });
    for (const d of e.erzeugt) console.log(d);
    const preis = e.dollar ? ` - ${geld(e.dollar)}` : '';
    console.log(`\n${e.erzeugt.length} Datei(en)${preis}`);
  },

  async animieren(motiv, ...rest) {
    if (!motiv) throw new Error('Kein Bewegungs-Prompt angegeben.');
    const koerper = {
      motiv,
      modell: flagge(rest, 'modell', 'google/veo-3.1-fast'),
      formatId: flagge(rest, 'format', 'story'),
      quellBild: flagge(rest, 'bild', null),
      name: flagge(rest, 'name', ''),
    };
    console.log('Clip wird erzeugt, das dauert Minuten ...');
    const e = await ruf('/api/animieren', { method: 'POST', body: JSON.stringify(koerper) });
    console.log(e.erzeugt[0]);
    const preis = e.dollar ? ` - ${geld(e.dollar)}` : '';
    console.log(`\nfertig nach ${e.sekunden} s${preis}`);
  },

  async liste(ordner = '') {
    const p = ordner ? `?ordner=${encodeURIComponent(ordner)}` : '';
    const s = await ruf(`/api/bestand${p}`);
    for (const e of s.eintraege) {
      console.log(`${e.art === 'video' ? '[VID]' : '[BLD]'} ${e.pfad}`);
      if (e.motiv) console.log(`      ${e.motiv}`);
    }
    console.log(`\n${s.eintraege.length} Eintraege`);
  },

  /**
   * Text auf ein Bild setzen. Legt eine neue Datei an, das Original bleibt.
   * *Wort* oder "Wort" setzt es in die Akzentfarbe. Kostet nichts.
   */
  async text(pfad, spruch, ...rest) {
    if (!pfad || !spruch) throw new Error('Aufruf: text <pfad> "<spruch>" [--schrift ...]');

    const s = await ruf('/api/start');
    const vorlageName = flagge(rest, 'vorlage', 'spruch');
    const vorlage = s.textVorlagen?.[vorlageName];
    if (!vorlage) {
      const vorhanden = Object.keys(s.textVorlagen || {}).join(', ');
      throw new Error(`Unbekannte Vorlage: ${vorlageName}. Vorhanden: ${vorhanden}`);
    }

    const ebene = {
      ...vorlage,
      text: spruch,
      schrift: flagge(rest, 'schrift', vorlage.schrift),
      groesse: Number(flagge(rest, 'groesse', vorlage.groesse)),
      farbe: flagge(rest, 'farbe', vorlage.farbe),
      akzentFarbe: flagge(rest, 'akzent', vorlage.akzentFarbe),
      x: Number(flagge(rest, 'x', vorlage.x)),
      y: Number(flagge(rest, 'y', vorlage.y)),
      ausrichtung: flagge(rest, 'ausrichtung', vorlage.ausrichtung),
    };

    const e = await ruf('/api/text-anwenden', {
      method: 'POST', body: JSON.stringify({ pfad, ebenen: [ebene] }),
    });
    console.log(e.pfad);
  },

  async schriften() {
    const s = await ruf('/api/start');
    let gruppe = null;
    for (const f of s.schriften || []) {
      if (f.gruppe !== gruppe) { gruppe = f.gruppe; console.log(`\n${gruppe}`); }
      console.log(`  ${f.name.padEnd(24)} ${f.notiz || ''}`);
    }
  },

  async umbenennen(pfad, neuerName) {
    if (!pfad || !neuerName) throw new Error('Aufruf: umbenennen <pfad> "<neuer name>"');
    const e = await ruf('/api/umbenennen', {
      method: 'POST', body: JSON.stringify({ pfad, neuerName }),
    });
    console.log(e.pfad);
  },

  async stil(neu) {
    if (neu === undefined) {
      const s = await ruf('/api/start');
      console.log(s.stil);
      return;
    }
    const e = await ruf('/api/stil', { method: 'POST', body: JSON.stringify({ text: neu }) });
    console.log(e.stil);
  },

  async verlauf(anzahl = '15') {
    const s = await ruf('/api/start');
    for (const e of (s.verlauf || []).slice(0, Number(anzahl))) {
      const zeit = new Date(e.zeit).toLocaleTimeString('de-DE');
      console.log(`${zeit}  ${e.quelle.padEnd(7)} ${e.was.padEnd(10)} ${e.text}`);
    }
  },
};

const HILFE = `Kynto Studio - Kommandozeile

  status                        Schluessel, Guthaben, Verbrauch, Bestand
  modelle [bild|video] [wort]   Modelle mit Preisen
  kosten <modell> [format] [n]  Preis vorher ansehen, erzeugt nichts
  erzeugen "<motiv>"            [--modell x] [--format feed] [--anzahl 1]
                                [--name x] [--referenz <pfad>] [--klein]
                                [--ohne-stil]
  animieren "<bewegung>"        [--modell x] [--bild <pfad>] [--format story]
  text <pfad> "<spruch>"        Text aufs Bild, *Wort* wird zum Akzent.
                                Kostet nichts, laeuft lokal.
                                [--vorlage spruch|statement|einWort]
                                [--schrift x] [--groesse 0.08]
                                [--farbe #F2F2F2] [--akzent #8B1A1A]
                                [--x 0.5] [--y 0.76]
  schriften                     verfuegbare Schriften
  liste [ordner]                Bestand anzeigen
  umbenennen <pfad> "<name>"    Datei umbenennen
  stil ["<text>"]               Stil-Block lesen oder setzen
  verlauf [anzahl]              letzte Vorgaenge

Erzeugen und Animieren kosten Geld ueber OpenRouter.
"kosten" vorher aufrufen und den Betrag nennen.

Jeder Aufruf erscheint im Studio-Verlauf als "Claude".`;

const [befehl, ...argumente] = process.argv.slice(2);

if (!befehl || befehl === 'hilfe' || befehl === '--help' || befehl === '-h') {
  console.log(HILFE);
  process.exit(0);
}

if (!befehle[befehl]) {
  console.error(`Unbekannter Befehl: ${befehl}. "hilfe" zeigt alle.`);
  process.exit(1);
}

befehle[befehl](...argumente).catch((fehler) => {
  console.error(fehler.message);
  process.exit(1);
});
