# Kynto Studio

A small local image and video studio for people who post on social media and
want their feed to look like **one** brand instead of a random collection.

Runs on your own machine. No account, no subscription, no server. You bring
your own [OpenRouter](https://openrouter.ai) key and pay only what you
actually generate — the price is shown **before** you click.

> German UI. The code and comments are German too. Contributions welcome
> either way — see [Contributing](#contributing).

---

## Why this exists

Most image tools give you a prompt box and a bill at the end of the month.
This one is built around three things the author kept getting wrong:

**You see the price before you spend it.** Every model shows its cost per
image. Once a model has actually run, the *measured* price from the real
invoice replaces the estimate. Nothing is guessed twice.

**Your style is enforced, not remembered.** A style block is appended to
every prompt automatically. You cannot forget it, so a whole feed keeps one
look without pasting the same three sentences into every prompt.

**The prompt never gets lost.** Every image gets a sidecar JSON next to it
with the prompt, model and settings. Rename or move the file in your file
manager — the metadata travels with it.

Plus a text editor that burns headlines onto images, because no image model
can render a full sentence reliably. One word, maybe. A sentence, no.

---

## Features

- **43 image models and 23 video models** through OpenRouter — Nano Banana,
  GPT Image, FLUX.2, Seedream, Krea, Recraft, Veo, Kling, Runway, Sora,
  Seedance and more. The catalog refreshes itself from the live API.
- **Reference images** — pick any image from your library as a style
  reference. Leave it empty and it runs without. No switch, no second mode.
- **Text on images** — templates, 17 curated fonts, colour, outline, shadow,
  drag to position. `*word*` or `"word"` puts a word in the accent colour.
  Rendered server-side, so the preview is exactly the result. Costs nothing.
- **Platform formats** — feed, story, square, pin. Generated at the right
  aspect ratio, then scaled to exact platform pixels. No manual cropping.
- **Search and a video tab** — search across filename, subject, the full
  prompt, model and caption. As soon as the library holds a video, a
  Videos tab appears next to the title; if you only make images, it never
  shows up.
- **A built-in assistant** — a chat sidebar that drives the studio: it
  searches your library, reads your style block, burns text onto images.
  When it wants to generate something it **proposes**, showing subject,
  format and price — you click. Paid tools have no execute path on the
  server at all, so a chatty model cannot spend your money. It never picks
  a model either: what you set in the app is what renders. Any of
  OpenRouter's ~360 tool-capable text models can run it; a turn costs about
  a third of a cent, and the conversation is kept in `daten/chat.json`.
- **It remembers your setup** — model, format and the two switches survive
  a reload. The number of images is the deliberate exception: it always
  starts at 1, so a forgotten "6×" never spends six times the money.
- **Live activity feed** — see what was generated, by whom, with the full
  prompt. Also picks up anything triggered from the command line, live.
- **Command line** — script it, batch it, or let an AI assistant drive it
  while you watch in the browser. `node studio.mjs hilfe` lists everything.

---

## Requirements

- **Node.js 20 or newer** (uses built-in `fetch` and `FormData`)
- **Windows** — image scaling and text rendering currently go through
  PowerShell and `System.Drawing`. See [Known limits](#known-limits).
- An **OpenRouter API key** ([openrouter.ai/keys](https://openrouter.ai/keys))

No npm packages. Nothing to install. Clone and run.

---

## Setup

```bash
git clone https://github.com/Kynto-intel/kynto-studio.git
cd kynto-studio
copy studio.config.beispiel.json studio.config.json
```

Edit `studio.config.json` and set `wurzel` to the folder holding your images.
Everything the app reads or writes stays inside that folder.

The gallery folders in the example are a suggestion, nothing more — delete
what you do not need. **The app never creates folders on its own.** Start it
without a config and it comes up with an empty gallery and a note telling you
to set your folders up, which you then do in the app. Nobody gets a set of
folders they never asked for dropped into their filesystem.

Then give it your OpenRouter key. Two ways, pick one:

**A file next to the app** — copy `.env.beispiel` to `.env` and put your key
in it. Works on every platform, and `.env` is git-ignored:

```
OPENROUTER_API_KEY=sk-or-v1-...
```

**Or an environment variable**, if you would rather not have a key in a file:

```powershell
[Environment]::SetEnvironmentVariable("OPENROUTER_API_KEY","sk-or-v1-...","User")
```

If both are set, **the environment variable wins** — the usual rule. The
sidebar and `studio.mjs status` say which one is in use, so a key that
appears to be ignored is never a mystery.

The key is read on the server and never sent to the browser. There is no
field in the interface to type it into, on purpose.

Start it:

```powershell
.\start.ps1
```

Opens `http://127.0.0.1:4890`. The server binds to localhost only.

---

## Configuration

`studio.config.json` controls where things live:

| Key | Meaning |
|---|---|
| `wurzel` | root folder. Nothing outside it is ever read or written |
| `port`, `host` | default `4890` on `127.0.0.1` |
| `ordner` | the folders shown in the gallery, relative to `wurzel` |
| `formate` | output formats, target sizes and which folder they land in |

Mark a folder `"schreibbar": false` and the app will only display it, never
write into it. Useful for a folder of your own photos.

You do not have to edit the file by hand. **Ordner einstellen** in the sidebar
opens a dialog for the root folder and the gallery folders — rename them, point them
somewhere else, add or remove them, decide which ones may be written to. On
save the file is rewritten, missing writable folders are created, and the
sidebar updates immediately. No restart.

Two rules are enforced: every folder needs a unique id, and at least one has
to stay writable — otherwise generated images would have nowhere to go.

---

## Command line

```bash
node studio.mjs hilfe
node studio.mjs status
node studio.mjs kosten openai/gpt-image-2 feed 3
node studio.mjs erzeugen "a lone raven on wet black rock" --modell openai/gpt-image-2
node studio.mjs text "Feed/image.png" "No *excuses*"
```

`node studio.mjs hilfe` prints every command with its switches. Each call
sends an `X-Quelle: claude` header and shows up in the browser's activity
feed with the full prompt, so you can watch what a script - or an AI
assistant - is doing while it happens.

---

## Known limits

**Windows only, for now.** Three files shell out to PowerShell for
`System.Drawing`: `lib/format.mjs`, `lib/text.mjs` and `lib/schriften.mjs`.
Everything else is portable Node. Porting means replacing those three with
something like `sharp` plus a canvas library — a contained job, and probably
the single most useful contribution right now.

**Video is barely tested.** The image path is used daily. The video path
(async job, polling, download) was built and its error paths verified, but it
has seen only a handful of successful runs. Treat it as beta.

**Fonts come from your system.** The app lists fonts that are installed on
your machine; it does not ship any. If a font in the list is missing, it
drops out of the menu rather than silently substituting.

**No accounts, no multi-user.** This is a single-person tool that happens to
have a web interface. Do not expose it to a network.

---

## Contributing

Issues and pull requests are welcome. Good first areas:

- **Linux/macOS support** — replace the three PowerShell modules
- **More providers** — the provider modules are small and self-contained,
  see `lib/anbieter-openrouter-bild.mjs` for the shape
- **Video** — more testing, better progress reporting
- **English UI** — currently German; a language file would be the way

The code is deliberately plain: no build step, no framework, no dependencies.
Each module does one thing. `server.mjs` only routes, all logic lives in
`lib/`. Please keep it that way.

Comments explain *why*, not *what* — especially where something is a
workaround for a real quirk that cost hours to find. There are a few of those
and they are worth reading before touching the rendering code.

---

## License

MIT — see [LICENSE](LICENSE).

---

## Folder layout

```
kynto-studio/
├── server.mjs                 HTTP server, routing only
├── studio.mjs                 command line
├── start.ps1                  starts the server
├── studio.config.json         your paths (git-ignored)
├── .env                       your API key (git-ignored)
├── lib/                       one module per job
│   ├── konfig.mjs             paths, port, keys
│   ├── anbieter-*.mjs         providers (image, video)
│   ├── modelle-*.mjs          model catalogs, self-refreshing
│   └── ...
├── skripte/                   PowerShell helpers
│   ├── resize.ps1             crop and scale
│   └── text.ps1               render text onto an image
├── web/                       the interface, no build step
└── daten/                     runtime data, git-ignored
    ├── verlauf.json           activity log with full prompts
    ├── verbrauch.json         spending and measured model prices
    └── stil-block.txt         your style block, plain text
```

`daten/` is created on first start. Delete it and the app starts fresh —
your images are never touched, they live under `wurzel`.

### The style block

`daten/stil-block.txt` is a plain text file, appended to every prompt.
Edit it in the app or in any text editor — it is re-read on every single
prompt, so changes take effect immediately without restarting anything.
Emptying it in the app restores the default rather than deleting the file.
