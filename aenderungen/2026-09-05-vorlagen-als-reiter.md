# Vorlagen: Reiter statt Fenster

**5. September 2026**

Löst die Dialog-Fassung aus [2026-09-05-vorlagen.md](2026-09-05-vorlagen.md)
ab. Was eine Vorlage speichert und wie sie geladen wird, steht dort und
ändert sich hier nicht — nur wo man sie sieht.

---

## Für GitHub

> **Vorlagen sind jetzt eine Ansicht, kein Fenster**
>
> „Vorlagen" steht als Reiter in der Seitenleiste und füllt dasselbe Raster
> wie die Bilder — gleiche Karten, gleiche Größe, mit dem Ergebnisbild als
> Vorschau. Vorher lag darüber ein Dialog, den man erst wieder zumachen
> musste. Anklicken lädt weiterhin nur den Komponisten und erzeugt nichts.

Commit-Zeile:

```
Vorlagen: Reiter in der Leiste statt eines Fensters darueber
```

---

## Neue Dateien

Keine.

---

## Geänderte Dateien

| Datei | Was |
|---|---|
| `web/raster.js` | zweite Ansicht `vorlagen` neben `bestand`; `baueOrdnerListe` füllt jetzt zwei Listen — die Ordner oben, den Vorlagen-Reiter in `#systemListe`; `zeigeBestand()` und `setzeVorlagenAnsicht()` neu |
| `web/vorlagen.js` | kein Dialog mehr. Statt `oeffne`/`schliesse`/`verdrahte` jetzt `zeichne(ziel)`, `lade()`, `anzahl()` und `setzeAenderungsZiel()`. `sichere()` und `benennung()` unverändert |
| `web/index.html` | der dashed Knopf „Vorlagen" und der Dialog `#vorlagen` sind raus; dafür `#systemListe` hinter „Ordner einstellen" |
| `web/symbole.js` | Symbol für den Reiter — zwei Blätter übereinander, unter dem Schlüssel `__vorlagen__`, den kein echter Ordner tragen kann |
| `web/studio.js` | Vorlagen werden vor dem ersten Aufbau der Seitenleiste angemeldet, damit Reiter und Zahl gleich stehen; nach dem Laden schaltet die Ansicht zurück auf den Bestand |
| `web/studio.css` | Dialog-Regeln raus, dafür der Reiter, die Karten-Zusätze und der Löschknopf |
| `README.md`, `CLAUDE.md` | nachgezogen |

---

## Entscheidungen

**Kein Fenster.** Ein Dialog über der Galerie ist ein zweiter Ort, an dem
Kacheln stehen — und man muss ihn zumachen, bevor es weitergeht. Als Ansicht
im selben Raster ist es ein Griff weniger und sieht aus wie das, was dabei
herauskommt.

**„Ordner einstellen" ist die Grenze.** Darüber steht, was dem Nutzer
gehört: seine Ordner. Darunter, was zur App gehört: Ansichten, die es nur im
Studio gibt. Deshalb liegt der Vorlagen-Reiter in einer eigenen Liste
(`#systemListe`) statt am Ende der Ordner — dort sah er aus wie ein Ordner,
der er nicht ist. Aussehen und Bedienung bleiben gleich, nur die Zugehörigkeit
ist eine andere. Eingeklappt trennt der Abstand die beiden Gruppen weiter,
auch wenn der Knopf dazwischen verschwindet.

**Die Vorlagen-Karte ist dieselbe `.karte` wie ein Bild.** Klasse, Vorschau
und Fuß werden geerbt, nicht nachgebaut. Eine Vorlage soll aussehen wie das
Bild, das aus ihr wird; zwei Kartensorten nebeneinander wären zwei Sorten zu
pflegen.

**`raster.js` kennt `vorlagen.js` nicht.** Das Modul wird von `studio.js`
hereingereicht (`setzeVorlagenAnsicht`) — dieselbe Rückruf-Machart wie
überall sonst in `web/`.

**Nach dem Laden zurück auf den Bestand.** Das Motiv steht dann unten im
Komponisten, und gleich soll man sehen, was dabei herauskommt. In der
Vorlagen-Ansicht stehenzubleiben hieße, das Ergebnis zu verpassen.

**Suche und Favoriten-Haken schalten auf den Bestand.** Sie hätten in den
Vorlagen nichts zu filtern und sähen aus, als seien sie kaputt.

**Der Löschknopf erscheint erst beim Überfahren.** Ein × , das dauerhaft auf
jeder Kachel klebt, wird irgendwann versehentlich getroffen.

---

## Geprüft

In echtem Chrome ferngesteuert, 24 Prüfungen, alle grün, keine
Konsolenfehler. Zusätzlich ein Bildschirmfoto angesehen, statt nur den DOM
zu glauben.

- alter Dialog und alter Knopf sind restlos weg
- Reiter steht direkt hinter „Ordner einstellen", nicht mehr in der
  Ordnerliste; der letzte Ordner-Eintrag ist wieder ein echter Ordner
- Reiter ist genauso hoch wie ein Ordner-Eintrag und trägt keine eigene
  Trennlinie mehr
- eingeklappt bleibt er in der Spur der Ordner-Symbole, und der 40px-Abstand
  für den Burger sitzt nur über der oberen Liste
- Umschalten setzt den Titel auf „Vorlagen", macht den Reiter aktiv, nimmt
  allen Ordnern das Aktiv-Kennzeichen und versteckt die Bild/Video-Reiter
- im Raster stehen nur Vorlagen-Karten, keine Bilder
- Miniatur da, wo die Datei existiert; „ohne Bild" wo keine ist; die
  Video-Vorlage trägt die VIDEO-Marke
- Anklicken lädt Motiv und Modell in den Komponisten, schaltet zurück auf
  den Bestand — und **erzeugt nichts**
- Tippen im Suchfeld holt einen aus der Vorlagen-Ansicht zurück
- das × löscht, bleibt in der Ansicht, und die Zahl am Reiter zieht nach
- nachgemessen, dass der Motivtext im Kartenfuß nicht abgeschnitten wird

Ohne Kosten — es wurde nichts erzeugt.
