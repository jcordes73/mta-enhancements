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
- **Docs** — `design/design.md` §19 queue-gating rule marked
  implemented; hub-backend README contract bullets updated.
- **Repo** — workspace published to `github.com/jcordes73/mta-enhancements`
  (local history rebased onto the GitHub root; `AGENTS.md` header
  reflects the remote).

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
