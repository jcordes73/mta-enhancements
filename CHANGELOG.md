# CHANGELOG — behavior changes

One reverse-chronological clause per behavior change, with defect-log
row references. **Convention (since 2026-11-17):** every mock/port/backend
behavior change appends its clause here instead of README.md — the
defect-log row ([`deliverables/ui-mockup/use-case-verification.md`
§4](deliverables/ui-mockup/use-case-verification.md), append-only, one
line per row) remains the detailed evidence record; this file is the
what-changed-when index. Long-form design-system rules:
[`deliverables/ui-mockup/design-system-rules.md`](deliverables/ui-mockup/design-system-rules.md).

## 2026-11-17

- **Analysis Profiles — the last whole-surface parity gap closed (defect row 130)** — the live
  8.3.3 `/analysis-profiles` surface (recorded as a gap in the re-audit) now has a mock
  counterpart on Config → Analysis: a management table over a new `MOCK_APROFILES` store
  (the live sample "JBoss EAP 7.4 to JBoss EAP 8" verbatim + two profiles matching the
  archetype table's `profiles` strings) plus a create/edit wizard modal over the real PF6
  wizard skeleton walking the live step set (required-Name gate, the two live source options,
  Set Targets with the live skip-warning, Scope, Custom Rules with the live
  "required if no targets" Next-gate, Review/Finish). Assignment writes through to
  `MOCK_ARCHETYPES.profiles` (archetype table Profiles column + detail rows); delete is the
  armed idiom; mutations audited (`profile:create/update/delete`) and RBAC-gated
  (`profiles:edit`). Recorded simplifications: the un-crawlable live Advanced/Labels panels
  fold into Scope/Review, target catalog is a 10-entry subset. Also restored two §7.1 records
  (Analysis-profiles row + app-form delta) that a stale-snapshot bug in the re-audit session's
  Python edits had silently dropped while its commit message claimed they landed. Verified:
  `verify/verify-aprofiles.js` (37 assertions), full battery 22/22.
- **Token administration on the mock's Config → Access tab (defect row 129)** — the static
  2-row Tokens card became a full management surface mirroring the live console's `/tokens`
  column set (ID/Login/Kind/Scopes/Issued/Expiration/Lifespan hours) plus the management half
  comment 9 (enhancements#266) called for: search, kind filter, show-expired toggle, summary
  line, sortable headers, pagination, and single/cross-page-bulk revoke through the previously
  stubbed `modalRevoke` dialog — every revocation audited (#42) and RBAC-gated
  (`tokens:revoke`). Answers the #35 pain point (13,500 rows, no bulk cleanup). The Agentic
  "rotate under Tokens" link now routes to the tab. New suite `verify/verify-tokens.js`
  (35 assertions); full battery 21/21 green.

- **Parity audit re-executed against the live 8.3.3 console (§7 re-audit)** — headless-Chrome
  crawl of the sandbox instance (version 8.3.3 re-confirmed, admin persona): 17 navigable routes
  re-verified column-for-column against the mock (supersets only), the application create-form's
  new Source-platform/Asset-repository fields folded into §7.1's omission list, a **new upstream
  Analysis Profiles view** recorded as a §7.1 gap, and the URL-only Users/Tokens/Roles/Scopes
  views (no nav entry upstream) documented in §7.2. Crawl evidence checked in
  (`parity-crawl-2026-11-17.json` + About/create-modal screenshots).

- **Agent-run telemetry (mock row 105)** — every agent-run record gained
  `turns` and context-window usage (`current / window (percent)`); the
  Agent runs table gained **Turns**/**Context** columns, the run-record
  and workflow-run modals repeat the "Agent loop N turns · context …"
  line (blue **live** label while a stage runs), and the canonical WR-8
  stage records reuse the sampled record's numbers byte-identically.
- **Pagination + bulk delete + queue gating (mock row 106)** — seven
  tables (Workflow runs, Agent runs, Agents, Skills, Workflows,
  Credentials, Risk provenance) page through the shared pager in
  display-toggle mode (rows stay in the DOM; record jumps are
  page-aware); the inventory bulk bar gained a two-step armed **Delete**
  (one attributed audit record per batch, danger toast); queueing is
  state-gated — only **Not started**/**Succeeded** applications can
  queue, with greyed controls + explanatory tooltips on the bulk
  button, the app-detail modal, and the invoicing template.
  `applyRbac` landmine fixed: state-gated buttons carry
  `data-gate-disable="1"` so RBAC can no longer re-enable them.
- **hub-backend propagation** — `AgentRun` gained `turns`/`ctxCurrent`/
  `ctxWindow` (+ derived `ctx` display form) seeded byte-identically to
  the mock; analysis queueing enforces the state rule at API level
  (`POST /analyses` → 409 `state.conflict`; `POST /batch/analyses`
  skips and names ineligible apps in `skipped[]`); `DELETE
  /applications/{id}` now cascades through tasks, workflow runs, agent
  runs/events, and wave content (previously FK-fatal for seeded apps);
  realm scopes extended additively; `schema.sql` refreshed per the
  documented pg_dump procedure and verified on a scratch DB; test suite
  25 → **30** (new `AgentRunResourceTest`, queue-gating, cascade).
- **ui-react propagation** — Agent runs table Turns/Context columns +
  modal telemetry via a walker-friendly `LoopTelemetry` (one text node
  per segment); PF6 `Pagination` on the five Agentic tables +
  Credentials + Reports→Risk provenance (10/page, hidden at zero
  results, page-clamped); inventory bulk **Delete** (real
  `DELETE /applications/{id}` per selection, wave-membership 409s
  surfaced per app) and state-gated **Queue analysis** (bulk + a
  functional gated Queue button in the app-detail modal). `tsc` clean,
  `check:i18n` green, production build succeeds.
- **Live verification** — compose stack rebuilt (`--force-recreate`,
  fresh DB volume): API returns mock-identical telemetry, invoicing
  (IN_FLIGHT) → 409 with the explanatory message, mixed batch →
  `tasks: 1, skipped: ['invoicing (IN_FLIGHT)']`.
- **Platform-admin landing stat wall (mock row 107)** — Queue depth, Failed
  tasks and Verification pass rate moved up into the top statistic
  cluster: the padmin Home now opens with a full 8-tile stat wall
  (4+4, `gc3` whole-track spans) before the tenant-portfolio table; the
  org-admin landing keeps the centered 5-tile placement.
- **Platform-admin landing order (mock row 108)** — the Platform health
  card moved above the Organizations — tenant portfolio table: the
  padmin Home now reads stat wall → services status → org drill-down →
  cross-tenant audit trail.
- **Platform-admin landing links (mock row 109)** — every stat-wall tile
  gained a **View details →** footer deep-linking to its owning surface
  (Controls sub-tabs for Organizations/Teams/Audit, Applications, Agentic,
  Task manager, Reports).
- **Platform-admin landing carded stats (mock row 110)** — the 8 stat-wall
  tiles are now real bordered PF6 cards (`pf-m-plain` dropped); both
  schemes verified. The org-admin/program-manager landings keep plain
  tiles.
- **Archetype form dropdowns (mock row 111)** — the archetype create/edit
  form selects **Tags** from the defined tags and **Owners** from the
  stakeholder directory (both multi-selects; org-scoped for non-padmin);
  `eap8`/`jboss` added to the defined-tag store; table header renamed
  Maintainers → Owners; new i18n key synced to the React dict copy.
- **Archetype owner immutable (mock row 112)** — the archetype form's
  Owner is the signed-in user (persona→demo-user mapping) and is locked;
  edit shows the stored owner, equally unchangeable. Table header now
  "Owner"; seeds aligned to single-creator; i18n key synced to React.
- **Archetype criteria/tags typeahead (mock row 113)** — the archetype form
  matches upstream tackle2-ui: **Criteria tags** (required — the membership
  rule) and **Archetype tags** (optional) as typeahead multi-selects over
  the defined tags with chips; the free-text membership rule is replaced;
  dropdown z-index raised above PF6's `::before` chrome (z100) which was
  overpainting open menus.
- **Archetype rows collapsible (mock row 114)** — each row on the
  Archetypes & cohorts table expands to an in-row detail panel
  (description, criteria/archetype tags, owner, profiles,
  assessment/review, live member list) via the PF6 toggle-cell idiom.
- **Archetype cohort dashboard merged into rows (mock row 115)** —
  the below-table card (first archetype only) is gone; each
  archetype's expanded row now carries its own group assessment,
  risk rollup, shared findings, member table (openApp links) and the
  propagate action. `applyTenancy()` now re-renders the archetype
  table, fixing a latent stale-membership staleness on tenancy
  switches.
- **Org-admin stat tiles are real cards (mock row 116)** — the
  organization admin landing's five statistics dropped `pf-m-plain`
  so they render as bordered PF6 cards, matching the platform-admin
  stat wall (row 110).
- **Archetype action buttons in a row (mock row 117)** — the
  Actions cell of the Archetypes & cohorts table wraps its Edit and
  Delete icon buttons in a PF6 Action list so they render side by
  side instead of wrapping onto separate lines.
- **Queued analyses can be dequeued (mock row 118)** — a queued
  analysis leaves the batch queue and returns to its pre-queue state
  (Not started, or Succeeded when the previous results are still
  current); the waiting Task-manager row is removed. Affordances:
  a dequeue link in the inventory row's Analysis cell and a Dequeue
  button in the application modal, both gated by
  `applications:analyze`.
- **i18n: dead identifier-shaped keys revived + Archetypes &
  cohorts fully translated (mock row 119)** — the row-99 identifier
  guard no longer blocks exact dict matches ("re-validate",
  "Wave-assigned", "quota-blocked" translate again); the cohorts
  screen's remaining chrome (headers, detail labels, head line,
  risk/review rollups, toggle aria-labels, tab label) gained keys
  and per-locale rules in all 7 locales.
- **Docs** — `design/design.md` §19 queue-gating rule marked
  implemented; hub-backend README contract bullets updated.
- **Repo** — workspace published to `github.com/jcordes73/mta-enhancements`
  (local history rebased onto the GitHub root; `AGENTS.md` header
  reflects the remote).

- **Hebrew as the 9th locale — full parity (mock row 120)** — the
  language switcher gains עברית with the same coverage as the other 7
  locales (1,085-key dict, 64 rules, gate-fragment block, ILS currency,
  `D MMM` dates) and flips the layout RTL like Arabic;
  `fmtDate`/`fmtDateRange` handle he. The React port mirrors it:
  `src/i18n/i18n.ts` dict+rules+gate+meta, a 36-key `he` block in
  `scripts/i18n-additions.json` (plural pairs included), and
  `check:i18n` passes at 38 keys × 9 locales. Seed data, incident text,
  identifiers, and annotation content stay English by design.

- **Brazilian Portuguese as the 10th locale — full parity (mock row 121)** — the
  language switcher gains Português (pt-BR wording, LTR) with the same
  coverage as the other locales (1,085-key dict with exact key-set parity,
  64 rules modeled on the es array, gate-fragment block) and derives BRL
  currency (R$, Brazilian grouping 1.234,56); `fmtDate`/`fmtDateRange`
  need no pt case — the new `I18N_MONTHS` pt line feeds the default
  `MMM D` branches. The React port mirrors it: `src/i18n/i18n.ts`
  dict+rules+gate+meta (the fused he/tr dict line was split while
  mirroring), a 36-key `pt` block in `scripts/i18n-additions.json`
  (plural pairs included), and `check:i18n` passes at 38 keys × 10
  locales. Seed data, incident text, identifiers, and annotation content
  stay English by design.

- **Custom root CAs for LLM gateways, on the UI (mock row 122)** — TLS trust
  becomes first-class on two surfaces: the Add-identity modal gains an
  optional `CA bundle (PEM)` upload with real parsing (fingerprint +
  validity feedback, named errors), and the gateway registry (Agentic →
  Gateways and Administration → Automation, one store) gains a `CA trust`
  column, a data-driven Health state with the cause spelled out, a real
  `Test connection` action, and a blast-radius confirm (`modalGwTrust`)
  for applying/revoking trust with re-test-on-apply. Follows upstream
  tackle2-hub#1141 (CA rides the identity) and #1015 (per-connection
  trust); deliberately no skip-verification option — the tracker insecure
  toggle stays legacy-only. New chrome copy is EN-only this row.
- **Archetype cohort detail: description left, sortable + pageable member
  table right (mock row 123)** — expanding a cohort row in Applications →
  Archetypes & cohorts now splits into a two-column layout (`.arch-detail-cols`,
  stacks below 1100px): the archetype facts stay left, the member table moves
  right with RHDS sortable headers (default Risk descending — High → Medium →
  Low, unassessed last, name tiebreak; same-key clicks toggle, switching keys
  re-applies that key's default) and a full pager (totals, per-page 3/5/10,
  first/prev/page-input/next/last). Sort/page state rides the archetype record
  so the lens survives re-renders; the pager hides when a cohort fits on one
  page (recorded deviation beyond the row-87 zero-results rule). New chrome
  copy is EN-only this row.
- **Task-manager checkbox no longer opens the drawer (mock row 124)** — the
  task rows' click-to-open handler fired before the checkboxes' change-time
  `stopPropagation`, so checking any task checkbox opened the task drawer;
  the checkbox inputs now stop the click at the source (7 static rows + the
  queue-created-row template). Selection and the Cancel-selected counter are
  unchanged; clicking elsewhere on the row still opens the drawer.
- **Administration sub-tabs (mock row 125)** — Controls consolidates its eight
  one-card sub-tabs into four grouped ones (People & roles / Landscape /
  Organization / Audit trail), Registries turns its three side-by-side cards
  into full-width sub-tabs, and Automation groups its four stacked cards into
  Gateways / Agent registry / MCP server & Hub API. Sub-tab state is
  deep-linkable via `&sub=`; the platform-admin landing and Agentic deep links
  target the right sub-tab; the organizations RBAC guard moved from the tab to
  the card (greyed with the cause spelled out — Teams/Departments stay
  usable). New chrome copy is EN-only this row.
- **Task drawer annotations now follow the switch (mock row 126)** — a stale
  exemption from the removed Suggestions drawer forced `#N` bubbles and
  "Implements:" footers visible in every drawer even with Annotations off;
  drawer annotation content now obeys the masthead switch like every screen.
- **Wave member tables: sortable + pageable (mock row 127)** — the
  applications table in each wave's expandable detail gains RHDS sortable
  headers (Application / Effort / Risk / Agent spend) with Risk descending as
  the default (High → Medium → Low, unassessed last — the row-123 contract),
  and the full pager (totals, per-page 3/5/10, first/prev/page-input/next/
  last). The lens survives re-renders; tfoot totals keep spanning the whole
  wave (and the totals row gained its missing 6th cell). New chrome copy is
  EN-only this row.
- **Dead-link audit, all personas (mock row 128)** — a scripted sweep of all
  10 screens × 6 personas (link classification, anchor resolution, inline
  handler checks, click pass): one true dead group — the Custom rulesets
  row's `Edit · Download` links — now carries the recorded deliberately-inert
  idiom (`onclick="return false"`) with hover tooltips explaining why; the
  wizard's step links proved wired (naive-pass false positive). Zero
  undefined handlers, unresolved anchors, or click errors anywhere else.

## 2026-11-16

- **hub-backend created** — Quarkus 3.40 + PostgreSQL implementation of
  the Tackle Hub API contract v2.1: core inventory/controls resources,
  console-extension entities (gateways, skills, agents, workflows,
  workflow/agent runs + events, platforms, targets, wave
  dependencies/evidence/tickets, `/report/trend`), tenancy clamp,
  audit trail, SSE. **Keycloak everywhere**: checked-in realm
  (`keycloak/mta-realm.json`), Dev Services in dev/test, Organizations
  feature with the `sync-org-members.sh` bootstrap (realm import drops
  members — keycloak#54343); 25-test suite against DevServices.
- **ui-react switched to the live API** — every screen reads the
  backend through `src/api/hub.tsx` (hard dependency, error + Retry
  state), authenticated with Keycloak PKCE; roles define the persona
  (the mock's persona switcher is gone); tenancy comes from token
  claims; dual-engine i18n (react-i18next with natural keys for
  migrated surfaces + the legacy walker for the rest).
- **Inventory at mock parity** — tabs (incl. Archetypes), filter
  toolbar, bulk selection with Assign-to-wave / Queue analysis,
  sortable table, saved-view chips, app-detail modal, Create/Export/
  Import — all against live data.
- **Mock row 104** — the import wizard's left nav showed each step
  number twice (PF6 `::before` badge + literal "N. " prefix); prefixes
  dropped, dict keys de-prefixed across locales, fixed in the mock and
  the ui-react port.
- **Mock rows 102–103** — masthead ☰ toggle fixed (hiding the sidebar
  grid sibling moved main into the 0-width auto-placed track; main now
  pins to grid column 2 while collapsed) and promoted to **Suggestion
  53** with the `#53` annotation badge.
- **Evidence doc refreshed** — per-suggestion status columns folded
  away (2026-11-16 "Updated" revision).

## 2026-11-15

- **PF6 component audit (row 94)** — all 36 in-use `pf-v6-c-*`
  components verified against patternfly.org v6.7.0; PF6 Title
  component rules pinned for all headings.
- **PF6 pattern audit (row 95)** — all 12 PF6 patterns verified;
  deletion triggers secondary-styled, bulk select-none disabled at zero
  selection, selection persists after bulk apply.
- **Motion tokens (row 96)** — mock animations moved to PF6 motion
  tokens; `prefers-reduced-motion` collapse added (replicating PF's
  `.pf-v6-m-no-motion` on `:root`).
- **Landing rhythm (row 97)** — the six persona-landing wrappers now
  stack sections on a uniform 2xl gap (were flush 0px between separate
  grids).
- **Language switcher (row 98)** — countries and flags removed
  (languages only); currency documented as locale-derived; masthead
  content-cluster shrink chain fixed an off-screen switcher at 1600px.
- **i18n completion (row 99)** — ~1100 new dictionary keys, attribute
  translation (`i18nWalkAttrs`/`i18nA` with EN-original cache),
  identifier guard + compound-token phrase-pass boundary (dict words
  never substitute inside `orm-runtime`-style identifiers), AR/JA mixed
  partials reduced to data-feed cells by design.
- **Scheme toggle icon (row 100) & Suggestion 52 (row 101)** — the
  toggle carries the state-reflecting sun/moon pair; dark/light mode
  promoted from conformance chrome to catalog **Suggestion 52** with
  the `#52` annotation badge.
- **Tooling** — PatternFly MCP server installed globally (official docs
  source for PF6 API questions); RHDS-vs-PF6 governance split
  re-verified verbatim against ux.redhat.com.

## 2026-11-13 / 14

- **Full RHDS audit (row 73)** and the design-system adoption campaign,
  each a user decision recorded in AGENTS.md and the defect log:
  crayon palette (row 74 — zero raw hex in the mock's own layer),
  official Red Hat icons (row 75 — `@rhds/icons` inline SVG, no
  `<rh-icon>`), masthead grouping (row 76), RHDS fluid 12-column grid
  (rows 77+93), interaction guide (row 78 — uniform 3px focus ring, no
  forced new tabs), spacing scale (row 79 — RHDS space tokens only),
  remaining token categories (row 80 — type/shadow/radius/opacity),
  elements parity (row 81 — skip link, label-chips, focus-showing
  tips), patterns parity (row 82 — `&open=` accordion deep links,
  non-blocking toasts), theming (row 83 — light/dark scheme toggle,
  `pf-v6-theme-dark`, persisted + deep-linkable), masthead dark-chrome
  fix (row 84 — scheme-independent gray pins replacing inverse tokens).
- **Consolidated full-mock audit (row 85)** — both schemes, contrast
  sweeps, landmark/typography/a11y checks; four defects fixed (second
  `<main>`, raw `#fff`s, dark gantt labels, dark anno badges).
- **Table guidelines (row 86)** — unsorted sort indicators rebuilt as
  the RHDS double-triangle glyph (row 92 follow-up), one-column table
  fixed, horizontal scroll for table-bearing card bodies.
- **Per-element guidelines audit (row 87)** — one primary button per
  view, descriptive aria-labels on compact toggles, menu groups ≤7,
  code-block Expand/Collapse, pagers hidden at zero results.
- **Element/style/pattern audits (rows 88–91)** — remaining elements
  verdicted (selects classed, nav icons, formal absences), focus
  trap/restore rules, RHDS Toast style (8s auto-dismiss, mandatory
  close), disabled-menu `aria-disabled`, Escape-dismissable tips,
  `.ai-marker` dual AI indicator.

## 2026-11-12 (and earlier)

- **Verification harness stood up** — jsdom suites in
  `deliverables/ui-mockup/verify/` + headless-Chrome probes; the
  use-case catalog (§2–6) and the live MTA 8.3.3 parity audit (§7,
  2026-11-12) grounded the mock in the real console and the live Hub
  API (stakeholder groups, business services, controls CRUD).
- **First i18n passes (rows 58–72)** — annotation content pinned
  EN-only, search placeholders, Migration-waves view, token/gate
  translations and the translation-tooling row-58 harness note.
