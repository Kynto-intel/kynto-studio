// Eigene Auswahl-Menues.
//
// Native <select>-Listen lassen sich nicht gestalten - Chrome zeichnet sie
// selbst. Deshalb hier ein eigenes Menue.
//
// Bei vielen Eintraegen (Modelle) werden die Gruppen zusammengeklappt:
// oben nur die Anbieter mit Anzahl, aufklappen zeigt deren Modelle. Sonst
// scrollt man durch 46 Zeilen, um eins zu finden.

let offenes = null;

document.addEventListener('click', (e) => {
  if (offenes && !offenes.wurzel.contains(e.target)) offenes.zu();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && offenes) offenes.zu();
});

/**
 * @param {HTMLElement} wurzel   Behaelter, in den das Menue gebaut wird
 * @param {object} optionen
 *   eintraege:  [{ wert, text, notiz, gruppe, gesperrt }]
 *   wert:       aktuell gewaehlter Wert
 *   beiWahl:    Rueckruf(neuerWert)
 *   klappbar:   Gruppen zusammenklappen (Standard: ab 2 Gruppen)
 */
export function baueAuswahl(wurzel, { eintraege, wert, beiWahl, klappbar = null }) {
  wurzel.classList.add('auswahl');
  wurzel.replaceChildren();

  const knopf = document.createElement('button');
  knopf.type = 'button';
  knopf.className = 'auswahl-knopf';
  knopf.setAttribute('aria-expanded', 'false');

  const liste = document.createElement('div');
  liste.className = 'auswahl-liste';
  liste.hidden = true;

  let aktuell = wert;

  // Gruppen in Reihenfolge des ersten Vorkommens.
  const gruppen = new Map();
  for (const e of eintraege) {
    const g = e.gruppe || '';
    if (!gruppen.has(g)) gruppen.set(g, []);
    gruppen.get(g).push(e);
  }

  const mitKlappen = klappbar ?? gruppen.size > 1;
  // Offen ist die Gruppe, in der die aktuelle Wahl steckt.
  let offeneGruppe = eintraege.find((e) => e.wert === aktuell)?.gruppe || [...gruppen.keys()][0];

  function beschriftung() {
    const treffer = eintraege.find((e) => e.wert === aktuell);
    knopf.textContent = treffer ? treffer.text : aktuell;
  }

  function zu() {
    liste.hidden = true;
    knopf.setAttribute('aria-expanded', 'false');
    if (offenes?.wurzel === wurzel) offenes = null;
  }

  function auf() {
    if (offenes && offenes.wurzel !== wurzel) offenes.zu();
    offeneGruppe = eintraege.find((e) => e.wert === aktuell)?.gruppe || offeneGruppe;
    baueListe();
    liste.hidden = false;
    knopf.setAttribute('aria-expanded', 'true');
    offenes = { wurzel, zu };
    liste.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }

  function zeile(e) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'auswahl-zeile';
    el.disabled = Boolean(e.gesperrt);
    el.setAttribute('aria-selected', String(e.wert === aktuell));

    const text = document.createElement('span');
    text.textContent = e.text;
    if (e.notiz) {
      const klein = document.createElement('small');
      klein.textContent = e.notiz;
      text.append(klein);
    }
    el.append(text);

    el.addEventListener('click', () => {
      aktuell = e.wert;
      beschriftung();
      zu();
      beiWahl?.(aktuell);
    });
    return el;
  }

  function baueListe() {
    liste.replaceChildren();

    for (const [name, posten] of gruppen) {
      if (!mitKlappen) {
        if (name) {
          const kopf = document.createElement('div');
          kopf.className = 'auswahl-gruppe';
          kopf.textContent = name;
          liste.append(kopf);
        }
        for (const e of posten) liste.append(zeile(e));
        continue;
      }

      const offen = name === offeneGruppe;
      const kopf = document.createElement('button');
      kopf.type = 'button';
      kopf.className = 'auswahl-klapper';
      kopf.setAttribute('aria-expanded', String(offen));
      // Enthaelt diese Gruppe die aktuelle Wahl?
      if (posten.some((p) => p.wert === aktuell)) kopf.classList.add('traegt-wahl');

      const titel = document.createElement('span');
      titel.textContent = name || 'Weitere';

      const zahl = document.createElement('em');
      zahl.textContent = posten.length;

      kopf.append(titel, zahl);
      kopf.addEventListener('click', (ev) => {
        ev.stopPropagation();
        offeneGruppe = offen ? null : name;
        baueListe();
      });
      liste.append(kopf);

      if (offen) {
        const fach = document.createElement('div');
        fach.className = 'auswahl-fach';
        for (const e of posten) fach.append(zeile(e));
        liste.append(fach);
      }
    }
  }

  knopf.addEventListener('click', (e) => {
    e.stopPropagation();
    liste.hidden ? auf() : zu();
  });

  beschriftung();
  baueListe();
  wurzel.append(knopf, liste);

  return {
    get wert() { return aktuell; },
    setze(neu) { aktuell = neu; beschriftung(); baueListe(); },
  };
}
