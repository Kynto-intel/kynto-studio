# Security

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private reporting:

**[Report a vulnerability](https://github.com/Kynto-intel/kynto-studio/security/advisories/new)**

That channel is private between you and the maintainer. This is a spare-time
project, so expect a reply in days rather than hours.

## Supported versions

The `main` branch only. There are no releases and no backports — if something
is fixed, it is fixed on `main`.

---

## What this app is, so you can judge the risk

Kynto Studio is a **single-user tool that happens to have a web interface**.
It binds to `127.0.0.1` and has **no authentication of any kind**. That is not
an oversight to report — it is the design. The consequence is the important
part:

> **Do not expose it to a network.** Anything that can reach the port can
> generate images on your account, read every file under your configured root
> folder, and rename or overwrite files in it.

If you put it behind a reverse proxy, on a VPS, or bind it to `0.0.0.0`, you
have removed the only thing protecting it.

---

## How the API key is handled

- Read on the **server** only, from the `OPENROUTER_API_KEY` environment
  variable or a `.env` file next to the app.
- **Never sent to the browser.** There is no field in the interface to type it
  into, deliberately, so it cannot end up in a page, a screenshot or a
  bug report.
- `.env` and `daten/` are git-ignored.

If you find a path where the key reaches the browser or a log file, that is a
real vulnerability — please report it.

---

## Where files may be written

Every filesystem operation goes through `pruefeInnerhalb()` in
`lib/pfade.mjs`, which resolves the path and rejects anything outside the
configured root (`wurzel` in `studio.config.json`). Symlinks and `..` are
resolved before the check.

A path that escapes that root — through the HTTP API, a template, a filename,
or the assistant — is a real vulnerability. Please report it.

---

## What is not a vulnerability

- **No authentication on the HTTP API.** By design, see above.
- **The assistant can read your library and your prompts.** That is what it
  is for. It runs on the model you choose; if you choose a hosted one, your
  prompts go to that provider. Choose a local model through Ollama if that
  matters to you.
- **Prompts and spending are stored in plain text** under `daten/`. They stay
  on your machine and are git-ignored, but they are not encrypted.
- **A run can exceed a daily limit by one job.** The check runs against what
  has already been billed, and a price is only known afterwards. It stops the
  next run, not the running one. This is documented in the README.
