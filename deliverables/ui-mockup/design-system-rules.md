# UI mock design-system rules — long-form reference

The durable design-system conformance clauses for
[`deliverables/ui-mockup/index.html`](index.html) (and, where marked, the
`ui-react` port). Three layers, one rule each:

- **[AGENTS.md](../../AGENTS.md)** (workspace root) — the *binding summary*;
  when the two disagree, AGENTS.md wins and this file is stale.
- **This file** — the long-form clauses, organized by category.
- **[use-case-verification.md §4](use-case-verification.md)** — the
  append-only defect log; every clause below cites its row (rows 73–106),
  which carries the full evidence, probes, and landmines.

Governance split (RHDS's own scoping, re-verified 2026-11-15): the console
mock is a **product UI** and follows **PatternFly 6** — genuine
`pf-v6-c-*` markup, `--pf-t--*` tokens, the PF6 stylesheet/fonts from
unpkg; never introduce `rh-*` web components. **RHDS (ux.redhat.com)
governs the shared brand layer**: Red Hat fonts, accessibility practice,
AI guidelines — and, per the user decision recorded in defect-log row 74,
its crayon/space/type tokens are the required source for the mock's own
hand-rolled CSS.

---

## Color & tokens

- The dark masthead is fully tokenized (defect-log row 73): all raw hex
  colors (`#2B2B2B`/`#3A3A3A`/`#4A4A4A`/`#CFCFCF`/`#BBBBBB`/`#EEEEEE`/`#fff`)
  use PatternFly 6 tokens — `--pf-t--color--white`, the
  `--pf-t--color--gray--{30,70,60,10}` palette (PF6 has no inverse-text
  tokens), and `--pf-t--global--background--color--inverse--{default,hover}`
  for toggle/menu-toggle backgrounds — with ≤9/255 per-channel value shifts
  (before/after screenshot diff: visually identical).
- All hand-rolled colors come from the RHDS crayon palette (defect-log
  row 74): the mock loads `@rhds/tokens@3.2.0/css/global.css` from unpkg and
  every remaining raw hex (annotation/welcome meta-layer, demo gradients,
  token fallbacks) was replaced with a `--rh-color-*` variable — zero raw
  6-digit hex colors remain in the file. Deliberate user decision to admit
  `--rh-color-*` tokens alongside PF6 (see AGENTS.md); PF6 still governs all
  chrome, markup, spacing, and typography.
- Typography, elevation, shape, and opacity in the mock's own layer use
  RHDS tokens (defect-log row 80): font sizes are
  `--rh-font-size-body-text-*` (xs=12 … 2xl=24px; no 9–11.5px micro-text
  except icon-like glyph chrome), shadows are `--rh-box-shadow-*`,
  radii are `--rh-border-radius-{default,sharp}`, and opacity values are
  `--rh-opacity-*` (including percentage alphas inside `rgba()`) — never
  reintroduce raw px font-sizes, hand-rolled `rgba(21,21,21,…)` shadows,
  or raw opacity decimals. RHDS has no directional shadow tokens (the
  drawer shadow lost its direction in row 80 — accepted).

## Icons

- All icons come from the official Red Hat icon sets (defect-log
  row 75): the Font Awesome glyph map and every icon-role emoji were
  replaced with inline SVG path data from `@rhds/icons` — ui set for
  14–16px roles, microns for ≤12px carets/sort/arrows, and five
  standard-set pictograms where no UI equivalent exists (`hierarchy`,
  `layered`, `waveform`, `fire-extinguisher`, `target`). Icons stay
  monochrome `currentColor` at `1em` via the `svg.fas` rule; the
  `<rh-icon>` web component is deliberately not used. Emoji inside
  running prose (🏢/🔑 illustrations in sentences) are text content,
  not icons, and are kept.
- The scheme toggle's icon is state-reflecting (defect-log row 100,
  replacing the generic `theme` icon from row 83): @rhds/icons
  `light-mode` (sun) in light scheme, `dark-mode` (moon) in dark — the
  icon names the ACTIVE scheme and `applyScheme()` swaps it alongside
  `aria-pressed`; the `&scheme=` deep link boots with the correct glyph.

## Grid, spacing & motion

- Content layout sits on the RHDS fluid 12-column grid base (defect-log
  rows 77 + 93): the top-level card/KPI containers are 12-track CSS
  grids (`repeat(12,1fr)`, `--rh-space-2xl` gutters — 6/4/3-track spans
  by layout; five equal tiles use the centered 10-of-12 placement),
  collapsing to the 2-track `--rh-space-lg` mobile grid below 768px;
  main-content margins use `--rh-space-2xl` (32px), and the page
  footnote is capped at the 789px line-length best practice. The app
  shell and component internals stay PatternFly 6; content max-width
  stays 1600px (console readability).
- Spacing follows the RHDS space-token scale (defect-log row 79): every
  `margin`/`padding`/`gap` in the mock's own layer uses
  `var(--rh-space-*)` tokens (xs=4, md=8, lg=16, xl=24, 2xl=32, 3xl=48,
  4xl=64, 6xl=96) — no 2/3/5/6/10/12/14/18/26/40px spacers remain. The
  170px wave-stats label indents are deliberate column alignment, not
  spacers; PF6 `spacer--*` tokens still apply inside PF components.
- Persona-landing vertical rhythm (defect-log row 97): the six home
  persona wrappers (`.lp-*`) stack their sections on a uniform 2xl gap
  (`display:grid; gap:var(--rh-space-2xl)`, mobile `--rh-space-lg`) —
  never re-stack sections flush in a plain block wrapper, and don't
  re-add per-element margins (the blurb's old 16px `margin-bottom` and
  two wrapper-level `margin-top` notes were removed as redundant under
  the wrapper gap). Note `.grid12`'s gap only spaces children of one
  grid — separate stacked grids get their rhythm from the wrapper.
- Foundations are token-complete (defect-log row 96): the mock's own
  animations use PF6 motion tokens (`--pf-t--global--motion--*` — the
  toast reuses PF's own m-toast slide-in idiom) and the OS
  reduced-motion setting collapses all durations to 1ms (the media
  block replicating PF's `.pf-v6-m-no-motion` collapse). Colors,
  design tokens, iconography, spacers, theming, typography,
  accessibility, RTL, and the AI guidelines (PF's principles are
  verbatim the RHDS rules the mock follows) are all audited —
  `pf-v6-l-*` layout helpers and PF utility classes remain optional
  conveniences the mock's own token-built layer replaces.

## Components (PF6) & elements (RHDS)

- All components are genuine PatternFly 6 markup, audited against
  patternfly.org/components/overview v6.7.0 (defect-log row 94): page
  titles are `pf-v6-c-title pf-m-xl` `<h1>`s (one per active screen;
  the `.page-title` class is only a margin/JS hook) and drawer/modal
  template headings are `pf-v6-c-title pf-m-lg` `<h2>`s — never
  reintroduce hand-rolled or inline-styled headings. The bell badge is
  `pf-v6-c-badge pf-m-unread` inside the notification menu-toggle
  (PF6's dedicated notification-badge is React-only); menu group titles
  are `<h1>`s per PF6's own examples; deprecated components (Chip, Tile)
  are avoided — Label and Cards instead. Absent components are verdicted
  in the defect log (row 94): no modeled flow requires them, a stronger
  in-use component covers them, or they are React-only/marketing-scope.
- Elements follow the RHDS elements catalog as implemented by PF6
  (defect-log row 81): the mock carries a RHDS-pattern skip link (PF6's
  `pf-v6-c-skip-to-content`, first focusable element, targets the
  `<main id="mtaMain">`) — keep it first in `.pf-v6-c-page` if the shell
  changes. Filter "chips" are PF6 labels with close buttons — correct,
  since PF6 removed its chip component; never hand-roll chip CSS.
  Tooltips (annotation tips) must keep showing on keyboard focus, not
  only hover. One `<main>` landmark only — drawer/modal content stays
  `<div>`-based (row 85).
- Per-element guidelines audit (defect-log row 87): every RHDS element
  the mock uses has been audited against its `/guidelines/` page.
  Durable rules: exactly ONE `pf-m-primary` button per view (secondary
  actions demote); icon-only compact menu toggles need a descriptive
  `aria-label`, and multi-select toggles/inputs derive labels from their
  `data-label`; menu dropdown groups stay ≤7 items (use
  `pf-v6-c-menu__group` headings); code blocks ≥5 lines ship an
  Expand/Collapse button in the header, collapsed by default
  (`codeblock-collapsed`, `aria-expanded` synced) — short blocks get no
  button; pagers hide entirely on zero results (RHDS Pagination: never
  display pagination for an empty list — the inventory pager and the
  shared `pagerApply()` set `[hidden]`, backed by
  `.pf-v6-c-pagination[hidden]{display:none}`). Accepted deviations
  (do not "fix"): tablists with 6–8 tabs
  (console IA), `.anno` tip prose longer than tooltip-length (they are
  popover-like annotations), dashboard card titles over 20 chars.
- Remaining catalog elements audited against their `/guidelines/` pages
  (defect-log row 88): native `<select>` form inputs always carry the
  `pf-v6-c-form-control` class (never ad-hoc inline styling), sidebar
  nav links keep their leading icons and unmodified caret icons, and
  icons stay ≤100px. Accepted deviation: 9 sidebar items vs the RHDS
  primary-nav max of 5 (console IA, mirrors the real MTA console).
  Formally absent: Blockquote, Call to action, Footer, Jump links,
  Subnavigation, Tile (absences verified in row 88; Button-group rules —
  ≤3 buttons, ≤1 primary per cluster — apply to the mock's modal/wizard
  footers even without the component).
- Overview + style pages for all in-use elements audited against the
  distilled RHDS specs (defect-log row 89; note: overview content lives
  at the bare `/elements/<slug>/` URL — `/overview/` 404s). Durable
  focus/behavior rules: dialogs move focus inside on open, trap Tab
  while open, and restore focus to the opener on close; menu-dropdowns
  move focus to the first menu item on expand and return focus to the
  toggle on Escape or item selection (the typeahead select-wrap filter
  menus keep focus in their input by convention but close on Escape);
  every code-block header carries a Copy action beside Expand/Collapse
  (clipboard write with "Copied!"/"Copy failed!" feedback). Alerts keep
  the icon+title minimum and carry no dismiss action (Warning/Danger are
  resolve-only). Accepted deviations: tooltip 300ms delay + arrow
  (popover-like `.anno` annotations), Statistic red data-text, Card
  titles as `div`s (PF6-native markup), no table `<caption>`.
- Gap-inventory pass over the remaining RHDS surfaces (defect-log
  row 91): disabled menu items carry `aria-disabled="true"` instead of
  the `disabled` attribute (items stay focusable/readable; the click
  guards in the handlers no-op them); hover/focus-revealed `.anno` tips
  are Escape-dismissable (WCAG 1.4.13); AI-generated run records carry
  the RHDS dual indicator — `ai-experience` sparkle + "AI-generated"
  (`.ai-marker`, purple `--rh-color-purple-60`, flipping to
  `--rh-color-purple-30` in dark). Verified: `<html lang>` tracks
  `setLang`; no robot icons on non-chat AI; no AI-specific colors or
  gradients; form errors state location, cause, and fix. Deliberate
  differences (recorded, do not "fix"): no Breadcrumb (the tenancy path
  is a state switcher, not page navigation), no Back to top (no screen
  exceeds the >2-screens threshold — measured), risk labels instead of
  Health-index A–F boxes, no Avatar/Spinner/Popover (no user photos, no
  async loading, element is Planned), and the marketing elements
  (Announcement, Audio player, Readtime, Site status, Video embed) plus
  the Personalization section and theming variants (Customizing, Color
  Palettes, Project Felt) are out of console scope.

## Tables

- Tables follow the RHDS Table guidelines (defect-log row 86): unsorted
  sortable columns show the RHDS `<rh-sort-button>` glyphs when unsorted
  (the stacked double-triangle "both arrows visible" state, `viewBox`
  320×512 — defect-log row 92; single triangles when sorted),
  `aria-sort` cycles none/ascending/descending,
  table-bearing card bodies scroll horizontally
  (`.pf-v6-c-card__body:has(> .pf-v6-c-table)`), and every table declares
  a `<th>` for each column its tbody renders (no one-column tables, no
  header/body mismatches). Header labels stay 1–2 words.

## Patterns

- Patterns follow the RHDS patterns catalog (defect-log row 82): toasts
  are non-blocking `role="alert"` alerts, tabs/filter/forms/search are
  PF6-native, tiles stay cards (PF6 removed Tile), and collapsible
  panels support the Accordion pattern's URL-fragment expansion —
  `&open=<id>(,<id>…)` in the deep-link hash expands accordions and
  disclosures by id (expand-only; works across drawer-template
  contents). New collapsible panels should carry an id so they are
  deep-linkable; Sticky banner/card and Logo wall are marketing
  patterns with no console place.
- Pattern usage follows the PF6 patterns catalog (defect-log row 95):
  deletion triggers are secondary-styled (danger reserved for the
  confirmation modal's submit), bulk "Select none" disables at zero
  selection, the toolbar owns select-all, and selection persists after
  a bulk action; the Arabic locale flips the layout via `dir=rtl`
  (verified: mirrored sidebar, toolbar, pagination) with clean
  masthead-title truncation in both directions. The masthead ☰ toggle
  collapses the sidebar (`display:none` + `grid-template-columns:0 1fr`)
  and — since defect-log row 102 — pins the main pane to grid column 2
  while collapsed: hiding a grid sibling removes it from auto-placement,
  so without the explicit pin main falls into the 0-width track. The
  toggle is catalogued as **Suggestion 53** in
  `evidence/mta-improvement-suggestions.md` (§3.38 — per-user persistence is
  part of the proposal; the mock's state is session-only, defect-log row 103)
  and carries the `#53` annotation badge on the masthead toggle.
- Pattern overview/style specs audited (defect-log row 90): RHDS
  patterns have no `/style/` or `/overview/` sub-pages (style guidance
  is a section inside the single pattern page; tabs and tag are stubs
  whose spec-bearing content is `/examples/`). The toast now follows the
  RHDS Toast style page: fixed top-right corner below the masthead,
  `--rh-box-shadow-xl` drop shadow, slide-in animation, a mandatory
  close button (`rbacToastClose()`), and 8s auto-dismiss — still
  `role="alert"` and non-blocking. Filter clear-all keeps its selected
  count; form required-asterisks sit right of the label; search
  placeholders set their scope. Accepted deviations: >10-option
  "+5 at a time" disclosure and <768px filter collapse are implemented
  as PF6 scrollable menus / toolbar wrapping, and the 4–8-column form
  span is superseded by PF6 drawer/modal widths.

## Theming (color schemes)

- Theming follows the RHDS model (defect-log row 83): the console ships
  a light/dark **color scheme** (RHDS terminology — never "theme"):
  the masthead palette toggle applies PF6's `pf-v6-theme-dark` class,
  persists, and deep-links via `&scheme=`. Dark-mode overrides for the
  mock's own crayon surfaces live in the `html.pf-v6-theme-dark` block;
  interactive color on dark comes from RHDS's
  `--rh-color-interactive-primary-*-on-dark` tokens. Light must stay
  byte-identical to the pre-row-83 rendering. The masthead (and the
  annotation tooltip) are fixed dark chrome in BOTH schemes — pinned to
  `--rh-color-gray-{80,70}` because the PF inverse tokens are
  scheme-relative and flip to light under `pf-v6-theme-dark` (row 84);
  on-brand masthead text (selected persona pill, logo tile) flips to
  `--rh-color-gray-95` in dark. Never use scheme-relative inverse
  tokens for chrome that must stay dark in both schemes. The feature is
  catalogued as **Suggestion 52** in
  `evidence/mta-improvement-suggestions.md` (§3.37, promoted from
  design-conformance chrome — defect-log row 101) and carries the `#52`
  annotation badge on the masthead toggle.

## Interactions

- Interactions follow the RHDS guide (defect-log row 78): one uniform
  focus ring for every interactive element (solid 3px
  `--rh-color-border-interactive`, 3px offset, `transition:none`,
  `:focus-visible` only — UA defaults and invisible `outline:none`
  inputs eliminated), inline links keep PF6's brand-aligned dashed
  underline, and external links no longer force new tabs (the two
  workspace `.md` companion files still do — opening them in-place
  would replace the mock).

## i18n

- i18n covers UI chrome, descriptive attributes, and composed
  sentences (defect-log row 99): all 8 locales translate the static
  chrome and the descriptive `aria-label`/`title` attributes —
  attributes ride the text walk through `i18nWalkAttrs()`/`i18nA()`
  (exact dict + rules only, never the phrase pass) with an
  EN-original cache so locale switches re-translate from English and
  JS rewrites re-cache; JS-set aria-labels are wrapped at source.
  `trNode` refuses identifier-shaped tokens (single token with code
  punctuation and a letter) and the phrase-pass boundary blocks
  compound-token punctuation (`-_/@`), so dict words never substitute
  inside data identifiers (`orm-runtime`, `mig-execute` stay intact in
  every locale). Residual untranslated nodes are JS-rendered data-feed
  cells and proper nouns — data stays data by design; annotation
  content stays English via `I18N_SKIP` (row 58), and the masthead
  brand title, `mockup · real PF6 6.7.0` tag, and the switcher's
  English descriptions are pinned `data-i18n-skip`.
- The language switcher lists languages only (defect-log row 98): no
  country flags or country lists (`LANG_META` = native name + English
  description); the masthead toggle shows the bare native name.
  Display currency derives from the active locale (`I18N_LANG_CUR`,
  USD default) with the persisted/deep-linkable override on top —
  never re-couple it to a country list. The masthead content cluster
  shrinks to the viewport in a single row (scope labels ellipsize with
  a 7ch floor; the language toggle never shrinks) — do not reintroduce
  `flex:0 0 auto` there, which pushed the switcher off-screen.

## Masthead & feature-specific chrome

- The masthead groups its controls by nature (defect-log row 76): a
  demo cluster (persona switcher, Annotations switch, Suggestions
  index) sits left next to the brand tag, and the proposed console UX
  (scope, tenancy, task queue, notifications, language, help) sits
  right of a vertical divider — mockup affordances vs product features
  at a glance.
- The Import-applications wizard's left nav shows each step number once —
  in PF6's `::before` counter badge (the numbered circle) — with bare step
  names beside it ("Source", not "1. Source"); the "N. " text prefixes
  duplicated the badge (defect-log row 104, fixed in the mock and the
  ui-react port; dict keys renamed to the bare names across locales).
- Agent-run records carry per-stage loop telemetry (defect-log row 105):
  the Agent runs table has **Turns** and **Context** columns (agent-loop
  turns; context-window usage as `current / window (percent)` — 128k for
  granite-3.3-70b, 200k for frontier-70b), the run-record modal and the
  workflow-run modal's stage cards repeat the figures (live-labeled while
  a stage runs), and the canonical WR-8 stage records reuse the sampled
  full record's numbers byte-identically so the views cannot disagree.
- Seven more tables page through the shared pager (defect-log row 106):
  Workflow runs, Agent runs, Agents, Skills, Workflows, Credentials and
  Risk provenance gain the standard pagination widget (10 per page,
  per-page menu, first/prev/input/next/last) in display-toggle mode —
  rows stay in the DOM, so record jumps and Reports rollups keep working
  and both run jumps now land on the page carrying the record. The
  inventory bulk bar gained a two-step **Delete** (armed confirm, one
  attributed audit record for the batch, danger toast), and queuing is
  state-gated: only applications in **Not started** or **Succeeded**
  state can be queued — the bulk Queue option, the per-app detail
  modal's Queue button, and the invoicing template's grey out otherwise
  (with an explanatory tooltip), and a bulk queue skips unqueueable
  apps and says so.
