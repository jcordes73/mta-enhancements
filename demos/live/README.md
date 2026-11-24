# Live console demo animations

Animated guided tour of the **live application** — the React console
(`deliverables/ui-react`) reading the Quarkus hub backend through Keycloak
auth, generated against the running application. This is the live-API sibling
of `../mock/` (same tour, same caption overlays, same click
markers — but every frame is a real authenticated render of the running app,
not a file:// mock).

| File | Format | Length | Size |
|---|---|---|---|
| `mta-live-tour.webm` | VP9 video, 1280×720 | ~55 s | ~2 MB |
| `mta-live-tour.gif`  | GIF, 1280×720, looped | ~55 s | ~2 MB |

## Tour (Northwind Financial org, English, light scheme — one persona at a time)

Personas sign in for real (checked-in realm `mta`, password `demo` — usernames
are the users' email addresses):
`m.keller@northwind-financial.com` (architect) →
`j.cordes@northwind-financial.com` (migrator, team-locked to Claims) →
`p.schmidt@northwind-financial.com` (project mgr, read-only) →
`k.vogel@northwind-financial.com` (program mgr, org-wide).

**Architect** — *"Where is the portfolio hurting?"*
1. **Home** — persona landing, effort rollup + combined risk KPIs (slow scroll)
2. **Applications** — inventory table
3. **Migration waves** — wave execution, gantt + gate status

**Migrator** (team-locked to Claims) — *"What is assigned to me?"*

4. **Home** — my work, no portfolio noise, no Administration entries
5. **Incidents** — triage queue (slow scroll)
6. **Triage modal** — first queue row's triage view (click marker on the Triage button)

**Project manager** (read-only, team-locked) — *"Are the waves on track?"*

7. **Home** — wave timeline and at-risk count
8. **Migration waves** — planned vs actual, gate states
9. **Reports** — effort & progress rollups

**Program manager** (org-wide) — *"Are the teams' waves coordinated?"*

10. **Home** — cross-team coordination landing
11. **Migration waves** — cross-team composition card
12. **Task manager** — shared platform work, queue health

13. Outro card (run it yourself)

## How it works

The console must be **running** (the vite dev server from
`deliverables/ui-react` — `npm run dev` — or any deployment): console
`:5173`, Keycloak `:8180`, hub `:8080`. Then:

1. **`capture.mjs`** (puppeteer-core, installed locally into `demos/node_modules`)
   signs each demo persona in through the real Keycloak login (username-first,
   password `demo`), pre-seeds `mta.welcome.<persona>` so the first-run welcome
   modal doesn't cover the scenes, navigates the SPA by hash (no page reloads —
   the session token stays alive), scrolls `.pf-v6-c-page__main` per frame, and
   drops the mock demo's brand-blue click marker (ring + dot, occlusion-checked) plus
   a Clippy speech bubble (paperclip avatar + blue tail pointing at the click) carrying
   the scene's
   short explanation of the click — the full prose stays in the caption bar.
   Triage-modal frames click the first
   queue row's real Triage button. Frames are captured at 1920×1080.
2. **`assemble.py`** burns the caption overlays and title/outro cards
   (brand fonts), then assembles with per-frame durations (motion steps
   320 ms, screen holds 2.8 s) into a looped GIF and a VP9 WebM, both
   downscaled to 1280×720.

No video editing, no mocks — if the API is down the frames would show the
app's error state. Regenerate:

```bash
DEMO_BASE=http://<console-host>:5173 node demos/live/capture.mjs
python3 demos/live/assemble.py
```

Edit the `SCENES` array in `capture.mjs` (hash, click selector, scroll steps)
or the `TOUR` captions in `assemble.py` to change the tour. Any deep-link
state works: `#scr=…&lang=ar&scheme=dark`, any persona's screens, etc.
