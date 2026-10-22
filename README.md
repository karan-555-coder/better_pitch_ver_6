# BetterPitch website — version 6 (Graphite & Copper) — the final version

The BetterPitch marketing site (AI voice agents that call, qualify and follow
up), built on a working local copy of https://www.artisan.co. The original
site was recorded in Chrome and is replayed with its original URLs, so the
Next.js JavaScript, animations, menus and images all work. BetterPitch copy,
the voice-demo hero, a graphite & copper colour theme and extra motion are layered
on top without editing the recorded files.

Each version is a colour variant of the same site in its own repo:
- version 1 (orange/amber): https://github.com/karan-555-coder/better-pitch-version_1
- version 2 (rose/crimson): https://github.com/karan-555-coder/better_pitch_version_2
- version 3 (black & gold): https://github.com/karan-555-coder/better_pitch_version_3
- version 4 (midnight navy & silver): https://github.com/karan-555-coder/better_pitch_ver_4
- version 5 (charcoal & electric lime): https://github.com/karan-555-coder/better_pitch_ver_5

## Run

    npm install      # first time only
    npm start        # -> http://localhost:4000

After changing `server.js`, stop the server (Ctrl + C) and run `npm start`
again. Changes to files in `betterpitch/` only need a page refresh
(Ctrl + Shift + R).

## What's on top of the recording

| Layer | Where | What it does |
|---|---|---|
| Copy | `betterpitch/content.js` | Swaps the recorded text for BetterPitch copy after React hydrates |
| Hero | `betterpitch/hero.js`, `hero.css` | Adds the voice-demo hero as the first section of the home page |
| Colours | `recolor()` in `server.js` | Moves every purple/violet/magenta colour (hue 240-335) in CSS, HTML, JS, SVG and RSC data to graphite and copper: vivid mid shades become copper, dark and muted ones a cool graphite grey, light ones a warm cream (mixed in RGB, alpha kept); ivory backgrounds become a soft warm grey-white, and the amber/pink stops of the heading gradient become light and deep copper |
| Images | `recolor-images.js` -> `archive/recolored/` | Same purple-to-graphite/copper mapping on the pixels of the WebP/PNG/JPEG images; `server.js` serves the recoloured copy when one exists |
| Motion | `betterpitch/theme.css`, `theme.js`, `hero.css` | Hero with slow copper light rays turning from above and a copper glow breathing at its foot; brushed metal on dark sections; headings rising from behind a ledge; images opening like venetian blinds; brushed-copper buttons on hover; gradient edges on the big white panels |
| GSAP motion | `betterpitch/motion.js` (GSAP + ScrollTrigger from `node_modules`) | Paragraphs fill with ink from top to bottom as they are scrolled through; sections sink back (scale and fade) as they scroll away, like cards going under a deck |
| Interactions | `betterpitch/interact.js` | The copper sheen on a hovered button turns with the cursor like light on brushed metal, clicks throw copper sparks that arc down under gravity, internal links wipe a graphite-and-copper panel across the screen before the next page opens |

Colour replacements in HTML and RSC payloads keep the exact byte length:
Next.js embeds length-prefixed RSC rows, and a mismatch breaks hydration.
All motion respects `prefers-reduced-motion`. Looping animations only touch
`opacity`, `transform`, `translate`, `rotate` or `scale` (no animated blur,
background position or gradient angle), the hero pauses while off screen, and
the sparks canvas only runs while sparks are in the air.

## Commands

| Command | What it does |
|---|---|
| `npm start` | Serves the site at http://localhost:4000 (`PORT=5000 npm start` to change port) |
| `npm run capture` | Re-records every page in `pages.txt` from the live site (needs internet) |
| `npm run capture -- /pricing /about` | Re-records only specific pages |
| `npm run verify` | Opens every page from the local copy, lists missing files/JS errors, saves screenshots to `screenshots/` |
| `npm run compare` | Screenshots live site vs local copy at 1440 / 768 / 375px and reports % of pixels that differ (`comparisons/`) |
| `npm run fetch-missing` | Downloads files `verify` reported missing (reads `verify-report.txt`) into the archive; or pass paths: `node fetch-missing.js "/_next/image?url=..."` |
| `npm run recolor-images` | Recolours purple in the archived images to the theme colour (writes `archive/recolored/`) |

After a capture or fetch, run `npm run recolor-images` so new images are
recoloured too, then restart `npm start`. To add a page (e.g. a blog post), add its
path to `pages.txt` and run capture.

Chrome is expected at the default install path; to use Edge (or another
Chromium) set `CHROME_PATH`, e.g. in PowerShell:
`$env:CHROME_PATH="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"`.

The site scrolls inside `#page-scroller`, not the window (`<html>`/`<body>`
are `overflow: hidden`), so the scripts scroll that element (`scroller.js`).

## Files

- `server.js` – replays `archive/` on localhost, injects the `betterpitch/` layers and recolours on the fly
- `betterpitch/` – BetterPitch copy, hero, theme and motion (`motion.js` and `interact.js` use GSAP, installed by `npm install`)
- `recolor-images.js` – recolours purple in the archived images
- `capture.js` – records the live site into `archive/` (headless Chrome)
- `verify.js` / `compare.js` – check the local copy page by page / against the live site
- `fetch-missing.js` – downloads individual missing files into the archive
- `pages.txt` – list of pages to record
- `archive/` – recorded files + `manifest.json` (URL -> file); `archive/recolored/` holds recoloured images

## Limits

- Forms (demo request, email signup) and login talk to Artisan's backend and
  won't work offline.
- The "Aaron"/Ava chat panel renders as it does live (its start-up responses
  are recorded), but sending a message or starting a call needs Artisan's live
  AI backend, which rejects any origin but artisan.co. The local server answers
  those calls with a 503 `OFFLINE_REPLICA` error instead of pretending.
- Analytics/tracking scripts are blocked on purpose: during capture, and during
  replay via a Content-Security-Policy header (`ALLOWED` in `server.js` lists
  the few third parties pages still load, e.g. the Ashby job board on /careers).
- Colours baked into photos are shifted only where they were purple; other
  hues (e.g. blue) are left as recorded.
- The recorded archive still contains Artisan's trademarks, copy and images.
  Replace the remaining branding/content with your own before using this as a
  public site.
