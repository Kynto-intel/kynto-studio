<!--
Thanks for taking the time. The list below is short because the project only
has a few rules - see CONTRIBUTING.md. Delete anything that does not apply.
-->

## What this changes

<!-- One or two sentences. What was wrong or missing, and what does it do now? -->

## Why this way

<!--
The interesting part. If you picked one approach over another, say what the
other one was and why it lost. This is the same standard the comments in the
codebase are held to.
-->

---

## Checklist

- [ ] `node --check` passes on every file I touched
- [ ] **No new dependency.** There is still no `package.json`
- [ ] **No build step.** The browser still loads the modules directly
- [ ] Logic went into `lib/`, not into `server.mjs` — that file only routes
- [ ] Comments explain *why*, not *what*
- [ ] German comments use `ue`/`oe`/`ae`/`ss`, not umlauts

## How I tested it

<!--
Be specific: what did you actually run, and what did you see?

Note what you could NOT test. Generating an image costs real money and a clip
costs roughly twenty times as much, so "I did not verify this because it
needs a paid run" is an honest and acceptable answer. Silently not testing is
not.

If you changed lib/format.mjs, lib/text.mjs or lib/schriften.mjs: those shell
out to PowerShell, so they can only be verified on Windows.
-->

- [ ] Tested on Windows
- [ ] This change needs no paid run to verify — or I said below what I could not check
