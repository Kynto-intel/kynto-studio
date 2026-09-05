# Änderungen

Eine Datei je Änderung, neueste zuerst. Jede sagt in drei Zeilen, was neu
ist — und darunter genau, welche Datei angefasst wurde und warum.

Der Sinn: nach zwei Wochen weiß niemand mehr, was `web/erzeugen.js +146`
bedeutet hat. Hier steht es.

| Datum | Was | Datei |
|---|---|---|
| 2026-09-06 | Regie: Handwerkswissen für den Assistenten | [2026-09-06-regie.md](2026-09-06-regie.md) |
| 2026-09-05 | Einstellungs-Reiter mit Tagesgrenzen | [2026-09-05-tagesgrenzen.md](2026-09-05-tagesgrenzen.md) |
| 2026-09-05 | Video: Dauer und Auflösung einstellbar | [2026-09-05-video-regler.md](2026-09-05-video-regler.md) |
| 2026-09-05 | Vorlagen: Reiter statt Fenster | [2026-09-05-vorlagen-als-reiter.md](2026-09-05-vorlagen-als-reiter.md) |
| 2026-09-05 | Chat lief sich tot, Feed ging mit OpenAI nie — drei Fehler | [2026-09-05-chat-und-seitenverhaeltnis.md](2026-09-05-chat-und-seitenverhaeltnis.md) |
| 2026-09-05 | Vorlagen: gespeicherte Läufe wieder aufrufen | [2026-09-05-vorlagen.md](2026-09-05-vorlagen.md) |
| 2026-09-05 | CLAUDE.md: Arbeitsanleitung fürs Projekt | [2026-09-05-claude-md.md](2026-09-05-claude-md.md) |

---

## Wann eine Notiz fällig ist

Nicht für jede Kleinigkeit — nur für die größeren Sachen. Eins davon reicht:

- eine neue Funktion, die man in der App sieht
- ein neues Modul in `lib/` oder `web/`
- eine neue Route oder ein geändertes API-Verhalten
- eine neue Datei unter `daten/`
- eine der Regeln aus `CLAUDE.md` wird berührt oder kommt dazu
- ein Umbau über drei, vier Dateien

**Nicht nötig** für Tippfehler, einen Abstand im CSS, eine Beschriftung,
einen Einzeiler ohne Wirkung nach außen. Dafür reicht die Commit-Zeile.

Im Zweifel schreiben. Eine Notiz zu viel kostet fünf Minuten, eine fehlende
kostet später eine Stunde Suchen.

**Immer eine neue Datei.** Nie an eine bestehende anhängen — eine Änderung,
eine Datei, eine Zeile in der Tabelle oben.

---

## Aufbau einer Notiz

Immer dieselben fünf Abschnitte, damit man sie überfliegen kann:

1. **Für GitHub** — der kurze Text zum Übernehmen in Commit oder Release
2. **Neue Dateien** — Pfad, Zweck, Größe
3. **Geänderte Dateien** — was genau, nicht nur dass
4. **Entscheidungen** — was bewusst so und nicht anders, mit Begründung
5. **Geprüft** — womit, und was ungeprüft blieb

Dateiname: `JJJJ-MM-TT-kurzname.md`. Bei mehreren Änderungen am selben Tag
zählt der Kurzname sie auseinander, keine Nummer.
