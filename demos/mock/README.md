# Demo animations

Animated guided tour of the console mock, generated from `deliverables/ui-mockup/index.html`
(regenerable via `make-demo.sh`; requires headless Chrome, Python + Pillow, ffmpeg):

| File | Format | Length | Size |
|---|---|---|---|
| `mta-mock-tour.webm` | VP9 video, 1280×720 | ~64 s | ~2.3 MB |
| `mta-mock-tour.gif`  | GIF, 1280×720, looped | ~61 s | ~1.9 MB |
| `mta-mock-tour-nl.webm` | VP9 video, 1280×720 (Dutch UI) | ~64 s | |
| `mta-mock-tour-nl.gif`  | GIF, 1280×720, looped (Dutch UI) | ~61 s | |
| `mta-mock-tour-es.webm` | VP9 video, 1280×720 (Spanish UI) | ~64 s | |
| `mta-mock-tour-es.gif`  | GIF, 1280×720, looped (Spanish UI) | ~61 s | |

## Tour (Northwind Financial org, English, light scheme — one persona at a time)

The Dutch tour (`mta-mock-tour-nl.*`) follows the same 13 scenes with the UI,
captions, and bubbles in Dutch (`&lang=nl` on every deep link).

The Spanish tour (`mta-mock-tour-es.*`, row 248) follows the same 13 scenes with
the UI, captions, and bubbles in Spanish (`&lang=es` on every deep link; persona
badges use the mock's es terms *Migrador* / *Director de proyectos* /
*Director de programa*).

**General** — *"A short introduction"*

0. **Home** - Introducing Miggy, the virtual migration assistant

**Architect** — *"Where is the portfolio hurting?"*
1. **Home** — persona landing, effort rollup + combined risk KPIs (slow scroll)
2. **Applications** — inventory table
3. **Migration waves** — wave execution, gantt + gate status

**Migrator** (team-locked to Claims) — *"What is assigned to me?"*

4. **Home** — my work, no portfolio noise, no Administration entries (marker on the persona switcher)
5. **Incidents** — triage queue (slow scroll)
6. **Triage modal** — `WebLogic JNDI lookup` triage view (`&drawer=incident`)

**Project manager** (read-only, team-locked) — *"Are the waves on track?"*

7. **Home** — wave timeline and at-risk count (marker on the persona switcher)
8. **Migration waves** — planned vs actual, gate states
9. **Reports** — effort & progress rollups

**Program manager** (org-wide) — *"Are the teams' waves coordinated?"*

10. **Home** — cross-team coordination landing (marker on the persona switcher)
11. **Migration waves** — cross-team composition card
12. **Task manager** — shared platform work, queue health

13. Outro card (deep-link patterns)

## How it works

Every frame is a real render of the mock: headless Chrome loads the mock with a
deep-link hash (`#scr=…&persona=…&drawer=…`); a tiny injected driver script reads
an `fx=<px>` hash parameter and scrolls the main pane, so each scene animates as
a genuine scroll of the live DOM (no video editing, no fakes). Frames are captured
at 1920×1080, downscaled to 1280×720, and assembled with per-frame durations
(motion steps 320 ms, screen holds 2.8 s — paced so the caption overlays can be
read).

**Click markers + speech bubbles:** scenes that represent a navigation or row
click carry a `click=<selector>` hash parameter; the driver locates the real
element (a nav item, or the persona switcher / incident row that opens the
triage modal), verifies it is visible and not occluded, and draws a brand-blue
marker (ring + dot) on it. A `bubble=<url-encoded text>` parameter rides along
on the same frame: a white speech bubble with a blue tail anchored next to the
marker — Clippy (a paperclip with eyes) sits inside as the avatar — carrying
the short explanation of the click (the long prose stays in
the caption bar). Both appear on the scene's final motion frame and hold — the
moment the "click" happens. Scenes without a click (title/outro, the boot Home,
and the modal that *is* the click's result) carry none.

Regenerate: `demos/mock/make-demo.sh` (English, default), `demos/mock/make-demo.sh nl`
for the Dutch tour (row 211 — same scenes, every scene boots the mock with `&lang=nl`,
writes `mta-mock-tour-nl.{gif,webm}`), or `demos/mock/make-demo.sh es` for the Spanish
tour (row 248 — `&lang=es`, writes `mta-mock-tour-es.{gif,webm}`). Edit the `scenes`
array there to change the tour (any deep-link state works: `&lang=ar`,
`&scheme=dark`, `&persona=padmin`, `&anno=1`, …; the third field is the optional
click-selector marker, URL-encoded; the fourth the bubble text).
