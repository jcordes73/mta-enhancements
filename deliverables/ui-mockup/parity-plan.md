# Parity plan — making the UI mock fully "functional" against MTA 8.3.3

**Date:** 2026-11-12
**Baseline:** §7 parity audit in `use-case-verification.md` (headless-Chrome crawl of the live
`mta-openshift-mta.apps.ocp.2xhp7.sandbox1251.opentlc.com`, MTA 8.3.3, 123 applications, 494 tasks).
**Scope decision requested:** close the mock's parity gaps so it models the *whole* console, not
just the journey slices the suggestions doc socializes.

---

## 0. The one architectural change that makes "functional" possible

> **Status: core DONE 2026-11-12.** `MOCK_APPS` (applications array) is the single source of
> truth for the Applications table; `renderInventory()` renders it and is verified **byte-equal
> to the original hand-written markup** (all 12 rows, attrs + per-cell HTML). CRUD mutates the
> store and cascades (see WP4). The remaining registries (waves/tickets/agents/…) are still
> hand-written and stay on the plan until their work packages land.

Today the mock is **static HTML + 297 inline `onclick` handlers**; only two fragments are rendered
*from data* (`buildWaveMembers()` from `#invBody`, and the Dependencies clone). Every table is
hand-written markup. That works for a read-only journey mock, but you cannot create, edit, or
delete rows in hand-written HTML without the copies drifting apart — the exact defect class we
just spent defects #13–#17 eliminating.

**Recommendation: extract a small in-memory data layer and render every table from it.**

- One `MOCK_DATA` object: `applications[]` (the 12 rows, carrying `data-*` attrs today),
  `waves[]`, `tickets[]`, `incidents[]`, `archetypes[]`, `businessServices[]`, `stakeholders[]`,
  `tags[]`, `agents[]`, `skills[]`, `workflows[]`, `workflowRuns[]`, `gateways[]`, `tasks[]`,
  `sourcePlatforms[]`, `identities[]`, `migrationTargets[]`, `questionnaires[]`.
- One `renderTable(id, rows, columns)` helper + the existing builders, so **every table on every
  screen renders from `MOCK_DATA`**. This generalizes the `buildWaveMembers()` pattern that
  already made the wave card unable to disagree with the Applications table.
- CRUD handlers mutate `MOCK_DATA` and re-render; **cross-surface consistency becomes a property
  of the architecture** (delete an application → it disappears from its wave, its cohort counts,
  its tickets, and its dependencies by construction). That turns the "reconciles three ways"
  claims from §5 into something a demo can *show live*.
- State survives navigation in-session; a "Reset demo data" action restores the sample
  (honesty note: still a 12-app sample, full-portfolio numbers stay labeled).

Estimated effort: ~1.5–2 days, touches every table but is mechanical after the first three.

## 1. Work packages (priority order)

Each package lists what it closes from the §7 audit, the fidelity bar (per the mock's convention:
surfaces work, forms validate but mutations are in-memory), and the suggestions it anchors.

### WP1 — Agentic section (closes the largest gap; 6 upstream routes)

> **DONE 2026-11-12.** New first-class "Agentic" screen (nav section between Reports and
> Administration, `#scr=agentic&tab=…` deep links plus all six upstream routes as legacy hashes)
> with the six upstream registries at their crawled column sets: Agents (Name/Image/Gateways/
> Skills/Params/Ready/Age), Skills (Name/Display/Description/Type/Source/Ready/Tags/Age),
> Workflows (Name/Stages/Guide/Ready/Age), Workflow runs (Name/Workflow/Application/Phase/Stages/
> State/Age/Duration), Gateways (Name/Provider/Model/Endpoint/Context window/Credential/Ready/Age),
> Agent runs (Name/Agent/Application/Phase/Reason/State/Age/Duration). One store per registry;
> the Reports agent-runs rollup and the Config gateway-usage showback card re-render from the
> same stores (`renderAgentRuns()`/`renderGateways()`), so all three surfaces cannot disagree.
> CRUD: create modals for agent/skill/workflow (required-name + duplicate validation), workflow
> runs and agent runs queue real records (the workflow select lists ready workflows only), two-
> step deletes guarded while skills are agent-bound and workflows have run history, and upstream's
> "Delete finished (N)" bulk action live-counts and clears finished runs (Reports re-renders).
> Run rows open the parameterized run record (defect #14 lesson): failed runs surface their cause
> (#3), token/cost/gateway/image accounting per run (#20/#28); the canonical #21 template stays
> for the full proposal/sandbox story. Bonus fix (defect #21): the four automation-tab links
> pointing at the never-existing `scr-agents` screen threw on click — re-pointed. Verified jsdom
> (28 assertions: tab walk, CRUD, guards, drawer identity, deep links) + Chrome (harness35:
> single-line tabs, 0.0px alignment across 6 tables, 560px modal, 470px drawer). See UC-AD5.
Add an "Agentic" nav group with a tabbed screen (Agents · Skills · Workflows · Workflow runs ·
Gateways · Agent runs) — the mock's established tab pattern (Config, Reports) keeps it to one
screen. Data largely exists: sampled agent runs already live in Reports (`rpt-agents`), gateway
usage in Config (`cfg-automation`); promote both into the new screens and extend with 3–4 sample
rows each (name/image/skills/ready/age; provider/model/endpoint/context window; workflow stages).
Agent-run rows open a drawer parameterized like `openIncidentDetail` (phase, reason, duration,
token accounting — feeds #29/#39). Gateways link to Config → tracker-style health (#33 pattern).
*Anchors:* #16 (AMF/A2A), #19 (MCP catalog), #20 (MaaS inference), #28/#29 (prompt templates,
guardrails), #39 (agent harness), #49 (workflows).

### WP2 — Archetypes management (upgrade the existing cohorts tab)

> **DONE 2026-11-12.** Management table (upstream column set incl. Profiles/Assessment/Review)
> above the group dashboard, which stays the detail view; tab renamed "Archetypes & cohorts".
> "Create archetype" form modal (Name*, Description, Tags, Maintainers, membership rule #46
> item 6); Edit; two-step Delete **guarded** — occupied archetypes are refused with the member
> count. Member counts computed live from `MOCK_APPS`: renaming cascades into inventory rows
> (`data-archetype` + cell text) and the inventory's archetype filter menu by re-render; a
> per-row "re-validate" verb recomputes membership on demand. Verified jsdom + Chrome
> (harness32: 101px rows, 0.0px column alignment, 560px modal). See UC-A3/UC-A8.
Extend `inv-cohorts` into upstream `/archetypes` parity: table columns Maintainers, Profiles,
Assessment, Review; "Create new archetype" modal (validating, in-memory mutation); membership-rule
editing already exists as a concept in #45/#46 item 6 — surface it as an editable rule line per
archetype with the existing "re-validate" verb. The group dashboard stays as the detail view.
*Anchors:* #45 (archetype lifecycle), #46 item 6.

### WP3 — Assessment & Review loop (the workflow the mock skips entirely)

> **DONE 2026-11-12.** Assessment + Review columns added to the Applications table (now 10
> columns; every cell-index consumer updated — `invRowRisk`, `invRowBsvc`, `buildWaveMembers`,
> hover cards — and the wave-aggregate separator polished while there). Assessment opens the
> questionnaire drawer parameterized to the clicked app (defect-#14 identity rule); Review is a
> sign-off modal with the adoption plan and role-gated verbs (#41: migrator is read-only with
> the missing-scope note). Reports gains a 7th tab "Questionnaire answers" (upstream /reports
> grid, 7 sampled rows honestly labeled); Config → Analysis gains answer-session links. Verified
> jsdom + Chrome (harness33: 0.0px header alignment across 10 columns, 106px rows, 470px drawer,
> 560px modal). Fresh row reference: inv-rows-reference-wp3.json (12×10). See UC-A9.
Add Assessment + Review columns to the Applications table (upstream parity), an **Assessment
detail drawer** (questionnaire answers → risk → adoption plan, upstream's `/reports` grid as the
aggregate view), and a **Review sign-off** action with the role-gated verbs the incident detail
already uses. The questionnaire definition in Config → analysis gains "answer session" links.
*Anchors:* #32 (assessment risk + analysis risk in one view), #45, #36 (architect persona).

### WP4 — Application CRUD (create / edit / delete)

> **DONE 2026-11-12** (scoped: the form carries Name*, Description, Business service, Tags,
> Repository type, Wave — not upstream's full 16-field set; bulk wave-assign is display-only
> upstream, so the form's Wave select is the one-step equivalent, annotated #46). "Create new"
> toolbar button; Edit/Delete in the app detail modal and both canonical detail templates;
> two-step delete (native `confirm()` is auto-dismissed headless). Verified jsdom + Chrome:
> validation (empty/duplicate name), prefill, cascade to wave membership and per-wave
> Analysis/Risk/Effort aggregates (cust-portal delete: Wave 4 effort 1,579 → 689). See UC-X10.
"Create new" modal with upstream's field set (Name, Description, Business service, Manual Tags,
Owner, Contributors, Comments, Repository type, Source Repository, Branch, Root path, Group,
Artifact, Version, Packaging); row kebab (Edit, Delete with confirm) alongside the existing
drawer-open. Deletions must cascade visually — the data layer makes that free. Keep platform,
creds, repo, tags as the existing `data-*` fields.
*Anchor:* upstream parity; demonstrates #33's bulk-operations API story.

### WP5 — Controls (organization) as a Config tab with the five upstream tabs

> **DONE 2026-11-12.** New "Controls" Config tab (hub 7→9 tabs with WP7) with five nested
> sub-tabs (Stakeholders / Stakeholder groups / Job functions / Business services / Tags) and
> `MOCK_BSVCS` extracted so the Applications BSVC filter menu, the application form's select,
> and the Controls management table read one array (rename/create/delete cascade everywhere).
> Stakeholder and business-service deletes are guarded while waves/apps cite them (guided
> `ctrlMsg` alert names what still points there). Verified jsdom (sub-tab walk 5/5, CRUD +
> guards + cascades) and Chrome (tab rows single-line, 0.0px table alignment, modal geometry).
> See UC-AD4.
Stakeholders · Stakeholder groups · Job functions · Business services · Tags, as compact
management tables (2–3 sample rows each). Extract `businessServices[]` so the Applications
BSVC filter, the wave aggregate columns, and the management table all read one array.
*Anchors:* #36 (persona reachability), #2 (saved views build on tag taxonomy).

### WP6 — Task Manager as first-class + masthead indicator

> **DONE 2026-11-12.** The Config tab was *promoted* (moved, not duplicated — no drift surface):
> new first-class `scr-tasks` screen mirroring upstream `/tasks`, nav item in the Administration
> section (admin-only), `#scr=tasks` deep link restored, both `cfgTabApply('tasks')` call sites
> re-pointed, hub down to 7 tabs. Masthead queued-task counter (pf-v6-c-badge) is live-counted
> from the task table's Queued rows regardless of view filters, RBAC-gated (#36). Bonus fix
> (defect #18): the State/Kind chips were explanatory-only — now machine-readable filters; the
> task sample grew 2 → 7 rows (4 Queued, 1 Running — the Running row cites invoicing's 61% run
> from the Applications row). Verified jsdom + Chrome (harness31: 59px rows, 107×37px counter,
> RBAC display:none for non-admins). See UC-AD1/AD2.
Promote Config → "Task queue" to a first-class nav item mirroring upstream `/tasks`
(ID/Application/Status/Kind/Priority/Created By, 494→sampled); add the masthead
queued-tasks counter, live-counted from the task table (upstream has it; the mock's masthead
currently has only the persona switcher).
*Anchor:* #3 ("completed with errors" diagnostics), #15 (mta-ops safety).

### WP7 — Small registries: Source platforms · Identities · Custom migration targets

> **DONE 2026-11-12.** One "Registries" Config tab (as scoped in review — not three) with three
> management cards: Source platforms (Name/Type/Applications), Custom migration targets
> (Name/Languages), Identities (Name/Description/Type/Applications), each with a create modal
> (required-name + duplicate validation). Platform creates/deletes cascade into the inventory
> "Source platforms" filter menu (including filter-state cleanup when a selected value is
> deleted); platform and identity deletes are guarded while applications reference them
> (applications column names the blast radius). Verified jsdom (CRUD, guards, cascade,
> filter-state cleanup) and Chrome (3-card grid, 560px modals). See UC-AD4.
Three compact Config panels (or tabs) with registry tables + create modals, 1–2 sample rows each:
source platforms (Name/Type/Applications), identities (Name/Description/Type — complements
"Credential health"), migration targets (Languages, "Create new"). Cheapest package; closes four
audit rows.
*Anchors:* #21 (import-time tasks → source platforms), #33 item 6 (identities API), upstream parity.

### WP8 — Application-detail depth (Tags · Reports · Review · Tasks · Platform tabs)

> **DONE 2026-11-12.** The app detail modal now carries 8 tabs — the upstream six (Details
> [renamed from Overview], Tags, Reports, Review, Tasks, Platform) plus the mock's value-add
> tabs (Related incidents, Dependencies). Both canonical templates (`tpl-drawer-app`,
> `tpl-drawer-app2`) got the five new tabs as static panels consistent with their identities
> (invoicing: tasks #490/#489, not-started assessment; payments-api: honest "no tasks sampled"
> empty state, pending review with sign-off verb); the parameterized path (`openAppRow`) derives
> all five from row `data-*` attributes and the shared stores, so the modal cannot disagree with
> the table. Bonus fix (defect #19): `openAppRow` still read the pre-WP3 cell indices — every
> row-parameterized detail except the two canonical ones showed shifted content; re-pointed and
> verified. Verified jsdom (8/8 tab walks on all three paths) and Chrome (single-line tab row,
> all panels within the modal box, 0.0px inner-table alignment). See UC-X12.
Extend the app drawer to the upstream six tabs. Tags and Platform render from existing
`data-tags`/`data-platform`; Reports links to the existing run comparison (#1); Review shows the
WP3 sign-off state; Tasks lists the app's task rows filtered from the task table. Cheap once the
drawer is parameterized (it already is, via `openApp`).
*Anchors:* #33 item 8, #1.

### WP9 — Insights (upstream's Issues/Insights split)

> **DONE 2026-11-12 (split — user decision, 2026-11-12; merge remains documented as the
> upstream-action alternative).** The Incidents screen gained two tabs: "Triage queue" (the
> existing surface, now the default on nav, matching how Config resets to Access) and
> "Insights" — the upstream `/insights/all` surface at its crawled column set (Insight/Category/
> Source/Target(s)/Affected applications) with 3 sampled insights (cloud-readiness, technology
> usage, testing) that are *informational findings*: no effort estimate, a "why this is an
> insight, not an incident" explanation on the record, rows opening a parameterized detail
> drawer (identity follows the clicked row). The panel honestly cites the parity audit: the
> live 8.3.3 console reported "0 - 0 of 0" insights — the split ships regardless. Deep links:
> `#scr=incidents&tab=insights` and upstream legacy `#scr=insights`. Verified jsdom (tab walk,
> drawer identity, deep links, nav reset) + Chrome (harness36: single-line tabs, 0.0px table
> alignment, 470px drawer). See UC-X13.
Add an "Insights" tab to the Incidents screen (Insight/Category/Source/Target(s)/Affected
applications) with 2–3 sample rows — keeps the mock's triage-focused Incidents screen while
restoring upstream's distinction. Lowest priority of the surface work; decide whether the
suggestion doc should instead argue for *merging* Insights back into Issues (an upstream-action
candidate, see `upstream/route2-issue-texts.md`).
*Anchor:* #24 (issue types), upstream-action decision needed.

### WP10 — Restore the Waves Stakeholders column (quick win, one hour)

> **DONE 2026-11-12.** Column added between Status and Analysis (jsdom + Chrome, 0.0px column
> alignment delta); Waves 1–3 named, Wave 4 "— pending staffing"; expandable rows colspan 6→7.
> See UC-P2.
§7.2 found the only upstream field lost in a modeled surface: waves carry **Stakeholders**.
Add the column (2–3 sample names) to the wave rows — completes the planning picture (#46).

## 2. What deliberately stays inert

Per the mock's convention (§6, open items): *record* rows (audit logs, token accounting, attempt
history) stay read-only; forms validate and mutate in-memory only; export buttons (SARIF,
CycloneDX, CSV) stay visual with their annotation badges. "Fully functional" means **every
upstream surface is present, navigable, consistent, and interactive** — not a backend.

## 3. Definition of done

1. Nav structure mirrors upstream groups (Migration · Analysis Results · Agentic · Configuration)
   — with the mock's persona workspaces (#36) kept as the added value on top.
2. Every §7.1 audit row closed; §7.2 losses (Stakeholders) restored.
3. Every new surface passes the two harnesses (jsdom behavior + Chrome geometry/CSS) and gets a
   dead-end audit pass (defect log continues).
4. `use-case-verification.md` gains UC rows + metrics for each new surface; the parity audit §7
   moves to an appendix marked "resolved".
5. The cross-surface story upgrades: the demo can create an app, assign it to Wave 4, and watch
   the wave's analysis/risk/effort aggregates, gate membership, and cohort counts move together —
   live. That is the strongest possible argument for suggestions #4/#25/#46.

## 4. Sizing

| Package | Effort | Value for socialization |
|---|---|---|
| WP0 data layer | 1.5–2 d | prerequisite for everything; the real upgrade |
| WP1 Agentic | 1–1.5 d | closes the biggest parity gap; AMF story |
| WP2 Archetypes | 0.5–1 d | #45 becomes tangible |
| WP3 Assessment/Review | 1 d | the mock's largest missing *workflow* |
| WP4 App CRUD | 0.5–1 d | credibility for form-heavy flows |
| WP5 Controls | 0.5 d | organizational data feeds everything else |
| WP6 Task Manager + masthead | 0.5 d | operations credibility |
| WP7 registries | 0.5 d | parity sweep |
| WP8 app-detail tabs | 0.5 d | cheap after WP3 |
| WP9 Insights | 0.5 d | needs an upstream-action decision first |
| WP10 wave Stakeholders | 1 h | free parity win |

**Total ≈ 7–9 working days** for full parity at the mock's fidelity bar.

## 5. Hub API requirements raised by the mock's surfaces

The work packages above close gaps *inside the mock*. A second axis points
*outward*: per the API-parity rule (#48 item 3 — "no UI surface ships without
its REST resource, RBAC scope, and spec entry"), every mock surface whose REST
resource does not yet exist in the Tackle Hub is a **required Hub API change**,
stood in with client-side state until the API lands. The API-contract side is
tracked in `../implementation/implementation.md` §9; the endpoint catalogue below is
the UI-driven view of the same work. `#N` cites
[`../evidence/mta-improvement-suggestions.md`](../../evidence/mta-improvement-suggestions.md).

### 5.1 New REST resources (no counterpart in today's Hub, ~143 paths)

| Mock surface | Required API | Ref |
|---|---|---|
| Triage queue / incident modal (resolve, false-positive) | **Writable triage state** on insights/incidents — today `/analyses/*` is GET-only | #33.1 |
| Run comparison | **Analysis-diff endpoint** | #33.2 |
| Bulk "Queue analysis" bar | **Generalized batch API** beyond `/batch/tags`+`/batch/tickets` — batch analysis, bulk wave/archetype assignment (mock-validated: skips quota-blocked apps, reports skips — defect 29) | #33.3 |
| Live inventory / alerts | **Event/webhook subscriptions** (task lifecycle, entity changes) | #33.4 |
| Effort rollups, combined risk | **Aggregate statistics endpoints** (server-side, not client-side math) | #33.5 |
| IDE rule round-trip | **Rule validation endpoint** | #33.6 |
| Language / currency / tour state following the user | **`GET/PUT /user-settings`** — the mock stands in with localStorage (defect row 64) | #33.7 |
| Analysis Profiles view | **Analysis Profiles REST resource** — verified 404 at every plausible path | #48 |
| Org → dept → team switcher, tenancy clamp | **Multi-tenancy resources** — membership rules over entities the Hub already has, but visible in every list endpoint and enforced API-side (today any API user reads across teams) | #41 |
| Audit trail view | **Immutable audit-log resource** | #42 |
| Archetype dashboards, risk provenance | **Archetype membership rules + provenance fields** | #45 |
| Wave gantt actuals, gate steppers | **Wave execution fields**: actual start/completion, gate state, progress rollups | #46 / #33.10 |
| Credential "used-by" blast radius, jump-to-cohort | **Reverse-relation endpoints** (`/identities/{id}/consumers`, `/tags/{id}/applications`, `/gateways/{id}/consumers`, …) + uniform pagination/sort/filter conventions | #33.9 |
| Agent runs, workflow authoring | **Workflow CRs as product content**, runs created through the Hub API under authentication, run records with token/cost attribution | #49 / #39.6 |

### 5.2 Changes to existing endpoints and semantics

- **Applications list** gains first-class, filterable/sortable **analysis
  state / coverage / staleness** fields (queued / running / failed /
  **quota-blocked**, last-analysis age) — the operational-inventory ask (#33.8).
- **Machine-first protocol semantics** (#48.4): `401` + `WWW-Authenticate`
  instead of the SPA's 302 redirect for unauthenticated `/hub/*` calls;
  structured error bodies with stable machine-readable codes; **ETag/If-Match**
  on mutations; **upsert** semantics for identities/applications/tags. The
  mock's embedded API-spec modal annotates exactly these.
- **Keycloak scope gap**: `tasks:GET` is not in the MTA client scopes
  (MTA-8247) — a read the mock's own UI needs.
- **Questionnaire REST schema parity**: `includeFor`/`applyTags`/
  `autoAnswerFor` accepted by UI YAML upload but rejected by the REST schema.
- **Settings as a versioned surface**: machine-readable manifest per key,
  save-time validation, export/import as a versionable document (#33.11).
- **Tracker SPI beyond JIRA** with per-incident sync-outcome surfacing (#40/#37).
- **Dependency importer fixes**: duplicate edges on re-import, `LIKE`-match
  name resolution binding prefixes to the wrong application (#33 field note).
- **Wave-date ergonomics**: RFC3339-only parsing rejects date-only strings.

### 5.3 Already at parity — no Hub change required

The CRUD core the mock renders was verified against the live 8.3.3 instance
(§7 audit): applications (incl. owner + contributors), stakeholder groups,
business services, waves (CRUD), tags, archetypes, batch tags/tickets, PATs
and service accounts. The mock's `/hub/...` parity annotations in `index.html`
record the verified shapes.

**Boundary:** new UI value-adds that are pure presentation (annotation badges,
saved-view defaults computed client-side, the demo driver) raise no API ask —
the parity rule binds surfaces that *represent Hub state*, and the table above
is exactly that set.
