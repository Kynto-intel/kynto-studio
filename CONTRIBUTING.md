# Contributing

Issues and pull requests are welcome. This file is short on purpose — there
are only a few rules, and they are all about keeping the thing simple.

---

## The four rules

**1. No dependencies.** There is no `package.json` and there should not be
one. Everything runs on what Node 20 ships with — `fetch`, `FormData`,
`node:fs`, `node:http`. If a task seems to need a library, it is worth asking
whether the task is right.

**2. No build step.** The browser loads ES modules directly from `web/`.
No bundler, no transpiler, no framework. Edit a file, reload the page.

**3. `server.mjs` only routes.** It maps a path to a function and nothing
else. All logic lives in `lib/`, one module per job. If a route grows an
`if`, that `if` probably belongs in a module.

**4. Comments explain *why*, not *what*.** `// Zaehler erhoehen` above `n++`
helps nobody. What helps is the line that says *why* it must be `>=` and not
`>`, and what broke when it was `>`. There are a few of those in the codebase
and they cost hours to find. Do not delete them.

---

## Language

The UI, the code and the comments are German. Contributions in English are
welcome too — a pull request that adds a good feature will not be turned away
over language. If you write German comments, please use `ue`/`oe`/`ae`/`ss`
instead of umlauts; the codebase is consistent about it.

---

## Before you open a pull request

- **`node --check` on every file you touched.** There is no test suite to
  catch a typo for you.
- **Try it on Windows.** Image scaling and text rendering shell out to
  PowerShell, so a change near `lib/format.mjs`, `lib/text.mjs` or
  `lib/schriften.mjs` cannot be verified anywhere else yet.
- **Watch what your change costs.** Generating an image costs real money and
  a clip costs roughly twenty times as much. Most changes can be verified
  without generating anything — the library, the templates, the text editor
  and the whole interface work on files that already exist. If a change
  genuinely cannot be checked without a paid run, say so in the pull request
  instead of quietly not testing it.
- **Never add a second path to generating.** Everything that spends money
  goes through `POST /api/erzeugen` and `POST /api/animieren`, and the brake
  sits in `lib/auftrag-*.mjs`, not in the route. The assistant's paid tools
  deliberately have **no execute function at all**. That is the one design
  decision the project will not trade away.

---

## Good first areas

- **Linux/macOS support** — three files shell out to PowerShell for
  `System.Drawing`: `lib/format.mjs`, `lib/text.mjs`, `lib/schriften.mjs`.
  Everything else is portable. Replacing those three is a contained job and
  probably the single most useful contribution right now.
- **More providers** — provider modules are small and self-contained. See
  `lib/anbieter-openrouter-bild.mjs` for the shape: it takes a prompt and
  optional reference bytes, returns image bytes and a cost. It knows nothing
  about the filesystem.
- **Video** — the path works but has seen few successful runs. More testing
  and better progress reporting would help.
- **English UI** — currently German. A language file would be the way.

---

## How the code is laid out

`CLAUDE.md` in the repository root is the working document for the codebase:
what each module does, which decisions are settled, and a list of quirks that
cost real time to discover. It is written in German and aimed at whoever
works on the code next. Read it before touching the rendering or the pricing.

---

## Reporting a security issue

Please do not open a public issue for a vulnerability. See
[SECURITY.md](SECURITY.md).
