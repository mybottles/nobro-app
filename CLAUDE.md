# nobro.app

A static, installable PWA workout-program tracker. No build step, no framework, no bundler — just plain HTML, CSS, JS, and JSON files served over HTTP. Open in a browser, get the next set, hit a button, repeat.

Tagline: **no thinking. just lift.**

## Layout

```
index.html              # markup shell (head + DOM)
app.css                 # all styles
app.js                  # all app logic (vanilla JS, no modules)
manifest.json           # PWA manifest (lang="en")
sw.js                   # service worker (cache name + asset list)
presets/
  index.json            # lightweight catalog: id, file, name, description, coach
  default.json          # the starter program — what loads on first run
  bodyweight-3day.json  # bundled example
  dumbbell-upper-lower.json # bundled example
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

- `index.html` — markup only (head, appbar, content area, modals: About, Programs, Settings).
- `app.css` — all styles (single sheet, no preprocessor).
- `app.js` — all logic: i18n runtime, today's-progress state machine, render loop, modal logic, program editor, preset library, service-worker bootstrap.
- `presets/default.json` — the default workout program in import/export format (with metadata header). Lazy-loaded via `fetch()` only when needed (no saved program in `localStorage`, OR user clicks "Reset to default", OR settings opens for the first time without saved data).
- `presets/index.json` — catalog the Programs modal renders. Lazy-loaded only when the modal opens or when computing the default's display metadata.

State splits across four `localStorage` slots:

- **Today's progress** (`idman_state_v1`): which exercise/set you're on, completed sets, start/finish timestamps. Scoped to the calendar day; a new day resets progress. Also reset whenever the user applies a preset.
- **The program itself** (`nobro_program_v1`): the user's customized workout (just `{ version, days }`). Absent until the user edits/imports/applies a preset — until then `PROGRAM` is loaded from `presets/default.json` on demand.
- **Program metadata** (`nobro_program_meta_v1`): `{ id, name, description, coach: { name, url } }` — what the Programs modal and end-of-day summary display as the source of the current program. Set when a preset is applied or when an import file carries metadata.
- **Customized flag** (`nobro_program_customized_v1`): `'1'` once the user edits the program in Settings. Drives the "customized" tag next to the program name in the UI.

## The workout program is the dynamic content

This is the core idea: **the program is content the user owns and edits, not localized UI**. The bundled programs live in `presets/*.json` (English), in the same import/export format the editor produces. The shape per entry is flat:

```js
{ region: "Chest", name: "Flat DB Press", description: "...", set: 4, reps: "10", rest: 90 }
```

`reps` is a string so it can hold "Max", "60s", "30s", or a numeric count; `set` and `rest` are numbers.

**Do not translate program content into the locale files.** The original is English, period. If a user wants Turkish exercise names, they edit them in Settings — and that becomes their personal program, stored in `localStorage`.

### Editing — Settings modal

The Settings modal *is* the program editor. Day pills (Mon–Sun) switch which day's array you're editing. Each exercise renders as a card with editable region/name/description/sets/reps/rest, plus ↑ ↓ × buttons. There's an `+ Add exercise` button per day. Save persists the draft to `nobro_program_v1` and flips the `customized` flag; Cancel discards the in-memory draft. The editor footer offers **Export JSON**, **Import JSON**, and **Reset to default**.

### Browsing — Programs modal

A third toolbar button (between About and Settings) opens the Programs modal — a community-curated catalog. The modal lazy-loads `presets/index.json`, shows the currently-active program, then lists each preset with name + description + coach link (`rel="nofollow noopener"`). "Apply" fetches the full preset JSON, writes it to `nobro_program_v1`, copies the metadata to `nobro_program_meta_v1`, clears the customized flag, **and resets today's progress** (so the daily summary stays consistent). The end-of-day summary also surfaces the current program name + coach + a Browse button.

### Import/export format

```json
{
  "version": 1,
  "id": "optional-stable-id",
  "name": "Optional display name",
  "description": "Optional one-paragraph pitch.",
  "coach": { "name": "Optional", "url": "https://optional" },
  "days": {
    "1": [ { "region": "...", "name": "...", "description": "...", "set": 4, "reps": "10", "rest": 90 } ],
    "2": [...], "3": [...], "4": [...], "5": [...], "6": [...],
    "7": []
  }
}
```

`isValidProgramDays()` enforces the shape of `days` on import (and on read from `localStorage`). Metadata fields (`id`, `name`, `description`, `coach`) are optional everywhere; `pickPresetMeta()` extracts them defensively. Invalid stored data falls back to the default; invalid imports show a localized error.

### Adding a preset (the contributor flow)

1. Drop a `presets/<id>.json` containing `version`, `id`, `name`, `description`, `coach: { name, url }`, and `days` (full 7-day shape).
2. Append a summary entry to `presets/index.json` (same `id`, the filename, plus the same `name`/`description`/`coach` fields — they need to stay in sync because the index is what the modal renders without fetching every preset).
3. Add `./presets/<id>.json` to `ASSETS` in `sw.js` only if it should be pre-cached on install. Otherwise it's network-first like all `presets/*.json` and gets cached lazily on first fetch.
4. README has the public-facing version of this guide.

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
   - The pre-commit hook will bump `CACHE` in `sw.js` automatically so existing installs refetch the locale list.

## Service worker

Versioned cache name (`nobro-vN`). On `activate`, old caches are deleted. The pre-cache list (`ASSETS`) includes the shell (`index.html`, `app.css`, `app.js`, manifest, icons) + `locales/en.json` + `presets/index.json` + `presets/default.json`. Other locales and other presets are cached lazily on first fetch.

**Network-first** for content that ships without a cache bump: locale JSONs and any `presets/*.json`. Everything else is cache-first. The cache version bump is automated — see "Local hooks" below.

The SW is registered with `{ updateViaCache: 'none' }` so the browser bypasses HTTP cache when checking for a new `sw.js`. Without that flag, GitHub Pages' default 4-hour `Cache-Control` on JS files would let the browser serve a stale `sw.js` from disk for hours after a deploy, blocking the install of any new SW version. Don't remove the option.

## Local hooks

`.githooks/pre-commit` auto-bumps `CACHE = 'nobro-vN'` in [sw.js](sw.js) whenever a cached asset (HTML/CSS/JS/manifest/icons/locale JSON/preset JSON) is staged. This invalidates the old SW cache so installed clients pick up the new shell on the next launch.

Enable it once per clone: `git config core.hooksPath .githooks`. Without this config the hook never fires and you'd have to bump `CACHE` by hand.

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

The pre-commit hook (see "Local hooks") bumps `CACHE` in [sw.js](sw.js) automatically when icon files are staged.

## Conventions

- No build step: HTML/CSS/JS are loaded directly by the browser. Don't introduce a bundler, framework, or transpilation. If you need to split a file further, do it with another `<script>` or `<link>` — keep it static.
- Don't put UI strings in JS. Add a key to the locales and use `t()`.
- Don't add a UI string to only one locale. English first, then propagate.
- The brand strings ("nobro", "no thinking. just lift.", "no noise. no ego. no nonsense.") are intentionally left in English across all locales — they are part of the brand, not copy.
- The workout program is content, not UI: keep `presets/*.json` in English. Don't translate `region`, `name`, or `description` into the locale files; let the user edit them in Settings.
- Coach links in presets must use `rel="nofollow noopener"` — they're contributor self-promotion, not editorial endorsements. The render function (`renderCoachLine` in `app.js`) handles this; preset JSONs only need `coach: { name, url }`.
- Pure content edits — adding a new preset, tweaking a locale string, fixing copy — do not require touching `app.js`, `index.html`, or this file. The exception: a new preset needs an `index.json` entry, and a new top-level locale or storage key does need a CLAUDE.md update.

## Keep this file in sync

**When you make a structural change, update this file in the same change.** Structural means:

- Adding/removing files or top-level directories
- Adding/removing a supported locale
- Changing the locale JSON shape (new top-level section, renamed key family)
- Changing where state is stored, the storage keys, or the day-reset semantics
- Changing the program data shape, the import/export format, the location/loader of preset files, or `isValidProgramDays`'s / `pickPresetMeta`'s contract
- Changing how `presets/index.json` is structured or how presets are looked up
- Changing the service-worker caching strategy or cache name scheme
- Adding a build step, package manager, or framework

Pure content edits (adding a single preset, translation tweaks, copy fixes) do **not** require a CLAUDE.md update. The test: would a fresh contributor reading this file get a wrong picture of the project after your change? If yes, update it.
