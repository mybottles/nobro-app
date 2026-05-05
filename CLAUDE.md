# nobro.app

A static, installable PWA workout-program tracker. No build step, no framework, no bundler — just plain HTML, CSS, JS, and JSON files served over HTTP. Open in a browser, get the next set, hit a button, repeat.

Tagline: **no thinking. just lift.**

## Layout

```
index.html              # markup shell (head + DOM)
app.css                 # all styles
app.js                  # all app logic (vanilla JS, no modules)
default-program.json    # built-in workout program (English; user-editable content)
manifest.json           # PWA manifest (lang="en")
sw.js                   # service worker (cache name + asset list)
locales/
  en.json               # canonical / fallback (UI strings only)
  tr.json               # Turkish UI strings
  ar.json bn.json es.json fr.json hi.json id.json
  pt.json ru.json zh.json
icon-*.png, icon.svg, apple-touch-icon.png
```

There is no package manager, no `node_modules`, no test runner, no bundler. Serve the directory over HTTP (any static server) and the PWA works. `index.html` references `app.css` and `app.js` directly (the `<script>` is `defer`'d).

## Dev preview

The maintainer's dev environment serves `~/sites/projects/<project>/...` at `https://projects.bulut.cms/<project>/...`, so this project's filesystem locations map to live URLs:

- Main branch (`~/sites/projects/idman/`) → `https://projects.bulut.cms/idman/`
- Any worktree (`~/sites/projects/idman/.claude/worktrees/<name>/`) → `https://projects.bulut.cms/idman/.claude/worktrees/<name>/`

Open `index.html` under that URL to exercise the actual PWA — service worker registration, locale `fetch()`s, browser language detection, the settings editor, and JSON import/export all need a real HTTP origin to work. `file://` will not.

## How the app is structured

- `index.html` — markup only (head, appbar, content area, modals).
- `app.css` — all styles (single sheet, no preprocessor).
- `app.js` — all logic: i18n runtime, today's-progress state machine, render loop, modal logic, program editor, service-worker bootstrap.
- `default-program.json` — the default workout program in import/export format. Lazy-loaded via `fetch()` only when needed (no saved program in `localStorage`, OR user clicks "Reset to default", OR settings opens for the first time without saved data).

State splits into two concerns, each in its own `localStorage` slot:

- **Today's progress** (`idman_state_v1`): which exercise/set you're on, completed sets, start/finish timestamps. Scoped to the calendar day; a new day resets progress.
- **The program itself** (`nobro_program_v1`): the user's customized workout. Absent until the user edits/imports a program — until then `PROGRAM` is loaded from `default-program.json` on demand.

## The workout program is the dynamic content

This is the core idea: **the program is content the user owns and edits, not localized UI**. It lives in `default-program.json` (English) in the same import/export format the editor produces. The shape per entry is flat:

```js
{ region: "Chest", name: "Flat DB Press", description: "...", set: 4, reps: "10", rest: 90 }
```

`reps` is a string so it can hold "Max", "60s", "30s", or a numeric count; `set` and `rest` are numbers.

**Do not translate program content into the locale files.** The original is English, period. If a user wants Turkish exercise names, they edit them in Settings — and that becomes their personal program, stored in `localStorage`.

### Editing — Settings modal

The Settings modal *is* the program editor. Day pills (Mon–Sun) switch which day's array you're editing. Each exercise renders as a card with editable region/name/description/sets/reps/rest, plus ↑ ↓ × buttons. There's an `+ Add exercise` button per day. Save persists the draft to `nobro_program_v1`; Cancel discards the in-memory draft. The editor footer offers **Export JSON**, **Import JSON**, and **Reset to default**.

### Import/export format

```json
{
  "version": 1,
  "days": {
    "1": [ { "region": "...", "name": "...", "description": "...", "set": 4, "reps": "10", "rest": 90 } ],
    "2": [...], "3": [...], "4": [...], "5": [...], "6": [...],
    "7": []
  }
}
```

`isValidProgramDays()` enforces the shape on import (and on read from `localStorage`). Invalid stored data falls back to the default; invalid imports show a localized error.

## i18n (UI strings only)

- **Fallback locale: `en`.** The app must be fully usable in English; English is the source of truth for UI keys.
- Supported locales: `en, tr, zh, hi, es, fr, ar, bn, ru, pt, id` (English fallback + the 10 most spoken languages worldwide; Turkish kept because the project's original strings were Turkish).
- Detection: stored choice (`localStorage` → `nobro_locale`) → `navigator.languages` → first match in supported list → fallback `en`.
- Each locale is a JSON file at `locales/{code}.json` with the same shape: `meta` (name + `dir`), `ui` (UI strings, `{var}` interpolation), `duration` (h/m/s format strings), `days_short` (8-element array, index 0 unused). **No `regions` or `exercises` blocks** — that content is not localized.
- RTL: only `ar` declares `dir: "rtl"`; `<html dir>` is set from the loaded locale's `meta.dir`.
- Static markup uses `data-i18n="key"` and `data-i18n-aria-label="key"`. JS-rendered content goes through `t(key, vars)`; keys missing in the active locale fall back to `en`, then to the literal key.

### Adding or changing translations

1. **Adding a UI string:** add the key to `locales/en.json` first, then to every other locale. If you skip a locale, the runtime falls back to `en` for that key — acceptable for a temporary gap, not for shipping.
2. **Adding a new locale:**
   - Drop `locales/{code}.json` matching the shape of `en.json`.
   - Append the code to `SUPPORTED_LOCALES` in `app.js`.
   - Bump `CACHE` in `sw.js` so existing installs refetch the locale list.

## Service worker

Versioned cache name (`nobro-vN`). On `activate`, old caches are deleted. The pre-cache list (`ASSETS`) includes the shell (`index.html`, `app.css`, `app.js`, `default-program.json`, manifest, icons) + `locales/en.json`; other locales are cached lazily on first fetch.

**Network-first** for content that ships without a cache bump: locale JSONs and `default-program.json`. Everything else is cache-first. If you change non-network-first assets (HTML/CSS/JS/icons) and want users to pick them up, bump `CACHE` in `sw.js`.

## Brand & UX rules

- **Brand voice stays English in every locale.** Slogan and manifesto pillars (`"no thinking. just lift."`, `"no noise. no ego. no nonsense."`) are part of the brand, not copy — do not translate them.
- **Colors:** `#0a0a0a` bg, `#4ade80` brand green (with green glow on "no" only), `#f59e0b` amber for active set timer. Grays `#d4d4d8 → #b8b8c0 → #a1a1aa` for header hierarchy. Avoid mid-grays in the appbar — sunlight readability matters and the user has flagged this.
- **Font:** system stack only. No webfonts (bundling fonts violates the minimalism pillar).
- **Motion:** `scale(0.98)` on press, ~200ms slideUp for sheets. Nothing decorative.
- **Native PWA feel is a hard requirement.** Don't regress: `safe-area-inset-*`, `viewport-fit=cover`, `touch-action: manipulation`, `user-scalable=no`, wake lock, vibrate + audio beep on rest end, all Apple `apple-mobile-web-app-*` meta tags.

## Hosting

GitHub Pages from `main` branch root. **`git push` is the deploy.** Build takes ~30s.

- Repo: https://github.com/mybottles/nobro-app (public)
- Canonical URL: https://nobro.app/ (referenced by `<link rel="canonical">`, `og:url`, `twitter:url`, OG image, and the in-app Share button)
- GitHub Pages origin: https://mybottles.github.io/nobro-app/

## Regenerating icons

When `icon.svg` changes, regenerate PNGs (no other tool needed on macOS — `qlmanage` + `sips` ship with the OS):

```bash
qlmanage -t -s 1024 -o . icon.svg && mv icon.svg.png icon-1024.png
sips -z 512 512 icon-1024.png --out icon-512.png
sips -z 192 192 icon-1024.png --out icon-192.png
sips -z 180 180 icon-1024.png --out apple-touch-icon.png
rm icon-1024.png
```

After updating any cached asset, bump `CACHE` in [sw.js](sw.js) so installed clients invalidate the old shell on next launch.

## Conventions

- No build step: HTML/CSS/JS are loaded directly by the browser. Don't introduce a bundler, framework, or transpilation. If you need to split a file further, do it with another `<script>` or `<link>` — keep it static.
- Don't put UI strings in JS. Add a key to the locales and use `t()`.
- Don't add a UI string to only one locale. English first, then propagate.
- The brand strings ("nobro", "no thinking. just lift.", "no noise. no ego. no nonsense.") are intentionally left in English across all locales — they are part of the brand, not copy.
- The workout program is content, not UI: keep `default-program.json` in English. Don't translate `region`, `name`, or `description` into the locale files; let the user edit them in Settings.

## Keep this file in sync

**When you make a structural change, update this file in the same change.** Structural means:

- Adding/removing files or top-level directories
- Adding/removing a supported locale
- Changing the locale JSON shape (new top-level section, renamed key family)
- Changing where state is stored, the storage keys, or the day-reset semantics
- Changing the program data shape, the import/export format, the location/loader of `default-program.json`, or `isValidProgramDays`'s contract
- Changing the service-worker caching strategy or cache name scheme
- Adding a build step, package manager, or framework

Pure content edits (translation tweaks, default-program tweaks, copy fixes) do **not** require a CLAUDE.md update. The test: would a fresh contributor reading this file get a wrong picture of the project after your change? If yes, update it.
