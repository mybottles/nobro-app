# The nobro covenant

nobro.app is built on a small set of promises to the people who use it. This document is the public, written form of those promises — so users know what they're getting, contributors know the boundaries, and any future owner knows the terms they inherit.

The core idea: **restraint is the product.** Everything below exists to keep nobro something you open, use, and close — not something you log into, manage, or pay for.

## What nobro will always be

1. **Free forever.** No premium tier, no subscription, no one-time unlock, no "pro features."
2. **Ad-free.** No banners, native ads, sponsored content, affiliate links, or "powered by" CTAs that promote a commercial offer.
3. **Account-free.** No registration, no login, no email collection, no SSO. The app works the moment it loads.
4. **Tracking-free.** No client-side analytics, no cookies, no third-party telemetry, no fingerprinting. Server-side request counts (e.g. edge logs that count visits) are acceptable; per-user behavior tracking is not.
5. **Local-first.** All user data lives in the browser's `localStorage` on the user's device. No cloud sync that requires an account. Export and import are manual and user-initiated.
6. **Open source.** MIT-licensed, public repository. Cannot be relicensed to proprietary.
7. **Static.** No build step, no framework, no backend, no package manager. Plain HTML/CSS/JS files served over HTTP.
8. **Brand strings stay English.** "no thinking. just lift.", "no noise. no ego. no nonsense.", and "nobro" are not translated in any locale. They are brand, not copy.

## What nobro will never become

- No streaks, badges, achievements, levels, or other gamification.
- No social features: feeds, followers, sharing within the app, leaderboards, comments.
- No onboarding flows, tutorials, or "welcome" sequences.
- No push notifications for "motivation" or re-engagement.
- No paywalls, freemium tiers, or upsells.
- No user databases, server-side accounts, or cloud sync requiring login.
- No AI chatbots, "smart suggestions," or any screen that stands between the user and the next set.

## The friction test

Any proposed feature must pass a single question:

> *Does this add a step between opening the app and doing the next set?*

If yes, it does not ship — regardless of how popular the request is, how much revenue it might generate, or how "user-friendly" it sounds. Restraint is the product.

## If ownership ever transfers

If the project is ever sold, transferred, gifted, or inherited, the founder's intent is that the transfer agreement incorporate this covenant in full. Specifically:

- The new owner is bound by every clause above.
- The original founder credit (`developed by murat uysal`, linking to muratuysal.com) remains in the About modal in perpetuity as historical attribution. The new owner may add their own maintainer credit (for example, *maintained by …*) but **no commercial call-to-action, sponsor link, or upsell** alongside it.
- Material amendments to this document require the original founder's written consent for the first five years following any transfer.
- If the new owner materially violates this covenant — by the founder's judgment or by clear public evidence — the domain, the repository, and the brand revert to the original founder for $1.
- No transfer that excludes the above clauses should occur.

## How to verify it's being honored

This covenant is enforceable by anyone with a browser, not just by lawyers:

- **View source.** The shell is small; there are no third-party scripts and no tracking pixels.
- **DevTools Network tab.** A cold load fetches the shell, the active locale JSON, and `presets/index.json`. Nothing else leaves the device.
- **Git history.** Every change to this document is visible in `git log COVENANT.md`. Material softening is a red flag.
- **The license.** MIT. If nobro ever becomes anything other than what this covenant describes, the community already has the code and is free to fork.

---

Last updated: 2026-05-07.
