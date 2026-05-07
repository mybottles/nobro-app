# nobro.app

[English](README.md) · [Türkçe](README.tr.md)

> **no thinking. just lift.**
> no noise. no ego. no nonsense.

A dumbbell program for people who don't want to think. Open it, do the next set, close it. That's the whole app.

**Live:** https://nobro.app

---

## What it is

A static, installable PWA workout tracker. One screen shows your next set — exercise name, set count, rep target, rest timer. Everything else lives in modals.

It's intentionally tiny: ~57 KB on the wire. No build step, no framework, no `node_modules`, no backend, no accounts, no tracking, no ads. Just HTML, CSS, and vanilla JS served as static files.

## Features

- **No signup.** No email, no "Continue with Google". Open the URL, you're in.
- **No installation.** It's a PWA — on iPhone: Share → Add to Home Screen; on Android: menu → Install. After that it behaves like a native app: own icon, full-screen, no browser chrome.
- **Works offline.** Service worker caches the shell on first load. Your gym's WiFi can die, the app won't.
- **Customizable program.** The default 6-day dumbbell split is a starting point — Settings lets you add, remove, reorder exercises, change sets/reps/rest seconds for any day.
- **Program library.** A growing catalog of community-contributed programs (Dumbbell 6-day, Bodyweight 3-day, Upper/Lower 4-day, …). Tap the menu icon, pick one, lift. Coaches who contribute get a credit + nofollow link.
- **Export / import.** Back up your program as JSON or move it to another device.
- **Rest timer.** Vibrates and beeps the moment your rest is up.
- **Wake Lock.** Screen stays on during a set.
- **Daily reset.** Today's progress is just for today; midnight gives you a clean start.
- **11 languages** auto-detected from your browser: English, Türkçe, 中文, हिन्दी, Español, Français, العربية (RTL), বাংলা, Русский, Português, Bahasa Indonesia.
- **Free forever.** Sponsored by [bulutpress](https://bulut.press) — no premium tier, no upsell, no "free trial."

## Use it

1. Visit [nobro.app](https://nobro.app) on your phone.
2. **iPhone:** Share → Add to Home Screen.
   **Android:** browser menu → Install / Add to Home Screen.
3. Open from the home-screen icon. Edit the program if you want (gear icon, top right).
4. Go to the gym, look at the screen, do the set, close.

That's it. There's no step 5.

## Run it locally

```bash
git clone https://github.com/mybottles/nobro-app
cd nobro-app
python3 -m http.server 8000
# open http://localhost:8000
```

Any static HTTP server works. There's nothing to build.

## How it's built (the constraints)

- **No build step.** `index.html` references `app.css` and `app.js` directly.
- **No framework.** Vanilla JS, ~750 lines including the i18n runtime and program editor.
- **No backend.** Static files on GitHub Pages. State lives in two `localStorage` keys (today's progress + the user's customized program).
- **No tracking.** Zero analytics, zero telemetry. One outbound request on load (the locale JSON). Open DevTools and check.
- **Service worker.** Versioned cache, cache-first shell, network-first for content (locales + default program JSON) so updates ship without a cache bump.

The full architecture is documented in [CLAUDE.md](CLAUDE.md).

## Customizing the program

The workout program is just a JSON file you can fully edit in the app's Settings sheet — or by importing your own JSON. Format:

```json
{
  "version": 1,
  "name": "My Program",
  "description": "Optional one-line pitch.",
  "coach": { "name": "Optional", "url": "https://optional" },
  "days": {
    "1": [
      { "region": "Chest", "name": "Flat DB Press", "description": "...", "set": 4, "reps": "10", "rest": 90 }
    ],
    "2": [], "3": [], "4": [], "5": [], "6": [], "7": []
  }
}
```

`reps` is a string so it can hold `"Max"`, `"60s"`, or a numeric count. The top-level metadata (`name`, `description`, `coach`) is optional everywhere — the app reads it if present, ignores it if not.

## Contributing a program

The Programs modal is community-curated. To add yours, fork the repo and open a PR with:

1. **`presets/<your-id>.json`** — your full program, with metadata (`name`, `description`, `coach: { name, url }`) and `days`. The bundled presets in [presets/](presets/) are working examples.
2. **An entry in [`presets/index.json`](presets/index.json)** — the same `id`, the file path, and the same name/description/coach (the index is the lightweight list the modal renders without fetching every preset).

Coach links use `rel="nofollow noopener"` automatically — they're contributor self-promotion, so they don't pass SEO weight, but anyone using your program will see your name and click through to your site. See [`presets/README.md`](presets/README.md) for the contributor checklist.

The bar is low: write a program you'd actually run yourself, fill in honest metadata, open a PR.

## Translating

Each locale lives at [`locales/{code}.json`](locales/) with the same shape: `meta`, `ui`, `duration`, `days_short`. English (`en`) is the canonical fallback — missing keys resolve to `en`, then to the literal key.

Want to add a language? Drop a JSON file matching `en.json`, append the code to `SUPPORTED_LOCALES` in `app.js`, bump `CACHE` in `sw.js`, open a PR.

The brand strings — `no thinking. just lift.` and `no noise. no ego. no nonsense.` — stay English in every locale. They're brand, not copy.

## Sponsor & author

- Sponsored by [bulutpress](https://bulut.press) — Turkish hosting / publishing.
- Built by [Murat Uysal](https://muratuysal.com).
- Contributions, translation fixes, bug reports welcome — open an issue or PR.

## License

[MIT](LICENSE) — fork it, ship your own version, no attribution required (but appreciated).
