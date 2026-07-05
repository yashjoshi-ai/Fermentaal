# Website Task Board

How to use this:
1. When you have a screenshot + change request, add a new task below using the template.
2. Save the screenshot into a `screenshots/` folder next to this file, named `TASK-<id>.png` (or .jpg).
3. Point Claude Code at this file + the `screenshots/` folder — it can read both directly.
4. Update the **Status** field as work progresses (`Open` → `In Progress` → `Done`).
5. Keep completed tasks in the "Done" section below (don't delete) so there's a change log.

---

## Legend
- **Priority:** P0 (blocker) · P1 (high) · P2 (normal) · P3 (nice-to-have)
- **Status:** Open · In Progress · Blocked · Done

---

## Open Tasks

<!-- Add new tasks above this line using the same format. Increment the TASK number. -->

## Self-Serve Guide: Adjusting Scroll Animation Speed (TASK-002-style fixes)

This site's "pinned scroll" sections are almost always built one of these ways. Open the component file for the section (likely something like `Bottle.jsx`, `ScrollSection.jsx`, or similar) and look for:

1. **GSAP ScrollTrigger** (most common for this kind of pin-and-reveal effect)
   - Look for `ScrollTrigger.create({...})` or `gsap.timeline({ scrollTrigger: {...} })`
   - Key property: `end: "+=3000"` (or similar) — this is the total scroll distance the animation is mapped to, in pixels. **Increasing this number slows the animation down** (more scrolling required per visual change). Try bumping it up 50–100% and test.
   - Also check `scrub: true` or `scrub: 1` — a higher scrub number (e.g. `scrub: 2`) adds a slight catch-up delay, which can also feel "slower" and smoother.

2. **Framer Motion `useScroll` / `useTransform`**
   - Look for `useScroll({ target: ref, offset: [...] })` and `useTransform(scrollYProgress, [0, 0.2, 0.4, ...], [...])`
   - The numbers in the first array (`[0, 0.2, 0.4, 0.6, 0.8, 1]`) are progress checkpoints (0 = section start, 1 = section end). Spreading these out more, or making the pinned wrapper `<div>` taller (e.g. `height: 400vh` → `600vh`), gives more scroll distance per state = slower feel.

3. **CSS `scroll-timeline` / `animation-timeline` (newer, less likely but possible)**
   - Look for `animation-timeline: --section-timeline` and a `view-timeline` or `scroll-timeline` rule. The fix here is usually making the source element taller so the timeline covers more scroll distance.

**General rule of thumb:** the fix is almost always "make the pinned/tracked container taller" or "increase the scroll-distance number" — the animation itself doesn't need to change, just how much scrolling it's stretched across. Change one number, save, scroll through it, adjust again. It's a quick trial-and-error loop.

> Note for this site: the section lives in `app.js` → `initShowcase()`. The scroll distance is
> `end: "+=520%"` and the catch-up delay is `scrub: 1` in the timeline's `scrollTrigger` config.

---

## Done

### TASK-002 — Done 2026-07-05
- **Page/Section:** Home — "The bottle" scroll section (pinned bottle + numbered story cards)
- **Screenshot:** screenshots/TASK-002-01.png, screenshots/TASK-002-02.png
- **Issue:** The scroll-driven animation plays too fast. Scrolling a normal amount blows past the content before it can be read.
- **Requested Change:** Slow down the scroll animation so each card/state has more scroll distance (or more scrub delay) behind it — enough time to actually read the text before it moves to the next state.
- **Priority:** P1
- **Status:** Done
- **Notes:** `initShowcase()` in `app.js`: scroll runway increased `end: "+=320%"` → `"+=520%"`, scrub `0.6` → `1`, and card entrances spaced further apart on the timeline. Combined with TASK-003 (cards no longer disappear), every card now stays readable for the rest of the section.

### TASK-003 — Done 2026-07-05
- **Page/Section:** Home — "The bottle" scroll section (pointer cards 01 "Alive in every sip", 02 "Real pineapple, pressed", 03 "Brewed slow, by hand")
- **Screenshot:** screenshots/TASK-003-01.png, screenshots/TASK-003-02.png, screenshots/TASK-003-03.png
- **Issue:** Right now the bottle drifts around (shifts left/right/off-position) and each numbered card fully replaces the previous one as you scroll — so only one card is ever visible, and by the time card 03 appears, cards 01 and 02 are gone.
- **Requested Change:**
  1. Keep the bottle visually centered throughout the whole scroll section — only a very slight left/right nudge as each new card appears, not a big position jump.
  2. Make cards 01, 02, 03 accumulate instead of replace each other — once a card appears it should stay on screen, so by the end of the section all three are visible together.
- **Priority:** P1
- **Status:** Done
- **Notes:** `initShowcase()` in `app.js`: bottle drift reduced from ±1.25 world units to a ±0.3 nudge (lean halved too), and the card fade-out tweens removed — cards 01 (right), 02 (left) and 03 (bottom) accumulate, ending with all three framing the centred bottle.

### TASK-004 — Done 2026-07-05
- **Page/Section:** Whole site — phone/small-tablet layout (≤ 900px)
- **Screenshot:** —
- **Issue:** Phones ran the same heavy scroll choreography as desktop; ordering required scrolling to the bottom.
- **Requested Change:** Simple static layout on phones — no animations or effects; neat design emphasizing ease of placing an order and brand awareness. Desktop layout unchanged.
- **Priority:** P1
- **Status:** Done
- **Notes:** New `SIMPLE` flag in `app.js` skips three.js/GSAP/Lenis entirely on ≤ 900px; phone media query in `styles.css` delivers the static layout: always-visible nav (brand + Order pill), hero with real bottle photo + full-width CTAs, static story cards/stats/steps, and a sticky bottom "Order on WhatsApp" bar (+ Instagram) that keeps ordering one tap away. Desktop untouched.
