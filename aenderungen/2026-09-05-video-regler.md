# Video: Dauer und Auflösung einstellbar

**5. September 2026**

---

## Für GitHub

> **Clips: Dauer und Auflösung wählbar statt fest verdrahtet**
>
> 28 Videomodelle standen zur Auswahl, aber jeder Clip lief mit 5 Sekunden
> und 1080p — die Werte waren im Server fest verdrahtet und nirgends
> einstellbar. Jetzt stehen sie unten in der Leiste neben Modell und Format,
> gelten wie das Modell app-weit (Assistent und API erben sie), und Vorlagen
> merken sie sich mit.

Commit-Zeile:

```
Video: Dauer und Aufloesung einstellbar statt fest auf 5 s / 1080p
```

---

## Neue Dateien

Keine.

---

## Geänderte Dateien

| Datei | Was |
|---|---|
| `lib/konfig.mjs` | `VIDEO_DAUERN` und `VIDEO_AUFLOESUNGEN` als feste Listen; `videoDauer`/`videoAufloesung` in `STANDARD`; `speichereStandard` prüft beide gegen die Liste |
| `server.mjs` | `/api/animieren` erbt beide aus `STANDARD`, schreibt sie ins Sidecar und in den Verlaufstext; `/api/start` liefert die Auswahllisten; `/api/schaetzung` nennt die Clip-Einstellung; der Systemhinweis für den Assistenten auch |
| `lib/werkzeuge.mjs` | `einstellung_lesen` gibt beide mit aus |
| `lib/sidecar.mjs` | `dauer`, `aufloesung` und `verhaeltnis` stehen jetzt in `LEER` statt nur zufällig durchzurutschen |
| `lib/vorlagen.mjs` | Video-Vorlagen speichern Dauer und Auflösung; bei Bildern bleiben die Felder `null` |
| `web/index.html` | zwei Regler-Plätze `#dauerWahl` und `#aufloesungWahl` |
| `web/erzeugen.js` | die zwei Menüs; nur bei Video sichtbar; gehen an `/api/animieren` mit; Schätzzeile nennt sie; `ladeVorlage` stellt sie wieder her |
| `web/vorlagen.js` | Karte zeigt `10 s · 720p` |
| `web/detail.js` | Zeilen „Clip" und „Verhältnis" in der Detailansicht; „Als Vorlage" nimmt beide mit |
| `web/chat.js` | die Vorschlagskarte für Clips nennt Dauer und Auflösung, statt nur „Preis erst nach dem Lauf bekannt" |
| `README.md`, `CLAUDE.md` | nachgezogen |

---

## Entscheidungen

**Die Werte stehen auf dem Server, nicht im Browser.** Dieselbe Begründung
wie beim Modell (Regel 2): Der Assistent schlägt einen Clip vor, aber wie
lang und wie groß er wird, ist eine Einstellung des Menschen — und der
Assistent, ein Skript über die API und der Komponist müssen dasselbe sehen.
`merker.js` bleibt für reine Browser-Vorlieben.

**Feste Listen statt Abfrage.** Nachgesehen am 05.09.2026: **kein einziges**
der 28 Videomodelle nennt in OpenRouters Modell-Liste seine Dauern oder
Auflösungen, und die Beschreibungen sind mitten im Satz abgeschnitten
(„Clips range from 3 to…"). 3/5/8/10 Sekunden und 720p/1080p sind die Werte,
die quer durch Kling, Veo, Runway und Seedance üblich sind.

**Keine Selbstkorrektur wie beim Seitenverhältnis.** Beim Bild liest die App
die erlaubten Werte aus der Ablehnung und versucht es erneut — dort kostet
ein abgelehnter Versuch nichts und der Fall war echt nachweisbar. Beim Clip
wurde darauf verzichtet: um es zu bauen und zu prüfen, müsste man Clips
rendern, und die sind der teure Teil. Lehnt ein Modell einen Wert ab, nennt
seine eigene Meldung die erlaubten — die wird durchgereicht.

**Das Sidecar bekommt Dauer und Auflösung.** Vorher fehlten sie, damit ließ
sich ein Clip aus der Detailansicht nicht wiederholen — und genau das soll
„Als Vorlage" dort können.

---

## Geprüft

Ohne einen einzigen Clip zu rendern. Isolierte Kopie auf Port 4899, eigener
Datenordner; die laufende Instanz wurde nicht angefasst.

**Server:**
- `/api/start` liefert `videoDauer: 5`, `videoAufloesung: "1080p"` und beide
  Auswahllisten
- `/api/schaetzung` nennt die Clip-Einstellung
- Umstellen auf 10 s / 720p landet in `studio.config.json`
- Unsinn wird abgewiesen: Dauer 7, Auflösung „4K", Dauer „abc"

**Oberfläche, in echtem Chrome — 21 Prüfungen, alle grün, keine
Konsolenfehler:**
- bei Bild sind beide Regler versteckt und die Anzahl sichtbar, bei Video
  umgekehrt
- beide stehen auf dem Serverwert, die Schätzzeile nennt sie und zieht beim
  Umstellen nach
- der Server übernimmt die Änderung sofort
- **`fetch` auf `/api/animieren` abgefangen** statt einen Clip zu bezahlen:
  im Rumpf stehen `dauer: 10`, `aufloesung: "720p"` und das Modell aus der
  App — bewiesen, dass die Einstellung wirklich rausgeht
- „Als Vorlage" nach dem Lauf speichert beide; die Karte zeigt
  `10 s · 720p`; nach dem Zurücksetzen auf 3 s / 1080p stellt das Laden der
  Vorlage 10 s / 720p wieder her und meldet es dem Server

**Nicht geprüft:** ein echter Clip mit geänderter Dauer. Ob ein bestimmtes
Modell 3 oder 8 Sekunden tatsächlich annimmt, zeigt sich beim ersten Lauf —
die Ablehnung nennt dann die erlaubten Werte.
