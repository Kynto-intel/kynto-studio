# Einstellungs-Reiter mit Tagesgrenzen

**5. September 2026**

---

## Für GitHub

> **Tagesgrenzen: die App kann jetzt aufhören, Geld auszugeben**
>
> Bisher gab es keine Bremse. Neu ist ein Reiter „Einstellungen" neben den
> Vorlagen mit vier Tagesgrenzen in Dollar: alles zusammen, Bilder, Video
> und Assistent. Ist eine erreicht, wird nichts mehr erzeugt — egal ob der
> Klick vom Menschen, vom Assistenten oder von einem Skript über die API
> kommt. Der Assistent kennt die Grenzen und schlägt nichts vor, was daran
> scheitern würde. Feld leer heißt: keine Bremse, wie bisher.

Commit-Zeile:

```
Tagesgrenzen: Einstellungs-Reiter, vier Bremsen, eine Stelle die prueft
```

---

## Neue Dateien

| Datei | Zeilen | Zweck |
|---|---|---|
| `web/einstellungen.js` | 205 | Die Grenzen-Ansicht im Raster |

---

## Geänderte Dateien

| Datei | Was |
|---|---|
| `lib/kosten.mjs` | zählt Bild- und Video-Kosten getrennt (`bildDollar`, `videoDollar`); neu `pruefe(art)` — die eine Stelle, die entscheidet, ob noch etwas laufen darf |
| `lib/konfig.mjs` | `GRENZEN` aus `studio.config.json` unter `grenzen`; `speichereGrenzen()` |
| `server.mjs` | `kosten.pruefe()` in `/api/erzeugen`, `/api/animieren` und vor jedem Chat-Zug; Routen `GET`/`POST /api/grenzen`; Grenzen in `/api/start`; Systemhinweis sagt dem Assistenten Bescheid |
| `lib/werkzeuge.mjs` | `einstellung_lesen` meldet Grenzen und heutigen Verbrauch je Gattung |
| `web/raster.js` | statt einer festen Vorlagen-Ansicht jetzt beliebig viele: `meldeAnsicht(id, def)` mit `platz: 'oben'\|'unten'`; der Reiter zeigt eine Zahl nur, wo es etwas zu zählen gibt |
| `web/index.html` | zweite Systemliste `#untenListe` direkt über dem Fuß |
| `web/studio.js` | meldet Vorlagen (oben) und Einstellungen (unten) an; der Fuß zeigt den Verbrauch gegen die Gesamtgrenze |
| `web/symbole.js`, `web/api.js`, `web/studio.css` | Symbol, Aufrufe, Formular |
| `README.md`, `CLAUDE.md` | nachgezogen |

Umbenannt: die CSS-Klasse `.vorlagen-reiter` heißt jetzt `.system-reiter` —
es sind zwei geworden.

---

## Entscheidungen

**Pro Tag, nicht insgesamt.** Eine Gesamtgrenze wäre irgendwann erreicht und
die App dann dauerhaft tot, ohne dass jemand weiß warum. Der Tag beginnt um
Mitternacht nach der Uhr dieses Rechners neu — dieselbe Rechnung wie beim
Verbrauchszähler, aus demselben Grund (in Mitteleuropa läge UTC bis 02:00
noch auf gestern).

**Eine einzige Stelle prüft.** `kosten.pruefe()` sitzt in allen drei Wegen,
die Geld ausgeben. Es gibt keinen vierten. Damit ist es dieselbe Bauart wie
Regel 1: nicht auf Wohlverhalten hoffen, sondern den Pfad zumachen.

**Der Assistent bekommt die Zahlen zu sehen.** `einstellung_lesen` meldet
Grenzen und heutigen Stand, und der Systemhinweis sagt ihm, dass er nichts
vorschlagen soll, was daran scheitert. Der Server weist es ohnehin ab — aber
ein Vorschlag, der gar nicht laufen kann, verschwendet nur Zeit.

**Bild und Video werden ab jetzt getrennt gezählt.** Vorher wusste ein Tag
nur, *wie viele* Bilder und Clips es waren, nicht was jedes gekostet hat.
Ohne die Trennung ließe sich keine eigene Grenze je Gattung ziehen. Alte
Einträge in `verbrauch.json` haben die Felder nicht — dort steht 0, die
Zählung beginnt mit dem nächsten Lauf.

**Kein Speichern-Knopf.** Vier Felder, jedes speichert beim Verlassen. Ein
Sammel-Knopf, den man vergisst, ließe die Bremse still unwirksam — und
genau das darf bei einer Bremse nicht passieren.

**Die Seitenleiste hat jetzt drei Zonen.** Oben die Ordner des Nutzers,
darunter (nach „Ordner einstellen") die Ansichten, mit denen man arbeitet —
derzeit die Vorlagen. Ganz unten, direkt über der Linie mit Guthaben und
Verbrauch, das, was die App selbst betrifft: die Einstellungen. Sie gehören
thematisch zu den Zahlen darunter und nicht zwischen die Arbeitsmittel.
Technisch hängt `margin-top: auto` deshalb an `#untenListe` statt am Fuß —
zwei solche Angaben in derselben Spalte würden den freien Platz aufteilen
und beide Blöcke in die Mitte rutschen lassen.

**Was die Bremse NICHT kann, steht in der Oberfläche.** Geprüft wird gegen
das, was schon abgerechnet ist. Ein einzelner Lauf kann die Grenze noch
reißen: was er kostet, sagt OpenRouter erst danach, und bei Video vorher gar
nicht. Die Bremse verhindert den nächsten Lauf, nicht den laufenden. Alles
andere wäre eine Zusage, die die Schnittstelle nicht hergibt.

---

## Geprüft

Isolierte Kopie auf Port 4899, eigener Datenordner. Deine echte
`studio.config.json` wurde nicht angefasst — sie hat weiterhin keinen
`grenzen`-Eintrag, alle Bremsen sind bei dir also aus.

**Server**, mit gefälschtem Verbrauch statt echter Läufe:
- ohne Grenzen läuft alles wie bisher
- Grenzen setzen landet in `studio.config.json`
- Bild-Limit gerissen → `/api/erzeugen` abgewiesen, Video lief weiter
  (scheiterte nur am absichtlich falschen Modell) — die Bremse ist also
  wirklich nach Gattung getrennt
- Gesamtgrenze gerissen → auch Video abgewiesen, obwohl dessen eigenes
  Budget noch Luft hatte
- Assistenten-Limit gerissen → Chat-Zug bricht ab, bevor OpenRouter gefragt
  wird
- Limit aus → Anfrage kommt an der Bremse vorbei (nachgewiesen mit einer
  leeren Nachrichtenliste, also ohne Modellaufruf)
- `einstellung_lesen` liefert Grenzen und Stand je Gattung

**Oberfläche**, in echtem Chrome — 16 Prüfungen zur Bremse, 10 weitere zur
Anordnung, alle grün:
- Reihenfolge der Leiste: Ordner → „Ordner einstellen" → Vorlagen →
  Einstellungen → Guthaben/Verbrauch → Verlauf
- Einstellungen sitzt 18 px über der Trennlinie und 348 px unter den
  Vorlagen — also wirklich unten, nicht nur laut Markup
- eingeklappt bleibt das Symbol in der Spur der Ordner-Symbole
- Einstellungen ohne Zahl, Vorlagen mit
- vier Grenzen, alle Felder leer, ohne Grenze kein Balken
- Eintragen speichert sofort auf dem Server, die anderen drei bleiben aus
- Balken steht auf 75 % bei 1,50 von 2,00 $
- Erzeugen wird in der Oberfläche mit der echten Meldung abgewiesen, und im
  Bestand entsteht nichts
- der Fuß der Seitenleiste zeigt `1,50 $ / 3,00 $`, sobald eine
  Gesamtgrenze steht

Kosten: 0,03 ¢ für einen Chat-Zug, der durch einen Reihenfolge-Fehler in
meinem Testskript lief, bevor die Grenze gesetzt war. Sonst nichts — es
wurde kein Bild und kein Clip erzeugt.
