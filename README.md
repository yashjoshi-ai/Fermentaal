# FermenTaal — 3D Interactive Brand Site

A self-contained, zero-build website for **FermenTaal** pineapple kombucha. The hero is a real
WebGL 3D glass bottle (built procedurally in [three.js](https://threejs.org/)) you can spin, with
amber liquid, a gold cap, a wraparound label and rising bubbles. Below it: the founder's story, a
"what's inside" section, a photo gallery, and an order flow via **WhatsApp / Instagram**.

## The Apple-style interactive experience (desktop)
On laptops/desktops the page is choreographed like an Apple product page — scrolling
*drives* the story:

1. **Hero** — the brandmark rises in on load, then scrubs away as you scroll; a frosted
   glass nav (brand + section links + Order pill) slides in once you leave the hero.
2. **"Take a closer look"** — the section **pins** over a long scroll runway and your
   scroll conducts a guided bottle tour: the bottle zooms up close, then stays **centred**
   (only a slight nudge and lean as each card lands) while the three frosted-glass story
   cards **accumulate** — every card stays on screen, so the section ends with all three
   framing the bottle.
3. **Story** — the bottle floats into the text column, then hands the page over.
4. **Statement** — a big line of copy fills in **word by word** as it crosses the viewport.
5. **What's inside** — the dark panel scales in; stat counters (100 / 0 / 1) tick up.
6. **Gallery** — a horizontal filmstrip **pinned and scrubbed by vertical scroll**.

Everything honors `prefers-reduced-motion` (the page becomes a calm, static, fully readable
document) and degrades gracefully without WebGL or JavaScript. The choreography lives in
`app.js` (`initHeroMotion`, `initShowcase`, `initStatement`, `initCounters`, `initPanels`,
`initGallery`) — poses, timings and copy are all plainly editable there and in `index.html`.

## The simple, order-first experience (phones)
On phones and small tablets (**≤ 900px**) the site deliberately switches to a **plain,
static layout — no animations, no 3D, no pinned scrolling**. It loads fast and puts
ordering first: the nav (brand + Order pill) is always visible, the hero shows the real
bottle photo with full-width CTAs, the story cards / stats / steps are all statically
readable, and a **sticky bottom bar keeps "Order on WhatsApp" one tap away** on every
screen. The switch is the `SIMPLE` flag in `app.js` (a `max-width: 900px` match) plus the
phone media query in `styles.css` — the desktop experience is completely unaffected.

Ongoing change requests are tracked in [`TASKS.md`](TASKS.md).

## Update the live site (workers.dev)
The live deployment is served from the contents of **`fermentaal-site-deploy.zip`**. After
editing any file, rebuild the zip from the project root and re-upload it:

```
zip -r fermentaal-site-deploy.zip index.html styles.css app.js README.md libs assets
```

## Run it
No installs, no build step, works offline.

- **Just open `index.html`** by double-clicking it. The 3D scene, fonts (when online) and all
  sections load from the bundled `libs/` folder.

> Everything is plain HTML/CSS/JS with vendored libraries in `libs/`, so it runs straight from the
> file system. (Fonts load from Google Fonts when online and fall back to Georgia/system fonts
> offline — the rest is fully offline-capable.)

## Edit your details
All the things you'll want to change live in **one place** — the `CONFIG` block at the top of
[`app.js`](app.js):

```js
const CONFIG = {
  whatsappNumber: "919410795450",   // country code + number, digits only
  whatsappMessage: "Hi FermenTaal! ...",
  instagramHandle: "fermentaal",    // ← replace with your real handle (no @)
};
```

- **WhatsApp** and **Instagram** order buttons are also hard-coded in `index.html` so they work even
  if JavaScript is disabled — update them there too if you change the handle/number.
- **Founder's story** and all section copy: edit directly in `index.html` (the `#story` section).

## Photos
The gallery now uses your real product photos, web-optimised in `assets/`:
`lifestyle-pineapple.jpg`, `lifestyle-ice.jpg`, `lifestyle-orchard.jpg`, `lifestyle-table.jpg`, and
`logo.jpg` (the brand tile). To swap any of them, replace the file (keep the name) or update the
`<img src="...">` paths in the gallery section of `index.html`. JPG/PNG/WebP all work.

## Hero bottle: real photo (current) vs 3D
The hero currently shows your **real studio bottle** as a background-removed cut-out
(`assets/bottle-cutout.png`) floating on the cream page, with a gentle sway + mouse parallax. To
switch to the **procedural, orbitable 3D glass bottle** instead (drag to spin, glass refraction,
gold cap, rising bubbles), set `heroBottle: "procedural"` in the `CONFIG` block of `app.js`.

> The cut-out was made from `assets/bottle.jpg`. `bottleCutout: true` tells the hero the image already
> has a transparent background (so it composites straight onto the cream); `bottleCrop` frames the
> bottle within the image. To regenerate the cut-out from a new studio shot, replace `bottle.jpg` and
> re-run the local cut-out step, or drop in your own transparent PNG as `bottle-cutout.png`.

> Want the 3D bottle label to use a scan of your real label? Save a flat (un-curved) image of the
> label and swap the procedural drawing in `makeLabelTexture()` (in `app.js`) for
> `new THREE.TextureLoader().load('assets/label.jpg')`.

## Deploy it live (free)
This is a static site (no build step), so any static host works.

### Option A — Netlify Drop (fastest, ~30 seconds, no account needed to preview)
1. Go to **https://app.netlify.com/drop**
2. Drag **`fermentaal-site-deploy.zip`** (created next to this folder, in `C:\Users\ACER\`) onto the page —
   or drag the whole `fermentaal-site` folder.
3. You get a live URL instantly (e.g. `random-name.netlify.app`). Sign in (free) to keep it, rename it,
   or connect your own domain.
4. To update later: re-drag the new zip/folder, or connect the GitHub repo (below) for auto-deploys.

### Option B — GitHub Pages (free, versioned, auto-updates on push)
This folder is already a git repo with a commit. Then:
1. Create a new empty repo on GitHub (e.g. `fermentaal-site`).
2. In this folder run:
   ```
   git remote add origin https://github.com/<you>/fermentaal-site.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, pick
   `main` / `/ (root)`, Save. Your site goes live at `https://<you>.github.io/fermentaal-site/`.
4. Every `git push` updates the live site.

> **Vercel/Cloudflare Pages** also work: "Import Git repository", framework preset **Other**, no build
> command, output dir = project root.

## Tech
- three.js r137 (WebGL) — procedural bottle, glass transmission, PMREM environment
- GSAP + ScrollTrigger — scroll-choreographed reveals & bottle staging
- Lenis — smooth inertia scrolling (degrades to native scroll)
- No framework, no bundler. Honors `prefers-reduced-motion` and falls back gracefully without WebGL.

## File map
```
index.html      markup + sections + order links
styles.css      visual system (cream/charcoal/amber, layout, responsive)
app.js          3D scene + scroll choreography + CONFIG  ← edit here
libs/           vendored three.js, OrbitControls, RoomEnvironment, gsap, ScrollTrigger, lenis
assets/         gallery placeholder images (swap with your own)
```
