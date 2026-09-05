# Drei Fehler im Chat und beim Erzeugen

**5. September 2026**

---

## Für GitHub

> **Chat lief sich tot, Feed-Format ging mit OpenAI nie**
>
> Drei Fehler, die zusammen aussahen wie einer. Ein Vorschlag im Chat
> hinterließ eine Werkzeug-Antwort ohne zugehörigen Aufruf — danach lehnte
> OpenRouter jede weitere Anfrage ab, mit jedem Modell, dauerhaft. Dazu:
> das Format „Feed" (4:5) nimmt OpenAI gar nicht an, was jeden Lauf mit
> gpt-image-2 abbrechen ließ. Und eine zu breite Fehlerregel behauptete bei
> gedrosselten Gratis-Modellen, sie kämen „mit den Werkzeugen nicht
> zurecht". Alle drei behoben, alle drei gegen die echte API geprüft.

Commit-Zeile:

```
Chat lief sich tot, Feed ging mit OpenAI nie - drei Fehler behoben
```

---

## Neue Dateien

Keine.

---

## Geänderte Dateien

| Datei | Was |
|---|---|
| `lib/chatverlauf.mjs` | `heile()` zerlegt in `kuerze` / `ohneVerwaiste` / `ohneOffene` und wirft jetzt auch verwaiste Werkzeug-Antworten weg. Neu exportiert: `heile()` und `fuerBrowser()` |
| `server.mjs` | eingehender Verlauf wird geheilt, bevor irgendetwas zu OpenRouter geht; der Browser bekommt `fuerBrowser()` statt der gespeicherten Fassung; das Ersatz-Seitenverhältnis landet im Sidecar |
| `lib/anbieter-openrouter-bild.mjs` | liest die erlaubten Seitenverhältnisse aus der Ablehnung, nimmt das nächstgelegene, merkt es sich je Modell und versucht es einmal erneut |
| `lib/anbieter-openrouter-chat.mjs` | 429 wird als Drosselung erkannt und benannt, bevor die Werkzeug-Erklärung greift; `metadata.raw` statt des nichtssagenden `message` |

---

## Die drei Fehler

### 1. Ein Vorschlag machte das Gespräch dauerhaft kaputt

**Was passierte:** Das Modell schlägt vor, ein Bild zu erzeugen. Der Server
sendet den Vorschlag, bricht die Schleife ab und speichert. Beim Speichern
schnitt `heile()` die Assistenten-Nachricht mit dem `tool_call` weg — richtig
so, denn wer das Fenster jetzt schließt, beantwortet sie nie. Dann bekam der
Browser genau diese gekürzte Fassung zurück und hängte seine Antwort auf den
Vorschlag daran. Ergebnis: eine `tool`-Zeile ohne den Aufruf davor.

**Warum das nicht wieder wegging:** Ein solcher Verlauf ist für die
Schnittstelle ungültig. Jede weitere Anfrage kam mit HTTP 400 zurück — egal
welches Modell, egal was man schrieb. Und weil `heile()` nur nach vorne und
nach hinten schnitt, aber keine verwaisten Zeilen in der Mitte kannte, stand
sie auch nach jedem Neustart wieder da. In deiner `chat.json` waren am Ende
sechs unbeantwortete „warum ging das nicht?" hintereinander.

**Der Fix, zweiteilig:**
- `ohneVerwaiste()` wirft jede `tool`-Zeile weg, zu der weiter oben kein
  Aufruf steht. Das repariert bestehende Dateien beim nächsten Lesen.
- Der Browser bekommt jetzt bewusst eine **andere** Fassung als die Platte:
  mit dem offenen Aufruf, den er im nächsten Atemzug beantwortet. Die Platte
  bekommt ihn nicht. Der Unterschied ist der ganze Punkt.
- Und was aus dem Browser kommt, wird beim Eintreffen geheilt statt geglaubt.

### 2. Format „Feed" ging mit OpenAI-Modellen nie

**Was passierte:** `Feed 4:5` schickt `aspect_ratio: "4:5"`. OpenAI nimmt nur
1:1, 3:2, 2:3, 4:3, 3:4, 16:9, 9:16, 21:9 — 4:5 ist nicht dabei. Jeder Lauf
mit gpt-image-2 im Feed-Format brach ab.

**Warum nicht einfach nachschlagen:** Am 05.09.2026 nachgesehen — **kein
einziges** der 52 Bildmodelle bei OpenRouter nennt seine erlaubten
Seitenverhältnisse in der Modell-Liste. Nur die Ablehnung nennt sie. Also
wird sie gelesen: erlaubte Werte aus der Fehlermeldung ziehen, das
nächstgelegene nehmen, je Modell merken, einmal erneut versuchen. Ein 400
wird nicht abgerechnet, nur der zweite Anlauf kostet.

**Was das fürs Bild heißt:** 4:5 wird zu 3:4, und `resize.ps1` beschneidet
mittig auf 1080×1350 — was es bei jedem Format ohnehin tut. Weicht das
gerenderte Verhältnis vom gewünschten ab, steht es im Sidecar
(`"verhaeltnis": "3:4 statt 4:5"`), damit man den Beschnitt nachlesen kann
statt zu rätseln.

Betroffen war nur „Feed". Story, Quadrat, Pinterest und Roh nimmt OpenAI
direkt an.

### 3. Die Fehlermeldung log

**Was passierte:** `glm-5.2:free` antwortete gar nicht. Die Meldung sagte,
das Modell komme „mit den Werkzeugen nicht zurecht". Stimmte nicht — es kam
HTTP 429, das Gratis-Kontingent war upstream dicht.

**Warum:** Die Regel prüfte auf den Text „Provider returned error" und fing
damit auch jede Drosselung ab, weil OpenRouter durchgereichte Anbieterfehler
alle so betitelt. Eine falsche Erklärung ist schlimmer als keine — man sucht
an der falschen Stelle.

**Der Fix:** Der Statuscode wird zuerst geprüft. 429 heißt jetzt: *„… ist
gerade gedrosselt, nicht kaputt. In etwa 60 Sekunden wieder. Bei
Gratis-Modellen teilen sich alle Nutzer ein Kontingent …"* Die
Werkzeug-Erklärung greift erst danach — und hängt den echten Anbietertext aus
`metadata.raw` an, statt ihn zu schlucken.

---

## Entscheidungen

**Der Browser bekommt bewusst nicht dasselbe wie die Platte.** Vorher war
das eine ausdrückliche Regel („was der Browser bekommt, ist genau das, was
auf der Platte steht"). Genau sie hat den Fehler erzeugt. Die zwei haben
verschiedene Aufgaben: die Platte überlebt das Schließen des Fensters, der
Browser beantwortet gerade einen Vorschlag. Der Unterschied ist auf beiden
Seiten kommentiert.

**Kein automatischer neuer Versuch bei 429.** Ein stiller Wiederholungslauf
würde verdecken, dass Gratis-Modelle unzuverlässig sind. Die Meldung sagt,
was los ist und was hilft; entscheiden soll der Mensch.

**Das Ersatzverhältnis wird gemerkt, nicht fest eingetragen.** Eine Tabelle
je Modell veraltet; die Ablehnung ist immer aktuell. Gemerkt wird nur zur
Laufzeit — nach einem Neustart kostet es einen 400, und der kostet nichts.

---

## Geprüft

Gegen die echte API, mit deinem Schlüssel, an deiner laufenden App.

**Ohne Kosten:**
- Deine kaputte `chat.json`: 20 Nachrichten, 1 verwaiste → nach der Heilung
  19 Nachrichten, 0 verwaiste, Gespräch inhaltlich vollständig erhalten
- die Ablehnung für `4:5` echt abgerufen (HTTP 400 wird nicht abgerechnet)
  und den Parser dagegen gehalten: findet alle acht erlaubten Werte, wählt
  `3:4`. Gegenprobe für alle fünf Formate der App
- `glm-5.2:free` direkt angefragt: HTTP 429, `retry_after_seconds: 5`
- alle neun Modelle der Chat-Auswahl gegen die Live-Liste geprüft — alle
  vorhanden, alle mit `tools`

**Mit Kosten, zusammen rund 0,74 ¢:**
- Ein echter Chat-Zug mit genau dem vorher tödlichen Verlauf: läuft, ruft
  `einstellung_lesen` auf, macht einen Vorschlag. 0,0003 $. Browser bekommt
  24 Nachrichten (mit offenem Aufruf), Platte 23 (ohne) — 0 verwaiste auf
  beiden Seiten.
- Ein echtes Bild, `gpt-image-2` + `Feed 4:5`, im Browser über den
  Komponisten ausgelöst: **läuft durch**. 0,70 ¢. Datei ist 1080×1350,
  Sidecar vermerkt `3:4 statt 4:5`.
- Direkt danach „Als Vorlage" im Hinweis — der einzige Weg, der bei den
  Vorlagen noch ungeprüft war. Vorlage liegt mit Modell, Format und dem
  erzeugten Bild als Miniatur in `daten/vorlagen.json`.

**Im Bestand liegt jetzt ein Testbild** (`a-single-weathered-iron_…png`) und
eine Vorlage „Eisennagel auf Schiefer". Beides kann weg — die Vorlage über
das × im Dialog, das Bild im Explorer.
