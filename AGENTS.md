# AGENTS.md — MTA improvement program workspace

Docs-plus-code workspace (git: `github.com/jcordes73/mta-enhancements`, single
`main` branch, no build/CI for the docs; three
deliverables carry their own toolchains: `deliverables/ui-mockup/` (single-file HTML),
`deliverables/ui-react/` (Vite/React), `deliverables/hub-backend/` (Quarkus/Maven)). Two kinds of "code":
markdown program documents and the **large single-file HTML mock**
(`deliverables/ui-mockup/index.html`, ~1.1 MB, all CSS/JS/data inline). Verification is
jsdom + headless Chrome for the mock, Maven/CDP for the other two.

## Layout & numbering (keep consistent)

- Directory structure mirrors the pipeline: `evidence/` → `proposals/` →
  `design/` + `implementation/` (elaboration of the proposals) →
  `socialization/` (+ `socialization/presentations/`) → `upstream/`; the code
  deliverables live under `deliverables/` (`ui-mockup/`, `ui-react/`,
  `hub-backend/`). `README.md`, `CHANGELOG.md`, and this file stay at the root.
- Pipeline: evidence → proposals → design & implementation detail → socialization → upstream filing. Numbering is cross-referenced everywhere:
  - `#N` = suggestion number in `evidence/mta-improvement-suggestions.md` (only #1–#53 exist; annotation badges must not cite numbers > 53).
  - `①–⑤` = the five proposals in `proposals/` (used identically in cross-refs, scripts, decks).
  - Defect rows in `deliverables/ui-mockup/use-case-verification.md` §4 are append-only; each behavior change also gains a dated clause in the root `CHANGELOG.md` (not README).
- Design decisions that escape the mock are backfilled into `design/design.md` §19.

## Editing `deliverables/ui-mockup/index.html`

Everything is in one file. After **every** edit, parse-check all inline scripts:

```bash
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');for(const m of h.matchAll(/<script>([\s\S]*?)<\/script>/g)){try{new Function(m[1])}catch(e){console.log('SYNTAX ERROR:',e.message)}}"
```

Landmines learned the hard way:

- The file contains **literal UTF-8** (`✓`, em/en dashes, curly quotes, CJK). When patching with Python, splice literal characters — never `\uXXXX` escapes — and use `ensure_ascii=False` if using `json.dumps` to build literals.
- Generated JS with French/Italian apostrophes (`all'ondata`, `l'affectation`) must be **double-quoted** JS strings; raw-string `\"` leaks from Python heredocs have corrupted rule bodies before. The parse-check catches all of this — never skip it.
- `grep`/edit anchors: match on stable attributes (`data-screen`, `data-value`, element ids), **never on visible text** (text is i18n-translated at runtime).

## i18n machinery (in `index.html`)

- 8 locales (EN/DE/AR/ES/FR/JA/IT/TR): `I18N` dict (~line 3768, one line per language), `I18N_RULES` per-language regex arrays (~3864), `trNode` (~4459), `setLang` (~4496).
- Lookup order per text node: identifier guard → exact dict key → first matching rule → phrase pass (`i18nPhrase`: ISO dates, `$`→localized currency, then word-boundary dict substitution).
- **EN must stay byte-exact**: EN locale is identity; never break EN text when adding keys.
- **Rule order matters**: specific/whole-sentence rules must be inserted at the TOP of a language's array — the generic `⟨date-range⟩ · ⟨rest⟩` rule otherwise phrase-translates the tail (mixed partials like "gate kritisch").
- Phrase-pass word boundary is Unicode (`\p{L}`, `u` flag) **plus compound-token punctuation (row 99)**: substitution is blocked when the char immediately before/after the match is `-`, `_`, `/` or `@`, so dict words never substitute inside identifiers (`orm-runtime` → `orm-وقت التشغيل` was a real defect); `.` and `:` remain boundaries so sentence-final words still translate. Adding a short dict word ("of", "done", "green") makes it substitute inside every untranslated sentence — prefer exact-node or whole-sentence rules for prose.
- **Identifier guard (row 99)**: `trNode` returns null for identifier-shaped tokens — single token (no whitespace), contains `[-_.:/@+]`, at least one letter, `^[A-Za-z0-9][A-Za-z0-9_.:/@+#-]*$`. Digits-only tokens (glued ISO date strings) must NOT be guarded or the phrase-pass ISO conversion breaks. No dict key may be an identifier.
- **Attribute translation (row 99)**: descriptive `aria-label`/`title` translate via `i18nWalkAttrs()` (called from `i18nWalk`) using `i18nA()` = exact dict + regex rules only, **never the phrase pass** (word-boundary substitution would create mixed partials inside attribute values). EN originals are cached per element/attr in `i18nAttrOrig` (WeakMap) with the last applied output at `attr+"!t"`: locale switches re-translate from English; if the current value is neither the cached original nor the last output, JS rewrote it — re-cache. The `[A-Za-z]{3,}` guard applies ONLY at cache time (an AR previous output has no Latin letters and must not disqualify the element). Attribute mutations are NOT observed by the MutationObserver — JS-set aria-labels must be wrapped at source with `i18nA(label) || label` (modal labels, `armDeleteBtn`).
- **Row-99 skip-pins**: `.masthead-title`, `.masthead-tag`, and the switcher's `.pf-v6-c-menu__item-description` (LANG_META English descriptions) carry `data-i18n-skip` — EN stays byte-exact there by design.
- **Annotation content is English-only by design** (`.anno` badges and `data-tip` prose are skipped via `I18N_SKIP`); UI chrome around them translates. Data stays data: proper nouns (`llm-gateway-1`, `epic-fhir-token`), task descriptions, incident text, run-record cells — and JS-composed data-feed sentences that embed such identifiers stay mixed by design (row-99 residual ~47 AR / ~51 JA mixed renders are all data-feed cells). Composed *chrome* sentences (bell drawer items, drawer titles, hint prose) get exact-node dict keys instead.
- Node text includes leading/trailing whitespace between tags — dict keys must match it exactly (extract with a `rfind('>')+1 … find('<')` slice, not `str.find(marker)`).
- Watch the `Tokens`-link trap: markup like `(rotate under <a>Tokens</a>); every …` splits one sentence into multiple text nodes — translate each node separately or the render duplicates text.
- `String.replace` callbacks receive `(match, g1, g2…)` — **not** a match array like the `I18N_RULES` bodies (`fn(m)` with `m[1]`). Mixing these up eats captured digits.
- **Language switcher (row 98)**: `LANG_META` = `[native name, English description]` — languages only, no flags/countries; the toggle shows the bare native name. Currency is locale-derived (`I18N_LANG_CUR`, USD default; override via `state.cur`/`mta.cur`/`&cur=`) — never re-couple currency to a country list. The masthead content cluster stays single-row via the row-98 shrink chain (`__content` nowrap + `min-width:0`, scope labels ellipsize with 7ch floor, `#langSwitch` flex-shrink:0) — do not revert to `flex:0 0 auto` (it pushed the switcher off-screen at 1600px) or re-enable PF's `flex-wrap:wrap` there (it stacks a second masthead row).
- **Probe landmine (AR/JA, row-99 refresh)**: the phrase pass also rewrites text inside `<script>` nodes at runtime (documented landmine), so DOM dumps of a translated page contain mangled script source and mixed dict fragments — always skip `script, style` in text-node walkers and probe with double-quoted, word-free JS (row-98 lesson). Table-sort/stale-suite landmine: /tmp verification suites drift from recorded idioms (row-75 `svg.fas`, row-78 no-`_blank`, row-80 font tokens, row-92 sort glyphs, ISO dates) — compare against the defect log before diagnosing a suite failure as a regression.

## Verifying behavior

- jsdom suites live in **`deliverables/ui-mockup/verify/`** (`verify-*.js` + the shared `inv-rows-reference-wp3.json` fixture; per-suite index and run instructions in `deliverables/ui-mockup/verify/README.md`). They resolve jsdom via `require('jsdom')` (after `npm install` in `verify/`) with a fallback to the historical `/tmp/node_modules`. The harness and its known limits are documented in `deliverables/ui-mockup/use-case-verification.md` §1.
- Suites are run from the `deliverables/ui-mockup/` working directory. jsdom gotchas: MutationObserver is async (sleep 60–150 ms before asserting), no layout (offsetParent null), `document.body.textContent` spans ALL screens (hidden ≠ absent) and includes `<script>` text unless the walker skips `script,style`.
- Locate elements by `data-*` attributes/ids, never text.
- **Probes for AR (`lang=ar`) runs must use double-quoted, word-free JS** (row-98 lesson): the AR i18n phrase-pass rewrites text inside `<script>` nodes (commas → `،`, dictionary words translated), mangling single-quoted or wordy probe source in dumps — and a mangled probe silently never runs. Keep probe scripts ASCII-punctuated with double quotes and set markers on `documentElement`, not `document.title` (the AR task ticker overwrites the title).
- Layout/visual checks need headless Chrome: inject the welcome-skip (`localStorage.setItem("mta.welcome.<persona>","1")`) before `</body>`, then load `file://…#scr=<screen>&persona=<role>&lang=de`. `sed`-injection fails when the injected JS contains `|` — use Python. Crop screenshots with PIL. **Always pass `--window-size`**: headless Chrome defaults to an 800px viewport and width-driven artifacts (cards wrapping into tall narrow stacks, phantom row heights) will masquerade as spacing/layout bugs — re-measure at the real width before diagnosing (row-97 lesson).
- `document.title`-level state is in the URL hash (`#scr=…&persona=…&drawer=…&tab=…&anno=1`); fresh jsdom localStorage is empty.
- Suggested flow for any behavior change: edit → parse-check → jsdom assertions → headless-Chrome screenshot for anything visual → append a defect-log row (single long line, anchored on exact existing file text) → CHANGELOG clause → re-verify.

## AI tooling (Red Hat design-system docs)

- The [RHDS AI-tooling guide](https://ux.redhat.com/get-started/developers/ai-tooling/#setup) (MCP servers `cem` = elements, `asimonim` = `--rh-` design tokens; editor plugins for Claude Code/Cursor/VS Code/Neovim) targets **Red Hat Design System web components** — it does **not** apply to this workspace: the mock is genuine PatternFly 6 CSS/markup (`pf-v6-c-*`, `--pf-t--*` tokens via unpkg CDN) with zero `rh-*` elements, no `--rh-` tokens, and no `node_modules` — so those servers have nothing to index and their verify step (autocomplete for `<rh-` / `--rh-`) yields nothing here. Don't configure them for mock work; PatternFly 6 knowledge lives in the mock's own markup and the `use-case-verification.md` parity audit.
- It becomes relevant only if the mock or a proposal adopts `rh-*` web components (an `@rhds/elements` dependency). Both servers were removed from `~/.config/opencode/opencode.json` at the user's request (2026-11-15) — the npm packages (`@pwrs/cem`, `@pwrs/asimonim`) stay installed globally, so re-registration is one config edit away (`cem mcp` / `asimonim mcp`), plus an `@rhds/elements` dependency + `cem generate` manifest for a project to index.
- **PatternFly MCP (installed globally 2026-11-15, `opencode mcp list` → `patternfly-mcp`)**: the official `@patternfly/patternfly-mcp` server (local stdio via `npx -y @patternfly/patternfly-mcp@latest`, Node 22+). This IS the right AI source for this workspace — both the mock and `deliverables/ui-react/` are PatternFly 6 surfaces. Use it to settle PF6 API/contract questions from official docs instead of training-data recall (e.g. the PF6 React `Th.sort` shape `{ columnIndex, sortBy: { index, direction }, onSort(event, columnIndex, newDirection) }` — see the ui-react MIGRATION.md porting notes). Tools in Code Mode: `tools["patternfly-mcp"].searchPatternFlyDocs({ searchQuery })` and `usePatternFlyDocs({ name })` / URL-list fetches; component JSON schemas via `patternfly://schemas/<name>?version=v6`.

## AI design principles (binding for AI-enabled surfaces)

Follow [RHDS AI design principles](https://ux.redhat.com/ai-guidelines/ai-design-principles/) whenever touching the mock's AI-enabled surfaces (Agentic screen, run records, agent/skill/gateway registries, agentic suggestions #20/#28/#29/#34) or drafting AI-related proposal copy:

- **Be transparent**: users must always see that AI is acting — every agent run carries its agent name, gateway + model attribution (`llm-gateway-1 (granite-3.3-70b)`), token/cost showback, and a timestamped event log; keep those attributions intact in any edit. Human-in-the-loop stays explicit (gates can require human accept/reject, #16).
- **Personable, but not human**: no first-person AI persona, no chat-assistant copy ("I can help you…"), no humanized agent characters — agent names stay system-like (`planner`, `verifier-citrus`). The mock currently has zero chat-like copy; keep it that way.
- **Stay in Red Hat's design language**: PatternFly 6 markup/components in the mock, genuine `pf-v6-c-*` widgets and `--pf-t--*` tokens — never fake PF look with custom CSS when a PF component exists.

Verified 2026-11-13 against the Agentic screen: transparent attribution everywhere, zero human-impersonation copy, PF6-native styling — treat any regression on these as a defect-log row.

## Design-system standard (which Red Hat system governs what)

Per [RHDS's own scoping](https://ux.redhat.com/) ("Building products? Check out PatternFly — Red Hat's open source **product** design system"), the two systems split by surface. Re-verified verbatim 2026-11-15 (user challenge) — the About page adds: "Red Hat uses PatternFly, an open source design system, for its products… PatternFly is always our first source of inspiration"; the user re-confirmed keeping the mock PF6-governed (no `rh-*` elements):

- **The console mock follows PatternFly 6** — it is a product UI. Genuine `pf-v6-c-*` widget markup, `--pf-t--*` tokens, and the PF6 stylesheet/fonts from unpkg are the standard here; do not introduce `rh-*` web components into it. **Exception (user decision 2026-11-13, defect row 74)**: the mock also loads `@rhds/tokens@3.2.0/css/global.css` from unpkg, and `--rh-color-*` crayon tokens are the required source for any hand-rolled colors — no raw hex colors in CSS. PF6 still governs all chrome, markup, spacing, and typography; RHDS palette values deliberately overlap PF6's (gray scales are byte-identical; `#0066cc`=blue-50, `#876fd4`=purple-40).
- **RHDS (ux.redhat.com) governs the shared brand layer**: Red Hat Display/Text/Mono fonts (already served by the PF6 CDN), accessibility practice (mock verified 2026-11-13: 678 `aria-*` attributes, 560 `role=`, `tabindex` management, and the #32 "risk never encoded in color alone" rule — keep this bar), and the AI guidelines (see the AI design principles section above). Full RHDS/PF6 audit 2026-11-13: typography, headings, landmarks, a11y, AI principles all compliant (defect-log row 73); since then the masthead uses only PF6 tokens (`--pf-t--color--white`, `--pf-t--color--gray--{30,70,60,10}`, `--pf-t--global--background--color--inverse--{default,hover}`) — do not reintroduce raw hex colors into masthead chrome; PF6 has no inverse-*text* tokens, so gray-palette tokens are the correct substitute for text on dark surfaces. Superseded by row 74: ALL raw hexes were subsequently replaced with `--rh-color-*` crayon tokens (loaded via `@rhds/tokens/css/global.css`) — see the PF6 bullet above for the current rule.
- **RHDS elements/tokens** apply only if a deliverable targets Red Hat's branded web experiences rather than the product console — see the AI tooling section for the already-installed `cem`/`asimonim` servers.
- **Icons (user decision 2026-11-13, defect row 75)**: all icons come from the official Red Hat sets in `@rhds/icons` (ux.redhat.com/foundations/iconography) — inline their SVG path data (ui set 14–24px, microns 8–12px, standard for pictogram metaphors with no UI equivalent); do NOT add the `<rh-icon>` web component; keep the `svg.fas` 1em/currentColor sizing. Icon map = `RHDS_ICONS` + `rhSvg()` in `index.html` (~line 8493, keys are RHDS icon names, bodies use single-quoted SVG attributes inside double-quoted JS strings — quoting landmine, see row 75). Icon-role emoji are gone; emoji inside running prose (🏢/🔑 in sentences, I18N dict values) are text content — leave them. PF6-stylesheet-embedded icons are PF chrome and stay. **State-reflecting toggle icons (row 100)**: the scheme toggle carries `light-mode` (sun) in light / `dark-mode` (moon) in dark — the icon names the ACTIVE state and `applyScheme()` swaps the svg body alongside `aria-pressed` (do not revert to the generic `theme` icon, which is now an unused spare map entry); RHDS_ICONS-map insertion landmine: an entry that is the map's LAST entry ends `}};` with no trailing `},` — inserting after it via `find('},')` splices into the code following the map (row 100 corruption, repaired via the unique tail anchor).
- **Grid/spacing (user decisions 2026-11-13, defect rows 77+79; 12-col base row 93; landing rhythm row 97)**: content layout sits on the **RHDS fluid 12-column grid** — the mock's own layer carries a `.grid12` base (`repeat(12,1fr)`, `gap:var(--rh-space-2xl)`; mobile ≤767px: `repeat(2,1fr)`, `gap:var(--rh-space-lg)`, wide panes span 2 / stat tiles span 1) and all top-level card/KPI containers use it with whole-track spans (`gc3`/`gc4`/`gc6`; five equal tiles use the centered 10-of-12 placement — 5×2 tracks with 1-track margins; `lpPgmKpis` JS branches emit `gc4` cards). The six home persona wrappers (`.lp-*`) stack their sections on the same 2xl rhythm (`display:grid; gap:var(--rh-space-2xl)` — `.grid12` gap does NOT space two stacked grids; don't reintroduce per-element margins between wrapper children). Do NOT reintroduce `repeat(auto-fit,minmax(...))` or `1fr 1fr` inline layout grids for top-level rows; component-internal grids (gantt lane, modal panes, toolbar/toolbars) stay PF6 and out of scope. Long-form prose is capped at 789px (line-length best practice). The 170px wave-stats label-column indents are deliberate alignment, not spacers — leave them. PF6 `spacer--*` tokens remain correct *inside* PF components. The app shell (`.pf-v6-c-page`, 230px sidebar) is PF6 and out of RHDS-grid scope; content max-width stays 1600px. **All spacers in the mock's own layer are RHDS space tokens** (`--rh-space-xs/md/lg/xl/2xl/3xl/4xl/6xl` = 4/8/16/24/32/48/64/96px; the sm=6px token is form-field-pattern-only per the foundation prose) — never introduce raw px spacers (2/3/5/6/10/12/14/18/26/40px are all off-scale now). **App-shell collapse landmine (row 102)**: the page grid (`"header header" "sidebar main"`) relies on auto-placement for sidebar+main (masthead is pinned `grid-column:1/3`); `display:none`-hiding the sidebar (masthead ☰ toggle) removes it from auto-placement, so main would auto-place into the 0-width collapsed track — `body.sidebar-collapsed .pf-v6-c-page__main{grid-column:2;}` must stay. General rule: when hiding a grid sibling, pin explicit column placement on the remaining items.
- **Remaining token categories (user decision 2026-11-13, defect row 80; motion row 96)**: in the mock's own layer, font sizes are `--rh-font-size-body-text-*` (nearest mapping; smallest is xs=12px — the pre-row-80 10–11.5px micro-scale is gone; exception: icon-like glyph chrome such as the 9px footnote caret, like the 1em `svg.fas` sizing), box-shadows are `--rh-box-shadow-{lg,xl}` (blur ≤12→lg, ≥16→xl; no directional shadows exist — the drawer shadow lost `-6px` direction, accepted), border radii are `--rh-border-radius-{default,sharp}` (plus literal `0` in multi-corner lists), and opacity is `--rh-opacity-*` (also as percentage alpha inside `rgba()`); **motion uses PF6 motion tokens** (row 96): durations `--pf-t--global--motion--duration--{slide-in,fade,icon}--*` + timing `--motion--timing-function--{decelerate,default}` — never raw durations/easings — and `@media (prefers-reduced-motion: reduce)` replicates PF's `.pf-v6-m-no-motion` token collapse on `:root` (PF keys it to the opt-in class, not the OS setting — do not remove the media block). Never reintroduce raw px font-sizes, raw animation durations, `rgba(21,21,21,…)` shadows, or decimal opacity values. PF-token shadows/radii inside PF component styling are PF chrome and stay.
- **Interactions (user decision 2026-11-13, defect row 78)**: the RHDS focus-indicator CSS (solid 3px `--rh-color-border-interactive` ring, 3px offset, `transition:none`, `:focus-visible` only) lives in the mockup style layer and applies universally — never add per-component focus styles or inline `outline:none`; external links must not force new tabs (`target="_blank"` is reserved for the workspace `.md` companion documents); inline links use PF6's own dashed-underline styles (brand-aligned, do not override); nav/menus/CTAs stay exempt from underlining.
- **RHDS elements (user decision 2026-11-13, defect row 81)**: element-level alignment is a parity audit against ux.redhat.com/elements/ implemented with PF6 components — no `rh-*` web components. The skip link (PF6 `pf-v6-c-skip-to-content`) must stay the first focusable element in `.pf-v6-c-page`, targeting `<main id="mtaMain" tabindex="-1">`. Filter "chips" are `pf-v6-c-label` + `__actions` close buttons (PF6 removed its chip component — never hand-roll `pf-v6-c-chip` CSS). The annotation-tip singleton must keep showing on keyboard focus (`focusin`/`focusout`), not only hover.
- **RHDS patterns (user decision 2026-11-13, defect row 82)**: pattern-level alignment = parity audit against ux.redhat.com/patterns/ (toasts non-blocking `role="alert"`; tabs deep-linkable via `&tab=`; tiles are cards — PF6 removed Tile; Sticky banner/card + Logo wall are marketing patterns, out of console scope). The Accordion pattern's URL-fragment expansion is implemented in `applyHash` as `&open=<id>(,<id>…)`: expand-only, applies to accordions (`pf-v6-c-accordion`) and `<details>` disclosures, and searches both live DOM and `<template>` contents so panels inside drawer templates come pre-expanded after `cloneNode`. Give new collapsible panels an `id` so they stay deep-linkable; do not sync `open` back into `syncHash`.
- **RHDS theming (user decision 2026-11-13, defect row 83)**: color SCHEMES only (light/dark — RHDS bans "theme" wording for this concept). The scheme toggle (`#schemeBtn`, @rhds/icons "theme" icon) toggles `pf-v6-theme-dark` on `<html>`, persists to `localStorage mta.scheme`, deep-links via `&scheme=` (deep link wins, then persisted — same precedence as lang/cur; `syncHash` emits it only when dark). Dark overrides for the mock's own crayon surfaces live in the `html.pf-v6-theme-dark` CSS block (persona-blurb, qhealth banner, table hover) plus the PF brand/focus token remap to RHDS `--rh-color-interactive-primary-*-on-dark` — never hand-roll new dark colors outside that block; light scheme must stay byte-identical to pre-row-83. Project Felt is built into PF6 (`pf-v6-theme-felt`) — do not confuse it with dark. **Masthead chrome (row 84)**: the masthead and anno tooltip are dark in BOTH schemes — pinned to `--rh-color-gray-80`/`--rh-color-gray-70` (byte-identical to the light-scheme PF inverse values); NEVER use `--pf-t--global--background--color--inverse--*` or `--pf-t--global--text--color--inverse` for chrome that must stay dark in both schemes — they are scheme-relative and flip to light under `pf-v6-theme-dark`. On-brand masthead text (selected persona pill, logo tile) flips to `--rh-color-gray-95` in dark (the brand token maps to light #92c5f9 there).
- **Full-mock audit baseline (defect row 85)**: the mock passed a consolidated RHDS audit (all foundations, tokens, elements, patterns, theming, a11y) with four fixes — one `<main>` landmark only (drawer content is `<div>`), no raw 3-digit hexes either (`color:#fff` banned like 6-digit ones), gantt `.bar` text flips to `--rh-color-gray-95` and `.anno` badges to `--rh-color-purple-60` in dark (PF dark flips status/nonstatus tokens to LIGHT crayons — any surface that keeps light-scheme text color needs the inverse flip). Contrast-audit landmines for future sweeps: PF6.7 paints label/card backgrounds on `::before` pseudo-elements, `rgba(255,255,255,0)` counts as transparent, hidden DOM must be excluded via `checkVisibility`, disabled controls are WCAG-exempt.
- **Tables (defect row 86, glyphs updated in row 92)**: follow the RHDS Table guidelines — sortable headers show the stacked double-triangle glyph when unsorted (the RHDS `<rh-sort-button>` implementation's `sort` path, `viewBox="0 0 320 512"` — its "both arrows visible" state; keys `sort-unsorted`/`sort-asc`/`sort-desc` in `RHDS_ICONS`, NOT the @rhds/icons small-to-large arrows), keep `aria-sort` in sync (none/ascending/descending), give table-bearing card bodies `overflow-x:auto` via `:has(> .pf-v6-c-table)`, and always match `<th>` count to body cell count (no one-column tables). **Icon-path quoting landmine**: RHDS icon path data uses single-quoted attributes — inside single-quoted JS strings they must be re-quoted to double quotes (the parse-check catches violations; verify with `node --check` on extracted blocks, and beware stale `/tmp/opencode/blk*.js` files from earlier debug runs).
- **Per-element guidelines audit (defect row 87)**: all in-use RHDS elements audited against their `/guidelines/` pages. Durable rules: one `pf-m-primary` button per view; label-less compact menu toggles carry descriptive `aria-label`s (multi-select toggles/inputs derive from `data-label`); menu groups ≤7 items with `pf-v6-c-menu__group` headings; code blocks ≥5 lines get a header Expand/Collapse button, collapsed by default (`.codeblock-collapsed` + synced `aria-expanded`), short blocks get none; pagers hide on zero results (RHDS Pagination — `invPag`/`<prefix>Pag` `[hidden]` + `.pf-v6-c-pagination[hidden]{display:none}`). Accepted deviations (recorded, do not "fix"): tablists with 6–8 tabs (console IA), `.anno` tip prose exceeding tooltip length (popover-like annotations), dashboard card titles over 20 chars, 9 sidebar nav items vs the RHDS primary-nav max of 5 (console IA). jsdom landmine: inline `onclick` on template-cloned content may not fire — verify click cycles in headless Chrome, keep jsdom for static/structural assertions.
- **PF6 component audit (defect row 94)**: all 36 in-use `pf-v6-c-*` components verified against patternfly.org/components/overview (v6.7.0). Headings are the PF6 Title component — `pf-v6-c-title pf-m-xl` `<h1>` page titles (keep the `.page-title` class as the margin/JS hook) and `pf-m-lg` `<h2>` drawer/modal headings; never reintroduce hand-rolled or inline-styled headings (PF6 heading weight is semibold 600 — token `heading--default`→`weight--300`→600). Do NOT "fix" the bell badge to a notification-badge component (React-only in PF6 core — 0 hits in 6.7.0 patternfly-base.css; `pf-v6-c-badge pf-m-unread` in the menu-toggle is the sanctioned HTML idiom) or the `<h1 class="pf-v6-c-menu__group-title">` heading level (matches PF6's own HTML examples). Charts/clipboard-copy have no applicable HTML implementation for the mock's idioms.
- **PF6 pattern audit (defect row 95)**: all 12 PF6 patterns verified against patternfly.org/patterns (v6.7.0). Deletion TRIGGERS are `pf-m-secondary`, never `pf-m-danger` (danger only on the confirmation modal's submit and the delete-finished armed state — do not revert); bulk "Select none" menu items are disabled at zero selection via `bulkNoneDisabled()` (aria-disabled + pf-m-disabled + title, row-91 idiom) from `updateBulk()`/`updateCancel()`, and `updateCancel()` runs at boot; the inventory header checkbox is deliberately NOT a select-all (the toolbar bulk selector owns it — do not "fix"); selection persists after a bulk apply. RTL: `dir=rtl` flips the layout via PF6 logical properties + the one remaining mock override (tour dock — the lang-flag override went with row 98's flag removal); the masthead brand title truncates with an ellipsis in both directions (`.masthead-title` — keep `min-width:0` on `__brand`); mixed-language strings in Arabic renders are i18n coverage gaps, not RTL bugs.
- **Overview + style pages audit (defect row 89)**: the overview (bare `/elements/<slug>/` — `/overview/` 404s) and `/style/` pages of all in-use elements audited against distilled RHDS specs. Durable behavior rules: dialogs (`openModal`) move focus to the modal box's first focusable control on open, trap Tab while open (`modalTrap`, wired into the global keydown handler), and restore focus to the opener on close (`modalRestore` from closeModals/closeAppForm/closeAppModal/Escape); menu-dropdowns focus their first `.pf-v6-c-menu__item` on expand (`menuOpened`, called by all four masthead toggles) and return focus to the toggle on Escape or item selection (`wireMenuRestore`; `focusToggle` re-queries by id because re-renders can replace the opener — a stale detached reference silently no-ops). Typeahead select-wrap filter menus keep focus in their input (PF6 convention) but close on Escape. Code-block headers always carry a Copy action beside Expand/Collapse (`codeBlockCopy`, feedback swap "Copied!"/"Copy failed!" reverting after 1.6s). Alerts keep the icon+title minimum and carry no dismiss action (Warning/Danger resolve-only). Accepted deviations (recorded, do not "fix"): tooltip 300ms hover delay + arrow (popover-like `.anno` singleton), Statistic red data-text in light scheme, Card titles as `div`s (PF6-native markup), no table `<caption>`, binary scheme toggle (row 83). Probe landmines: `focus()` on a hidden toggle silently no-ops — probe focus restore on an always-visible control (`langSwitch`), and capture clipboard feedback after a delay (the promise settles asynchronously; headless synthetic clicks get "Copy failed!", real use gets "Copied!").
- **Pattern overview/style audit (defect row 90)**: RHDS patterns have NO `/style/` or `/overview/` sub-pages (404 — style guidance is a section inside the single pattern page; tabs/tag are stubs, spec content on `/examples/`). The RBAC toast follows the RHDS Toast style page: `position:fixed` top-right below the 64px masthead (`top:calc(var(--rh-space-6xl) + var(--rh-space-md))`), `--rh-box-shadow-xl`, `@keyframes toastIn` slide-in, mandatory close button (`rbacToastClose()` clears the 8s auto-dismiss timer), `role="alert"` non-blocking — do not revert it to an inline banner; don't use raw px spacers or hex shadows for it (row 77/80 tokens). Toast auto-dismiss is 8s per the "~8 seconds" spec (row 82's 6s superseded). Accepted deviations (do not "fix"): filter "+5 at a time" progressive disclosure and <768px collapse-to-disclosure are PF6 scrollable menus / toolbar wrapping; form span 4–8 columns superseded by PF6 drawer/modal widths. The Personalization "Announcement" pattern (outside the 14-pattern catalog) remains unaudited — flagged, not silently skipped.
- **Gap-inventory pass (defect row 91)**: closed every remaining RHDS surface. Durable rules: disabled menu items use `aria-disabled="true"` (+ `pf-m-disabled` styling + title), never the `disabled` attribute — items stay focusable/readable and the handler guards no-op them; hover/focus-revealed content (`.anno` tips) is Escape-dismissable (`hideAnnoTip()` in the global Escape handler — WCAG 1.4.13 dismissable/hoverable/persistent); AI-generated run records carry the `.ai-marker` dual indicator (`ai-experience` sparkle + "AI-generated" text, `--rh-color-purple-60` light / `--rh-color-purple-30` dark — purple is the sanctioned informational-AI hue; sparkle never appears without AI text, never on non-AI content; robot icons never render for non-chat AI). Form errors always state location + cause + fix. Deliberate differences (recorded, do not "fix"): no Breadcrumb (tenancy path is a switcher), no Back to top (no screen exceeds 2 viewports — measured 393–1140px), risk labels instead of Health-index A–F boxes, no Avatar/Spinner/Popover; marketing elements (Announcement, Audio player, Readtime, Site status, Video embed), the Personalization section, and theming variants (Customizing, Color Palettes, Project Felt at `/theming/themes/project-felt/`) are out of console scope. `setLang` must keep updating `documentElement.lang`. Probe landmine: `openDrawer('wfrun-full')` routes to the MODAL (`MODAL_VIEWS`) — probe `#modalAppBody`, not `#drawerBody`; and disabled tenancy items only exist for admin/architect personas (padmin sees none).

## hub-backend (Quarkus + PostgreSQL, added 2026-11-16)

Implements the workspace's Tackle Hub API contract v2.1 in
`deliverables/hub-backend/` (Java 21, Quarkus 3.40, Panache, PostgreSQL). Full
contract/run docs: `deliverables/hub-backend/README.md`. Build: `mvn test` /
`mvn clean package` from `deliverables/hub-backend/`; tests boot a real PostgreSQL via
DevServices (podman socket). Landmines learned during the build:

- Panache JPA ownership: mutating the `mappedBy` (inverse) side of a
  `@ManyToMany` writes nothing — membership mutations must go through the
  owning side (group owns `stakeholder_group_members`, stakeholder owns
  `team_members`); keep both sides in sync for same-transaction views.
- `user` is a reserved word in PostgreSQL — the Identity credential-user
  column is mapped as `username`.
- CDI interceptor bindings: a binding annotation's members participate in
  matching unless `@Nonbinding` (jakarta.enterprise.util) — without it
  `@Scopes("x")` methods don't match the `@Scopes({})` interceptor.
- HQL plural paths: `Wave.count("members.id", …)` is invalid — use
  `find("select w from Wave w join w.members m where m.id = ?1").count()`.
- **Auth is Keycloak everywhere (2026-11-16)**: OIDC in all profiles — Dev
  Services for Keycloak boots the checked-in realm
  (`keycloak/mta-realm.json`, pinned to :8180) in dev and test; `%prod` uses
  `KEYCLOAK_URL`. The former header-based identity (`DevIdentity`,
  `X-MTA-User/-Scopes/-Org`) was REMOVED. Landmines learned while wiring it:
  - **Claims are NOT `SecurityIdentity` attributes** — quarkus-oidc propagates
    only roles (`realm_access.roles`); arbitrary claims (organization, team,
    mta-scopes) must be read from the JWT principal
    (`identity.getPrincipal() instanceof JsonWebToken` — see
    `security/TokenClaims.java`). `identity.getAttribute("organization")`
    silently returns null.
  - **Don't name a claim `scopes`** — the OIDC extension owns that attribute
    slot; the realm maps the `scopes` user attribute to a `mta-scopes` token
    claim instead.
  - **Role bundles must cover every scope a screen calls** — the frontend's
    old explicit `X-MTA-Scopes` masked gaps; when a screen 403s under a demo
    user, extend `hub.role-mapping.<role>` (additive change, no test impact).
  - **Tests authenticate with `Tokens.of("<user>")`** (password grant against
    the DevServices Keycloak, client `mta-console`, password `demo`); realm
    users carry the tests' scope sets / org claims as user attributes —
    a test's token replaces all of its former identity headers 1:1. The
    realm user list must stay in sync with the tests' identity needs.
  - Unauthenticated → 401 + WWW-Authenticate in EVERY profile now (the
    contract semantic is uniform); only `/openapi3.json` and `/q/*` stay
    public.
- **Keycloak Organizations feature (2026-11-16)**: the realm enables
  `organizationsEnabled` (northwind-financial / meridian-health orgs) and
  tenancy resolves from TWO claim sources — read about them together:
  - **Members are NOT importable** (keycloak#54343): realm JSON import
    creates orgs but silently drops members. `keycloak/sync-org-members.sh`
    (kcadm, idempotent) adds them; compose runs it as the
    `keycloak-bootstrap` one-shot init service (needs the bootstrap admin —
    `KC_BOOTSTRAP_ADMIN_USERNAME/PASSWORD` on the keycloak service). For
    dev runs, execute the script against :8180 manually or rely on the
    `mta-org` attribute fallback.
  - **Two org claims, one per source**: `mta-org` (display-name string,
    from the user attribute — tests/dev fallback) and `mta-orgs` (native
    `oidc-organization-membership-mapper` via the custom `org-membership`
    client scope — ARRAY OF ALIASES). `TenantScope` tries `mta-org` first,
    then resolves `mta-orgs` aliases against slug(display-name). The
    display-name mapper was renamed organization→`mta-org` so the built-in
    `organization` scope (array of aliases when orgs are enabled) can stay
    attached without clobbering the string claim.
  - **Realm-import scope landmine**: providing ANY `clientScopes` array in
    the realm JSON replaces Keycloak's whole built-in scope set —
    `roles`/`profile`/`email` silently vanish (`realm_access.roles` gone ⇒
    no persona). The realm file therefore embeds the built-in scope
    definitions (exported from a scratch realm) plus `org-membership`, and
    wires defaults via `defaultDefaultClientScopes`. Client-level
    `defaultClientScopes` at import time resolves only scopes that exist —
    don't use it.
  - **Parsson quoting**: the `mta-orgs` claim arrives as a JSON-P
    `JsonArray`; element `toString()` keeps the JSON quotes — extract via
    `JsonArray.getString(0)` (see `TenantScope.firstAlias`), or slugs never
    match.
  - **Login is username-first** with orgs enabled (org identification step,
    then password) — e2e probes must handle the two-step form.
  - **Port clash**: DevServices pins Keycloak to :8180 — stop the compose
    keycloak service (or `podman rm` the DevServices container afterwards;
    testcontainers leaves `nervous_blackwell`-style strays bound to 8180).
- `schema.sql` (2026-11-16) is the **checked-in schema of record**, not an
  init script — never point Quarkus at it (Part 1 duplicates what Hibernate
  generates; runtime truth stays `update`/`drop-and-create`). Part 1 is the
  verbatim pg_dump of the 22 entities (refresh: `mvn quarkus:dev` + pg_dump
  from the DevServices container); Part 2 is the mock-model projection not
  yet entity-backed (natural keys, uuid on promotion) — when an entity lands
  for a Part 2 table, move that table from Part 2 into the regenerated
  Part 1 and update the divergence notes. It lives here (not ui-mockup)
  because it backs the Quarkus implementation; the UI-mock link points at it.
- Test profile uses `drop-and-create` + reseed per JVM; dev keeps
  `update` (persistent).
- **Container stack (`deliverables/compose.yaml`, 2026-11-16)**: podman
  compose runs postgres + keycloak (`start-dev --import-realm`, healthcheck
  via bash `/dev/tcp` — no curl in the KC image) + hub-backend
  (hub-backend/Containerfile, fast-jar) + console (ui-react/Containerfile +
  nginx.conf, context = `deliverables/` because prebuild extracts generated.ts
  from ui-mockup/index.html). Issuer landmine: tokens are issued as
  `http://localhost:8180/realms/mta` (browser view) but the backend validates
  against in-network `http://keycloak:8080/...` — compose sets
  `QUARKUS_OIDC_TOKEN_ISSUER` to the localhost URL and
  `QUARKUS_OIDC_CONNECTION_DELAY=45S` for the realm-import race. Ports
  5173/8180 are pinned by the realm's redirect URIs. Datasource landmine:
  the JDBC URL env is `QUARKUS_DATASOURCE_JDBC_URL` (`quarkus.datasource.jdbc.url`)
  — plain `QUARKUS_DATASOURCE_URL` is not a property, and without a URL the
  agroal bean deactivates ("Unable to find datasource '<default>'").
  Postgres 18 mounts its volume at `/var/lib/postgresql` (not `.../data`).
  **Recreate landmine (2026-11-16)**: after `podman compose build <svc>`,
  `podman compose up -d <svc>` does NOT recreate the container from the new
  image (it reports done while the old image keeps serving) — always
  `up -d --force-recreate <svc>` and verify the running image ID matches
  (`podman inspect <ctr> --format '{{.Image}}'` vs `podman image ls`).
- Incident keys embed file paths (slashes) — the triage route uses a regex
  path param `/{incidentKey: .+}/triage` and clients send the key raw.
- **Console-extension resources (2026-11-16)**: 13 new entities (platform,
  target, gateway, skill, agent+agent_skills, workflow, workflow_run,
  agent_run+agent_run_event, wave_dependency, wave_evidence, wave_ticket,
  trend_point) + identity extension (expiresOn/verified/description) +
  application extension (riskKind, platform/identity/credential FKs,
  repositoryType, binaryArtifact, assessmentVersion, reviewState,
  Analysis.progress). SeedData mirrors the mock's full dataset — org names in
  seed/DB are the full display names ("Northwind Financial"), tenancy ids in
  the frontend are slugs (`northwind-financial`).
- **schema.sql refresh rule (learned 2026-11-16)**: the pg_dump of a fresh
  DevServices DB starts with `SET …` lines *including*
  `set_config('search_path','',false)` — Part 1 must begin at
  `SET default_table_access_method = heap;` (as the checked-in file does), or
  Part 2's unqualified identifiers fail with "no schema has been selected".
  Verify a refresh by applying Part 1+Part 2 to a scratch database
  (`ON_ERROR_STOP=1`), then dropping it.
- **Promotion ledger**: Part 2 now holds only analysis_run, run_diff,
  stakeholder_group_wave. `credential` was superseded by the identity
  extension (expireson/verified/description) and `run_trend` by trend_point —
  do not re-add them; display-only columns from the mock (age strings,
  '… ago' durations) deliberately did NOT move into the entities (they derive
  at render time in ui-react's adapters).

## ui-react (React port, live-API + Keycloak auth since 2026-11-16)

Every screen reads the Quarkus backend through `src/api/hub.tsx` (hard API
dependency — error state + Retry, no generated-data fallback), authenticated
with Keycloak bearer tokens (`src/api/auth.ts`, realm `mta`, public client
`mta-console`, PKCE; Dev Services Keycloak on :8180 in dev). Landmines:

- **parseHash persona default is token-derived (2026-11-16)**: `p.get('persona') || authUser()?.persona || 'architect'` — defaulting to architect made `clamp()` (which receives the fresh state as its own "previous" in the parseHash path) force `scr` back to `'home'` on EVERY `location.hash` navigation for non-architect users; keller masked it. Deep links, the tour's Open-view, and any external hash assignment broke silently. An explicit foreign `&persona=` still clamps to home.
- **Roles define persona**: the logged-in user's realm role IS the persona
  (`PERSONA_PRECEDENCE` in auth.ts) — the mock's persona switcher is gone
  (masthead shows a user chip + Sign out). `&persona=` deep links are
  clamped to the token persona. Demo users live in the realm and their
  usernames are their email addresses (2026-11-16): m.keller@northwind-financial.com
  (architect), j.cordes@northwind-financial.com (migrator),
  p.schmidt@northwind-financial.com (pm, team Claims),
  k.vogel@northwind-financial.com (pgm), a.weber@northwind-financial.com
  (admin), root@example.com (padmin), r.olson@northwind-financial.com
  (architect — tenancy purely from Keycloak-org membership) — all password
  `demo`; backend test fixtures (arch, chen, …) keep short names.
- **i18n is dual-engine (2026-11-16)**: the mock's DOM-walker (`src/i18n/i18n.ts`) still
  translates unmigrated surfaces; migrated components use react-i18next with **natural
  keys** (`src/i18n/index.tsx` `useT()`; catalogs `locales/<lng>.json`, seeded in prebuild
  from the mock's dict + `scripts/i18n-additions.json`). A migrated component MUST mark
  its DOM `data-i18n-live` — the walker's skip check honors it (travels through PF6
  portals); without the marker the walker re-processes `t()` output (phrase-pass
  corruption risk). EN text = the key: changing an EN string orphans the translation in
  all 7 catalogs (check:i18n reports it) — re-run `npm run check:i18n` after copy edits.
  **`src/i18n/i18n.ts` is a hand-ported copy of the mock's dict — no script regenerates
  it**: when the mock's dict changes, apply the same edit to i18n.ts manually, then
  `npm run check:i18n` (its extract step reads i18n.ts, NOT the mock) to regenerate the
  locale catalogs (2026-11-16 wizard-step rename).
  `npm run check:i18n` gates used keys × all locales (also collects `Trans`
  `i18nKey="…"` literals); cross-locale holes from the mock's dicts are warnings
  only. When ALL screens are migrated, retire the walker (see MIGRATION.md
  "i18n strategy"). Home landmines: composed sentences that the React port
  shapes differently from the mock (banner, KPI subs, trends caption) need
  **interpolated template keys** — per-locale renderings were harvested from the
  mock via `scripts/harvest-mock-home.cjs` (run from the workspace-root
  `demos/live/` with
  `NODE_PATH=./node_modules node ../../deliverables/ui-react/scripts/harvest-mock-home.cjs`); the trends
  caption's bold figures survive per-locale word order (ja/tr reorder) via
  react-i18next `Trans` with `<b>` markers inside the catalog values; date slots
  inside fenced subtrees use the exported `fmtDate` (swap to `Intl` at walker
  retirement). **Plurals use i18next's native `count:` option** — `_one`/`_other`
  suffixed catalog entries, pairs in EVERY locale (a locale missing `_one`
  silently falls to `_other`, NOT the bare key — always write both, identical
  values for invariant locales like ja/tr); EN plural forms live in the
  hand-maintained `en.json` (generated from `i18n-additions.json`'s `en` block —
  EN is otherwise the identity locale, so check:i18n exempts it from bare-key
  coverage but REQUIRES `_one`/`_other` pairs for every count-key).
- **Auth gate chain (App.tsx)**: `initAuth()` (check-sso) → anonymous
  visitors get the SignIn screen; authenticated users get
  HubProvider → AppProvider → Shell/Router. `api()` attaches the Bearer
  token (refreshes ≤30 s to expiry) and triggers `login()` on 401.
- **Tenancy from the token**: the `mta-org` claim (display name) names the
  home org (the `team` claim pins team-locked personas; native Keycloak-org
  membership, claim `mta-orgs`, is the alias-based fallback — see the
  backend Organizations section); installTenancy's home is
  token-derived in hub.tsx `home()`, not ARCH_APP-first anymore (ARCH_APP
  still anchors padmin / no-claim users).

- **`generated.ts` is regenerated from the mock on every build** (`prebuild`)
  — anything hand-written there gets wiped. RBAC scope literals live in
  `appState.tsx` (`SCOPE_OVERRIDES`, backend-exact `resource:verb`);
  `'*'` is frontend-only, expanded by `client.ts` `expandScopes`.
- **Provider order is load-bearing**: `HubProvider` wraps `AppProvider` in
  `main.tsx` — NOT inside `App.tsx`. `AppProvider`'s `parseHash` runs at
  mount and freezes empty tenancy if the hub hasn't installed the registries
  yet; the symptom is `scope-label` "· · all teams" and zero rows everywhere
  despite 200-OK API calls.
- **TEAM_HOME is token-derived**: the default org/dept/team comes from the
  token's `organization`/`team` claims (hub.tsx `home()`); ARCH_APP anchors
  only the padmin/no-claim fallback — not alphabetical first (the backend
  returns "Meridian Health" first).
- **Tenant-required endpoints need a per-org fan-out** with
  `?organization=<uuid>` (`/applications`, `/departments`, `/teams`,
  `/stakeholders`, `/business-services`, `/tags`, `/job-functions`,
  `/waves`, `/analyses`, `/tasks`, `/analyses/incidents`, `/identities`,
  `/audit`); only `/organizations`, `/report/trend`, the agentic/platform/
  target/wave-content reads work org-less. The org comes from the token's
  `organization` claim: non-padmin users fan out over exactly one org (the
  backend clamps to the claim and ignores the param), padmin pivots across
  all (each pivot audited). Missing org ⇒ 400 `tenant.required`.
- **Module-level store bind pattern** for screens whose child components read
  stores (Waves, Reports, Config): `let X = …` module bindings assigned at
  the top of the screen function (children render after the parent body
  runs). Incidents/Agentic/Tasks/Credentials use `useHub()` directly.
- **Home (architect landing) is a full port of the mock's `lp-architect`**
  (2026-11-16): persona-blurb banner + 4 KPI cards + hurts table + Trends
  bars, every number derived live from hub data (`gateFacts` ports the
  mock's `waveGateFacts`; other personas keep `GenericLanding`). Landmines:
  `useHub()` returns `{ data, … }` — fields hang off `data`; and
  **`/report/trend` is a RAW ARRAY, not paged** — `listAll()` silently
  returns `[]` for it, the fetch must use `api<TrendV[]>(…)` directly
  (symptom: Trends renders "last 0 runs", no error). Hurts-table rows
  deep-link `#scr=inventory&bsvc=<name>`; Inventory seeds a clearable chip
  from the hash at mount and `syncHash` rewrites the URL without the
  unknown key (filter state lives in the component — expected). Same
  pattern for Incidents' `&app=` chip (the table's "N incidents" links).
- **Inventory mock-parity pass (2026-11-16)**: the Applications screen now
  mirrors the mock — tabs (Applications / Archetypes & cohorts, deep-linked
  via `&tab=archetypes` riding app state as `invTab` like `agTab`/`cfgTab` —
  a component-local hashchange listener loses the race against `syncHash`'s
  synchronous `history.replaceState`, don't revert to one), filter-category
  toolbar (checkbox menus = PF6 `MenuItem hasCheckbox` + `isSelected` +
  Menu-level `onSelect(itemId)` — the checkbox does NOT fire the item's own
  onClick), bulk selection (Assign-to-wave `PUT /waves/{id}`, Queue-analysis
  `POST /batch/analyses`, RBAC-gated), Create (`POST /applications`),
  Export (client-side CSV), Import (→ `#scr=wizard`), live Archetypes tab
  (`HubData.archetypes`). **Tenancy slugs vs UUIDs**: `TEAM_BY_ID` ids are
  display slugs — write bodies need the UUIDs from `HubData.teams` (and
  `WaveRow.id` / `AppRow.id`); `POST /applications` with a slug `teamId`
  fails 400 with an EMPTY body (UUID deserialization), which reads as a
  bare "Bad Request" in the UI.
- **Notifications drawer (2026-11-16)** — three landmines from the port:
  (1) **Hand-rolled PF6 markup needs an explicit CSS import**: react-core
  injects component CSS only when its own components render — raw
  `pf-v6-c-notification-drawer` markup (used because the React
  `ListItemHeader.title` is a plain string and can't carry the persona chip)
  stays unstyled without
  `import '@patternfly/react-styles/css/components/NotificationDrawer/notification-drawer.css'`.
  (2) **PF6 sets `height:100%` on the drawer root** — inside an
  absolutely-positioned popover anchored to a bell-button wrapper it resolves
  against the wrapper's ~37px height and collapses; override `height:'auto'`
  inline (max-height + overflow-y cap it, like the mock's 70vh). AND: **the
  `hidden` attribute alone does NOT hide it** — PF6's author-level
  `display:flex` beats the UA's `[hidden]{display:none}` (author origin always
  wins over UA origin), so the drawer stayed VISUALLY open while its
  `hidden` property toggled correctly — property-reading probes pass, users
  see a drawer that can't be closed. The mock carries
  `#notifDrawer[hidden]{display:none}` for exactly this (mock line 293); the
  port needs `.pf-v6-c-notification-drawer[hidden]{display:none}` in
  index.css. Probes must assert `getComputedStyle(...).display`, not the
  `hidden` property.
  (3) **Composed strings must be ONE JSX text node** for the walker's exact
  dict keys: `{n} unread · …` renders `{n}` and the tail as separate text
  nodes and the key `'1 unread · filtered…'` misses (phrase-pass partials,
  "role und organization"); `{`${n} unread · …`}` keeps one node. The
  trailing-space title keys are intentional (visual gap before the chip AND
  part of the dict key) — the 'Wave 4 spans…' item is the exception (its
  trailing-space variant has no dict entry; the no-space key does).
- **Wave-toggle icons use the standard PF6 icon** (2026-11-16): the Waves
  expand/collapse chevron is `RhMicronsCaretDownIcon`
  (`@patternfly/react-icons/dist/esm/icons/rh-microns-caret-down-icon`) — the
  exact icon react-table's `CollapseColumn` renders — inside the
  `.pf-v6-c-table__toggle-icon` span, rotated by the `.wave-exec` rules in
  index.css (PF's own rotation selector is scoped to `.pf-v6-c-table__toggle`
  cells the gantt lanes don't have). Policy: prefer `RhIcon` or
  `@patternfly/react-icons` components; never copy raw `<svg className="fas">`
  markup from the mock — the mock's `svg.fas` global rule (mock line 332)
  stays in index.css only as a fallback for copied markup.
- **Never put `(#N)` suggestion refs in rendered JSX text** (2026-11-16
  alignment pass removed 235 of them — the mock shows annotation content
  only as opt-in `.anno` badges). Upstream refs the mock itself shows in
  prose (`tackle2-ui#3116`, `hub#420`, `R2-16`, `#494`) are fine. Related:
  `SCOPE_OVERRIDES` carries the mock's client-side verbs
  (`runs:create/cancel/pause`, `identities:edit/verify`, `tasks:cancel`
  for architect+migrator) next to the backend-exact literals — they gate
  UI affordances only (Create run, re-test, re-validate); `runs:delete`
  is deliberately absent (mock's trash is disabled for architect too).
  Credentials `lastUsed` comes from the seed (fresh DB volume needed to
  see it); Expires renders relative ≤14d then "Sep 12"-style.
- **`.tsx` generic arrow functions need `<T,>`** — `async <T>(…)}` parses as
  JSX; the error appears far from the cause.
- **Probe language via `localStorage['mta.lang']='de'`** (or `#…&lang=de` in
  the hash) — a `?lang=de` query param is NOT read by the React port; the
  `&lang=` deep link rides the URL hash like all other state. Also: HTML
  entities are not decoded inside JSX string *expressions* —
  `{'Stale &gt; 30d'}` renders the literal `&gt;`; write `{'Stale > 30d'}`
  (entity decoding only happens in JSX text children).
- Writes: agentic creates/deletes + incident triage are real (POST/DELETE/
  PUT + `reload()`); run lifecycle (pause/resume/cancel, delete-finished) and
  Tasks cancel stay client-side — the hub contract has no such verbs.
- Adapters (hub.tsx) project onto the mock's render shapes: CURRENT→succeeded,
  IN_FLIGHT→running(+pct), STALE→quota, FAILED→failed; stale = last
  successful analysis ≥ 2 days; QUEUED+quota→'Postponed'; task id shown as
  `#${uuid.slice(0,4)}`. Static boundaries: `ACTIVE_LOGINS`/`EXTRA_USERS`
  (Config Access tab) and Reports' editorial prose stay in the app.

## Conventions

- References: Red Hat JIRA keys (`MTA-xxxx`) and `org:reponame#issue` for GitHub; upstream statuses are verified inline where they matter.
- The mock opens via `file://` and needs internet (PatternFly 6.7.0 + Red Hat fonts from unpkg CDN).
- `evidence/mta-improvement-suggestions.md`, `design/design.md`/`implementation/implementation.md`, and `CHANGELOG.md` are long single-purpose documents with stable section anchors — navigate by `#section` links rather than re-reading whole files. (The root `README.md` is the lean map; the mock's long-form design-system clauses live in `deliverables/ui-mockup/design-system-rules.md`.)
