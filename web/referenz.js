// Referenzbild-Verwaltung.
//
// Ein einziger Zustand: entweder ist ein Referenzbild gesetzt oder nicht.
// Gesetzt heisst, es geht an das Modell. Leer heisst, es geht ohne raus.
// Es gibt bewusst keinen Schalter und keinen zweiten Modus.

import { dateiUrl } from './api.js';

let aktuell = null;
let beiWechsel = () => {};

const el = (id) => document.getElementById(id);

export function setzeWechselZiel(fn) { beiWechsel = fn; }

/** Aktueller Referenzpfad oder null. */
export function pfad() {
  return aktuell?.pfad || null;
}

function zeichne() {
  const kasten = el('referenz');
  if (!aktuell) {
    kasten.hidden = true;
    beiWechsel();
    return;
  }
  el('referenzBild').src = dateiUrl(aktuell.pfad);
  el('referenzName').textContent = aktuell.name;
  kasten.hidden = false;
  beiWechsel();
}

export function setze(eintrag) {
  aktuell = eintrag;
  zeichne();
}

export function leere() {
  aktuell = null;
  zeichne();
}

export function verdrahte() {
  el('referenzWeg').addEventListener('click', leere);
}
