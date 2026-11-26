# CHANGELOG — behavior changes

One reverse-chronological clause per behavior change, with defect-log
row references. **Convention (since 2026-11-17):** every mock/port/backend
behavior change appends its clause here instead of README.md — the
defect-log row ([`deliverables/ui-mockup/use-case-verification.md`
§4](deliverables/ui-mockup/use-case-verification.md), append-only, one
line per row) remains the detailed evidence record; this file is the
what-changed-when index. Long-form design-system rules:
[`deliverables/ui-mockup/design-system-rules.md`](deliverables/ui-mockup/design-system-rules.md).

- **Per-host TLS-exemption allowlist in the mock (row 247, user follow-up)** — the Platform
  settings card manages the allowlist filed as Route 2 issue 14 item 7: host + scope
  (clone/push), validated and audited mutations, and an import-wizard alert that flags an
  exempted connection at entry time.

- **Container stack removed (2026-11-24)** — `deliverables/compose.yaml`, the two
  Containerfiles and nginx.conf are gone, and the docs no longer advertise a
  localhost compose stack: deliverables/README now runs the stack in dev mode
  (`mvn quarkus:dev` + `npm run dev` via Dev Services, port-only phrasing), the
  guided-demo path is `capture.mjs` + `assemble.py` with a required `DEMO_BASE`,
  and the jsdom suites use a non-resolving `mock.test` URL. `sync-org-members.sh`
  stays (de-composed): it is the only path that gives `r.olson` his
  membership-only tenancy and attaches the `org-membership` scope.

- **Pages deploy self-heals on re-runs (row 246, deploy incident)** — the workflow deletes
  stale `github-pages` artifacts from earlier attempts before uploading (retried, non-fatal),
  so a failed deploy + re-run can no longer produce the "Multiple artifacts" deploy failure.

- **Global sidebar uses the same nav spacing (row 245, user follow-up)** — the row-244
  tightening extends to the outer left navigation, so both navigation rails match.

- **Administration sub-nav entry spacing minimized (row 244, user follow-up)** — each left-nav
  leaf's block padding drops 8px → 4px (row pitch ~40px → ~32px); the remaining space is the
  text's own line-height.

- **Administration sub-nav section gap minimized (row 243, user follow-up)** — the space
  between the left navigation's four sections drops to 4px; the section headings carry the
  grouping on their own.

- **Card-header button sizes normalized (row 242, user report)** — all card-header action
  buttons render full-size across the mock (the Administration "Add …" family had been
  `btn-xs`); `btn-xs` stays reserved for row-level table actions.

- **Tag categories as managed data (row 241, user request)** — Landscape gains a third
  "Tag categories" card tab (create / edit / guarded delete with live tag-reference counts);
  the tag modal's category field is now a select referencing that store, and save validates
  against it — no more free-text categories.

- **Access pane tab order (row 240, user follow-up)** — the four "Users, tokens & identities"
  tabs render as Users / Users & stakeholders / Identities / Tokens, with Users as the default
  card; the "rotate under Tokens" cross-link follows the card to its new position.

- **Access pane: every card is a tab (row 239, user follow-up)** — the "Users, tokens &
  identities" view's side-by-side summary pair joins the tab model: four tabs (Users &
  stakeholders / Tokens / Users / Identities), one card visible at a time; the "rotate under
  Tokens" cross-link still lands directly on the Tokens card.

- **"Add organization" hidden from the org admin (row 238, user follow-up)** — the button on the
  Organizations card was disabled-but-visible for personas without `tenants:create`; it now
  disappears entirely (the Platform administrator keeps it).

- **Org admin sees only his own organization (row 237, user defect report)** — the
  Organizations card's table and the masthead tenancy switcher listed the other org (readable
  despite the row-125 disabled guard / as a disabled menu item); both now render only the org
  admin's own organization — the Platform administrator keeps the full, audited cross-org list.

- **Administration card tabs actually hide their cards (row 236, user defect report)** — row 235's
  tabs toggled only the `hidden` property, which PF6's own card `display:flex` overrides; an
  explicit display:none rule in the mock's style layer makes the non-current cards disappear.

- **Administration: tighter sub-nav + card tabs (row 235, user follow-up)** — the left sub-nav's
  section gap shrinks a notch (24 → 16px), and every Administration leaf pane that stacked 2–3
  full-width cards now shows them as an in-pane tab bar (cards become tabpanels, one visible at
  a time); the Access summary pair stays side-by-side with only Users/Identities tabbed.

- **Administration left sub-nav replaces the tab stack (row 234, user follow-up)** — the
  row-233 regroup still stacked two tab levels (top tabs + per-group sub-tab bars); both
  dissolve into ONE left sub-nav on the Administration screen — four group headings
  (Organization / Access / Analysis / Platform), 15 leaf destinations, every leaf one click
  away. State + hash semantics unchanged: `&tab=<group>&sub=<leaf>` deep links, the
  `CFG_TAB_ALIAS` map and `&sub=ai` (now a `CFG_SUB_ALIAS`) still land on their leaves.

- **Assessment questions render from the questionnaire YAML (row 232, follow-up)** — the
  modal's question block was hardcoded template text that disagreed with the questionnaire
  YAML (different wording, 2 of 3 answers); the YAML in the Edit-YAML drawer is now the
  single visible source — the modal renders its question block from a parsed representation
  of that exact text, so the two cannot drift apart.

- **Assessment questionnaire is a modal (row 231, user request)** — the questionnaire moved
  from the right-side drawer into the app-detail modal shell, with the standard modal
  contract (aria-label, focus on open, restore on close); the `&drawer=assess` deep link and
  the row-230 start/override gate both land in the same modal.

- **Assessments can be started (row 230, user question)** — a not-yet-assessed application
  had no start path: the "Not started" cells were dead text and the only modal framed itself
  as an override. The cells are entry points now and the "New assessment" modal is
  mode-aware ("Start assessment" vs "Override"); the questionnaire drawer shows the honest
  Not-started status either way.

- **Wave 4 gate status corrected (row 229, user follow-up)** — the pm home's gate cell
  dropped the quota-blocked cause whenever a ticket existed (now aggregates both), and the
  architect home's Wave-gates strip hardcoded wave statuses — it derives from the gate
  facts like every other surface now (wave 4: at risk, not "planned").

- **Wave 3 delay now reported (row 228, user defect report)** — the project manager's wave
  status table showed an em-dash for Wave 3 although its window closed 2026-10-24 with two
  apps still running; planned-vs-actual now derives from the known windows and reports
  "Nd overdue — window ended <date>" for any incomplete wave past its window.

- **Nav phantom-gap fix (row 227, user defect report)** — hidden nav links left empty `<li>`
  elements whose spacing still rendered, so personas with mid-list hidden items (migrator,
  pm/pgm) saw +8px gaps before the next visible item; the whole nav item is hidden now and
  item spacing is uniform (45px) for every persona.

- **Task manager persona-aware framing (row 226, user design question)** — the task manager
  stays visible for migrator/pm/pgm (the queue is their work), but stops wearing the admin
  voice: work personas get a "your queued work" subtitle and the platform-health band
  (queue depth, aging, quota → raise-in-CR) is admin/padmin-only, its framing collapsing
  when hidden.

- **Round-trip promoted to sub-tab (row 225, user request)** — on Reports → Rule coverage,
  the Hub ↔ IDE round-trip report became a third sub-tab beside the matrix and transparency
  views; deep links extended to `&sub=roundtrip`.

- **Hub ↔ IDE round-trip is a data report now (row 224, user defect report)** — the prose
  bullets on Reports → Rule coverage read as integration docs; the card body is an evidence
  table now (When / Surface / Event / Subject / Actor) with rows drawn from the mock's
  existing fact base: triage writes synced via the triage API, the organization rule publish,
  and an IDE OIDC login.

- **Agent-runs KPI tiles whitened (row 223, user defect report)** — the three static KPI
  cards on Reports → Agent runs carried a bare `pf-m-plain` (transparent, borderless — the
  only such cards on Reports); they are standard white cards now, matching every sibling panel.

- **Rule coverage sub-tabs (row 222, user request)** — on Reports → Rule coverage, the
  Rule coverage matrix and Rule result transparency cards became sub-tabs (matrix default,
  deep-linkable via `&tab=rules&sub=matrix|trans`); the Hub ↔ IDE round-trip card stays
  beneath. A panel-splice regression (unclosed sub-panel, the row-219 class) was caught by
  the div-depth walk before shipping and fixed.

- **Workflow authoring moved to Agentic, first tab (row 221, user request)** — the Reports
  Workflow authoring card joined the Agentic Workflows tab (above the /workflows registry
  table), and that tab moved to first position. The Agentic screen subtitle was rewritten
  (EN + all locales) — it still said "six routes, operations first".

- **Agent Cards (A2A) moved to Agentic (row 220, user request)** — the A2A Agent Card
  registry card moved from Reports → Agent runs to a new "Agent cards" tab beside Agents on
  the Agentic screen; deep-links via `#scr=agentic…&tab=cards`; the curation-queue link
  keeps its RBAC gating.

- **Reports tabs fixed (row 219, user defect report)** — Dependencies / Agent runs /
  Rule coverage / Questionnaire answers rendered empty because row 216's sub-tab splice
  silently no-opped a closing tag, nesting their panels inside the (hidden) panel-trends.
  One `</div>` restored; a structural probe now asserts every top-level tabpanel is a
  direct child of its screen container.

- **Registry versioning made visible (row 218, user request)** — the agent and skill
  registries gain a Version column (draft badge on un-curated artifacts) and a shared
  version-history modal (active · superseded · retired · draft); registry saves bump a
  patch version as an in-session draft. The unified versioning model (one lifecycle, each
  kind pins its reproducibility set; run records cite the workflow · agent · skill triple)
  is recorded in design.md §19.6.

- **Agentic → Administration links RBAC-gated (row 217, user defect report)** — the
  Gateways card's "30-day usage & health →" (and the Agents pager's "curation queue →")
  bounced architect/migrator Home because Administration isn't in their RBAC views; both
  links now carry `data-needs-view="config"` and are hidden for personas without the view,
  rendered and working for admin/padmin.

- **Reports → Trends: cards become sub-tabs (row 216, user request)** — the three stacked
  Trends cards (Analysis diff / Trends / Wave burndown) are now sub-tabs under the Trends
  top tab, following the incidents Insights sub-tab pattern. Deep-linkable via
  `&tab=trends&sub=diff|trend|burn`; charts re-render on sub-tab activation so the burndown
  measures its now-visible container; "Analysis diff" got exact dict keys in all 11 non-EN
  locales. verify-burn re-pointed.

- **Wave-gate chips: failing only (row 215, user request)** — the gate strips above the wave
  tabs (and the home card's port of them) now hide every green ✓ chip and list only failing
  (✕) and warning (⚠) conditions; an all-green wave shows a single "All gates green" chip so
  the strip never goes silently empty. Tooltips/aria-labels keep the full condition names,
  the Gates tab keeps the full picture, and the burndown hue marker (blocking-dependency
  state) is unaffected. verify-visuals45 re-pointed.

- **Greek locale (row 214)** — `el` added as the 12th language with full dict parity (1128 keys
  assembled index-checked from the nl key list, so EN keys stay byte-exact), 65 composition rules,
  Ελληνικά in the switcher, Greek month names, day-first dates ("3 Νοε"), EUR currency, and the
  gate-fact text block. Burndown charts, risk rollups, trends captions, and tour/dock composition
  all verified under Greek (row-212 fix holds for the new locale); verify-i18n now asserts 12
  languages and boots Greek via `&lang=el` (103/103).

- **Home Wave-gates card uses the Waves screen's gate chips (row 213, user request)** — the architect
  landing's stacked bar diagram (rows 160→169) is replaced by the exact gate-chip strip rendered above
  the wave tabs: one row per active wave (name link + lane-status pill, translating like the lane
  header) with the per-condition chips, which now also navigate from the landing
  (`show('waves')` + evidence tab). `waveGateStripHtml` gained optional member-list/navigation params;
  the Waves screen's own strip is unchanged. Follow-on: the burndown legend's "Ideal" (identity DE
  loanword) whitelisted in verify-wavesi18n — it only surfaced once row 212 made the chart mount
  under non-EN locales. Second follow-on: `invRowRisk` now lowercases the pre-set `data-risk`
  attribute (store values are capitalized) — the Risk filter would otherwise have matched nothing.

- **Burndown charts EN-only fixed (row 212, user report)** — under every non-EN locale the
  per-wave and aggregate burndown charts silently failed to mount: the wave-lane lookup matched
  the rendered "Wave N" title, which translates. Lanes now anchor on the stable
  `data-expand="wave-members-N"` button; the wave risk rollup reads a new `data-risk` attribute
  instead of the translated label (counts were zeroed in all non-EN locales); the Reports trends
  caption gained exact node keys ×10 (5- and 3-run variants) — its nl value de-chained
  ("Openstaande incidenten …") because exact-key values must not contain words that shorter dict
  keys re-hit on the observer re-walk (row-99 lesson extended). Guards added to verify-wavesi18n.

- **New Suggestion 59: Wave staffing availability** (evidence §2/§3.44) — absence-aware
  capacity for wave planning: per-stakeholder allocation (default: the org's 60% factor)
  and absence entries replace row-202's uniform constant; capacity sums
  (working days − absence days) × per-person allocation over the wave's members;
  cross-wave double-booking splits the capacity math (equal division by default)
  and is flagged by name on the composition card — flag-only (paper capacity) and
  silent split (unexplained drop) both rejected; the
  over-commitment tail states its causes and the #47 wave gate gains an availability
  evidence item; rides #25 (planner sizing), #41/#42 (tenancy, audit), #5 (HR/SCIM
  absence sync), #48 (API). Suggestion-stage — no mock/backend change yet.
- **New Suggestion 58: Per-agent MCP server configuration** (evidence §2/§3.43) — governed
  tool bindings as first-class, versioned registry artifacts: each agent binds specific MCP
  servers (Apicurio `MCP_SERVER` refs, #27/#57) with tool filters and declared scopes;
  credentials arrive by token exchange at run start (#5/#56, #20), never as env vars; the
  sandbox network policy (#16) and #29's execution rails are both generated from the one
  binding; run records state the binding version (#50/#49), and binding changes are audited
  (#42). Bindings render into the agent framework's native configuration (verified against
  the Goose extension docs 2026-11-19: `extensions:` in `config.yaml`, `streamable_http`
  with `client_id`/`scopes`, permission mode pinned instead of the autonomous default;
  LangGraph/CrewAI/SK renderers follow) — injected read-only, never hand-edited. Closes the
  gap left by #19 (which says agents consume tools but never models which ones per agent);
  mirrors #34's plugin permission-scoping pattern. Scope boundary added: renderers exist
  for factory-agent frameworks only — BYOA consumers (OpenClaw via Red Hat's MCP Gateway,
  token-claims tool filtering; verified 2026-11-19) get governed gateway access instead;
  Hermes Agent's per-server tool filters map onto the binding almost 1:1 (on-demand
  renderer). #19's MCP Gateway item gained the same upstream reference. Classified Tier 1
  (Hub only) — vendor-neutral counts updated to 45 of 58; summary table, §5.1 sequence
  (Wave 4) and README counts synced.

- **New Suggestion 57: Integration with Apicurio Registry A2A** (evidence §2/§3.42) — the
  migration factory's agents publish A2A Agent Cards to Apicurio Registry's agent registry
  and consume external A2A agents via registry search (the protocol wiring for #16's A2A
  adoption and #27 item 5): card versions pinned per workflow (#49), compatibility rules as
  the agent-evolution gate, tenancy-filtered discovery (#41/#42), #29 guardrail attestation
  recorded on the card. Upstream status verified inline 2026-11-19: `AGENT_CARD` is native
  in Apicurio Registry 3.2–3.4 (discovery, search, compatibility rules) but A2A support is
  experimental/disabled-by-default (`APICURIO_A2A_ENABLED`) — recorded as a supportability
  gate. Classified Tier 2 (abstraction point: A2A protocol open, registry discovery is the
  premium) — vendor-neutral counts updated to 44 of 57, 13 abstraction points; summary
  table, §5.1 sequence (Wave 4) and README counts synced.

## 2026-11-19

- **New Suggestion 56: MCP server for the Tackle Hub** (evidence §2/§3.41) — the #48 Hub API
  contract exposed as governed MCP tools: read-only default toolset, #33 verbs as explicitly
  enabled mutations, server-side RBAC/tenancy enforced per call through the documented
  IdP→Hub token exchange (the 2026-11 field observation: the Hub is its own OIDC provider
  and rejects Keycloak JWTs), every call in #42's audit record. Positioned as the Hub-side
  half of #19's MTA-wide MCP surface; #55's migration assistant is its first-party client.
  Substrate demonstrated by the workspace's hub-backend reference implementation (Quarkus
  MCP server extension over the existing resources); the server itself is proposed, not yet
  built. Classified Tier 1 (Hub only) — vendor-neutral counts updated to 44 of 56;
  summary-table, §5.1 sequence (Wave 4) and README counts synced.

## 2026-11-18

- **Review.md [CHANGE] batch implemented (defect rows 145–151)** — the eleven actionable change
  requests from the stakeholder review (`demos/mock/Review.md`, triage in
  `demos/mock/Review-triage.md`):
  - **Applications table columns split (row 145)** — Tags, Progress %, and incident counts are
    first-class columns (13 total); the Analysis-state cell carries the state only; unassessed
    risk renders an `Unassessed` label instead of the bare `—`; Incidents is sortable
    (`data-incidents`) and keeps its deep link; every positional reader re-pointed, the wave
    member table gained a matching Incidents column, and `inv-rows-reference-wp3.json` was
    regenerated (12×13).
  - **Home coverage card (row 146)** — 64px donut with a per-status legend, the
    assessed / not-yet-assessed split in the meta line, and the Combined-risk card footer
    deep-links to Reports → Combined risks.
  - **Incident comment composer (row 147)** — writable triage comment (#33 item 1) inside the
    triage-state card: attributed via the persona's directory login, appended to the history,
    gated by `incidents:triage`.
  - **External ticket keys link (row 148)** — MIG-412/418/425 are tracker links (Jira Cloud
    title, stopPropagation-guarded).
  - **Combined risks (row 149)** — "Distribution" renamed "Relative share" (explained via
    annotation); mitigations render as compact tables (2 for State mgmt, 1 for Cloud readiness).
  - **Archetype Actions icons tightened (row 150)** — mock-layer gap/padding on
    `#archBody .pf-v6-c-action-list`.
  - **Effort header relabeled "Effort (pts)" (row 151)** — closes the incidents-vs-pts
    ambiguity; exact dict keys added in 9 locales (plus the missing `Incidents` fr key,
    `Relative share`, `Comment`, `Add a triage comment`).
  - **"Assign to agent group" → "Assign group to agents" (row 152, follow-up)** — the old
    label parsed backwards (recipient read as a group of agents); the #49 model hands the
    incident *group* to registered *agents* via a workflow definition, and the renamed button
    now agrees with its annotation. Exact dict keys in 9 locales.
- **Home Combined-risk card renders as a bar chart (defect row 153, user request)** — the
  stacked segment strip became one labeled bar per category (High / Medium / Low / Unassessed)
  in the Trends chart idiom: counts above, category row below, same status colors, summarized
  `role="img"` aria-label; headline KPI, count meta, and the Reports → Combined-risks deep link
  unchanged. `verify-visuals45.js` re-anchored + new assertion in `verify-reviewchanges.js`;
  battery 33/33.
- **Analysis-coverage legend: "not started" grey was invisible (defect row 154, user report)** —
  the not-started segment shared its color token with the donut's track ring
  (`--pf-t--global--color--border--default`), so the legend swatch resolved to the track's
  near-white grey (reading as a missing color) and the arc blended into the empty track. Both
  now use `--rh-color-gray-40` (#a3a3a3): the swatch is clearly visible and the donut's
  not-started portion renders as a distinct arc. Battery 33/33.
- **Home Analysis-coverage card renders as a bar chart with percentages (defect row 155,
  user request)** — the donut + legend became the row-153 bar-chart idiom: one bar per
  analysis state, each carrying **count · percentage share** above it and the category label
  below; tooltip + `role="img"` aria-label carry the full breakdown; the assessed-split meta
  and footer link unchanged. Percentages show the actual share of the total at one decimal
  ("2 · 13.3%") and the headline KPI uses the same format so it matches the current bar;
  with this seed the labels sum to exactly 100%. Battery 33/33.
- **Analysis-coverage card honors the tenancy clamp (defect row 156, user request)** — the
  card read the raw 15-app seed (defect-#45/#59-era base) while the Effort-rollup card used
  `scopedApps()` (12 under #41); the whole card now derives from `scopedApps()`: headline
  16.7%, meta "assessed 7 · not yet assessed 5" (Meridian's 3 out-of-scope apps no longer
  counted), bar percentages rescaled and still summing to 100%. All four home KPI cards now
  share one denominator. Battery 33/33.
- **Home Trends: pass-rate mini bars + delta badge (defect row 157, user request)** — the
  Trends card's two-line prose caption became graphical: the verification pass rate renders
  as a row of mini bars on the shared date axis (latest run emphasized, % above each bar,
  #47-annotated label), and the −41% incidents delta renders as a colored badge (green when
  incidents fall, red when they rise) followed by a one-line summary. The "Verification pass
  rate" dict key already existed in 9 locales; the JA→EN i18n assertion was re-anchored to
  the new fragment order. Battery 33/33.
- **Analysis-coverage bar label "current" → "up to date" (defect row 158, user choice)** —
  the word read as "currently being analyzed" (the in-flight slice) and needed explaining;
  "up to date" names the results' freshness and pairs with "stale". Label/aria/tooltips
  renamed, exact dict keys in 9 locales (de "aktuell", …); predicate and KPI unchanged.
- **Trends pass bars are now 100% stacked passed/not-passed (defect row 159, user request,
  extends row 157)** — each per-run pass bar is a fixed-height green-over-red stack sized by
  flex-grow (tooltips and an aria-label per stack), so the failing share is visible instead
  of implied by bar height. En passant: the TR i18n assertion was re-anchored — "3 Kas,
  tarihinde" was a comma artifact of the old caption's node split; the row-157 caption
  renders correct Turkish.
- **"Waves on track" card: per-wave gate scorecard (defect row 160, user choice)** — the
  architect home's bare "W3 failing / W4 failing" labels became clickable per-wave rows
  carrying the failing gate conditions as counts (open tickets, suites red, quota-blocked,
  expiring/unverified credentials) from the same `waveGateFacts` the Waves screen uses —
  the card now answers "which waves" and "why" without leaving Home.
- **Trends bars grouped side by side per run (defect row 161, user request)** — the Trends
  card's two series (open incidents, verification pass rate) now share one column per run:
  incidents bar left, 100% passed/not-passed stack right, one date label under each pair;
  a one-line legend ("Open incidents · Verification pass rate", both existing dict keys,
  DE "Offene Vorfälle · Verifizierungsquote") sits above the chart; tooltips and
  stack aria-labels carry the numbers. The delta-badge caption is unchanged.
- **Trends burn-down gauge for the delta (defect row 162, user choice)** — the −41% decrease
  is now drawn, not just written: a full-width track = the Sep 8 baseline (142), green fill =
  the latest 84 (59%), so the unfilled remainder IS the decrease; the badge moved from the
  caption to the gauge's right end, the gauge carries role="img" + an aria-label, and the
  caption keeps its prose.
- **Card title "Waves on track" → "Wave gates" (defect row 163, user challenge)** — the card
  was titled by the persona's question while the headline is the answer, so the title read
  ironically exactly when gates fail ("Waves on track / 2 at risk"). Now titled by its
  subject, matching the scorecard's verdict language; dict keys swapped in 9 locales
  (de "Wellen-Gates"), the 9 orphaned keys removed.
- **"Wave gates" card: Overall roll-up row (defect row 164, user request)** — an
  "Overall · gate failing" row with aggregated fact counts (4 open tickets · 2 of 9 suites
  red · 2 quota-blocked · 1 credential expiring) sits above the per-wave breakdown,
  separated by a subtle border; both row shapes share one `gateRow`/`factBits` helper pair.
  "Overall" dict key added in 9 locales.
- **"Wave gates" per-wave rows show execution statuses (defect row 165, user clarification)**
  — the per-wave labels now use the Waves overview's own status vocabulary (W3 · blocked,
  W4 · planned, colors as on the gantt lanes) instead of the gate verdict; the failing gate
  facts stay beside each row as the "why". "planned" dict key added in 9 locales.
- **Migration waves: Wave 4 flagged "planned" (defect row 166, user request)** — the Wave 4
  gantt lane now carries the teal "planned" label like Waves 1–3 carry done/blocked, so all
  four lanes show a status chip and the Waves screen matches the home card's vocabulary.
- **"Wave gates": Overall row removed, one line per wave (defect row 167, user decision)** —
  the row-164 Overall roll-up is gone; each wave reports on one line (status label + gate
  facts beside it, long fact lists ellipsize with the full detail in the row tooltip).
- **"Wave gates": 4-segment condition bars (defect row 168, user choice)** — all four waves
  render as columns, each bar split into the 4 gate conditions (tickets, quota, verification,
  credentials; green met / red unmet, #46's definition-of-done order), "N of 4" above, the
  wave's execution status below, per-segment tooltips + aria-labels carrying the failing
  detail, and a legend naming the conditions.
- **"Wave gates": done waves removed (defect row 169, user request)** — the diagram shows
  the scope's active waves only (W3/W4 for the architect); a done wave's 4-of-4 was a
  vacuous pass over zero sampled members.
- **"Wave gates": condition legend moved left of the bars (defect row 170, user request)** —
  the four condition names stack vertically left of the chart, one line per bar layer in
  segment order; bars grew to 56px so each 14px segment matches a legend line.
- **Analysis coverage: "2 of 12" beside the percentage (defect row 171, user request)** —
  the headline KPI now shows the fraction behind it (up-to-date of scoped total) as a muted
  inline count right of the percentage, store-derived with the rest of the card.
- **Analysis coverage: meta line unmixed (defect row 172, user audit)** — the meta mixed two
  partitions (risk-assessment "assessed 7 · not yet assessed 5" + analysis-state fragments
  "stale: 3 · 4 in flight", summing to 19 of 12 and half-duplicating the bars); it now
  carries only the assessment split — the dimension the chart does not show.
- **Analysis coverage: assessment split removed (defect row 173, user decision)** — the
  assessment split left the card entirely: assessment and analysis are different lifecycle
  stages, and the meta kept inviting "why 7?" on a card that is entirely about analysis
  runs. The card now reads purely analysis ("16.7% 2 of 12" + the five state bars); the
  assessed/unassessed story stays on Combined risk and the Applications table.
- **Analysis coverage: "2 of 12 apps" (defect row 174, user request)** — the fraction
  names its unit; the " of " is emitted as its own text node so the whole-node rules
  translate it (DE "von") while "12 apps" localizes via the existing dict key in all
  9 locales.
- **Effort-rollup KPI: "points · 12 apps" (defect row 175, user choice)** — the only
  spelled-out "story points" in visible UI becomes bare "points" (the "pts" abbreviation
  carries every dense use); a "points" dict key was added in all 9 locales after a
  row-99 substitution audit.
- **Effort rollup: top-3 apps by effort (defect row 176, user choice)** — mini horizontal
  bars under the KPI show the concentration story (payments-api/cust-portal/claims-web =
  ~79% of points), each row deep-linking into the app drawer; in-flight totals flagged
  provisional in the tooltip.
- **Combined risk: clickable risk bars (defect row 177, user request)** — each chart
  column filters Applications to that risk via the toolbar's Risk menu (the same
  chip-seeding idiom as the hurts table); the container's role="img" aggregate was
  dropped so the four links stay in the accessibility tree.
- **Analysis coverage: clickable bars + "Up to date" toolbar chip (defect row 178, user
  request/choice)** — each coverage bar filters Applications to exactly its segment; the
  up-to-date bar needed a new mirror of the stale chip (succeeded within the freshness
  window), and the Analysis menu gained the missing Failed and Queued values.
- **Trends: clickable bars (defect row 179, user choice)** — each run's incidents bar
  opens the Incidents screen and its pass/fail stack the Waves screen's gate verification;
  older bars note in their tooltips that they are historical snapshots while the target
  screens show the current state.
- **Assessment: "Completed" tag + version/link split (defect row 180, user request)** —
  the fused "Completed · v3" link becomes a green Completed pill with the version muted
  beside it and an "assessment" link; keyed in all 9 locales, fixing the v1 variant that
  never translated.
- **Assessment: the version is the link (defect row 181, user request)** — the separate
  "assessment" text link is dropped; the version number ("v1"/"v3") opens the assessment
  drawer as a PF6 inline link, and the row-180 "assessment" keys are removed.
- **Risk column: pill only (defect row 182, user request)** — the provenance text
  ("own assessment" / "inherited ← EAP8-archetype") left the table cell; it renders in
  the row drill-down (from data-riskkind), the wave-member modal, and Reports →
  Provenance. The byte-equality fixture was regenerated for the new cell HTML.
- **Applications: decision column order (defect row 183, user choice)** — ☑ · Application ·
  Risk · Wave · Analysis state · Progress · Last analysis · Incidents · Effort ·
  Assessment · Review · Tags · Business service; all positional readers, two suites and
  the byte-equality fixture re-pointed.
- **Progress header annotated (defect row 184, user question)** — the only unexplained
  column gained a #33 tooltip: the in-flight analysis run's completion %, dash when no
  run is executing.
- **Progress: grey 100% bar for succeeded runs (defect row 185, user request)** — finished
  runs render the mini bar full in grey (muted "done" beside the blue in-flight fill);
  quota-blocked and not-started stay a dash. The tooltip became the three-state legend.
- **Archetypes: decision column order (defect row 186, user choice)** — ☑ · Name ·
  Applications · Assessment · Review · Criteria · Profiles · Description · Tags · Owner ·
  Actions; size, group risk and sign-off progress lead, prose context last.
- **Archetypes: "Not started" wording (defect row 187, user request)** — the cohort
  Assessment pills use the Applications table's capitalized "Not started" (9-locale keyed);
  review-rollup predicates went case-insensitive.
- **Re-validate: real action with a diff (defect row 188, user choice)** — the cosmetic
  inline link becomes a refresh-icon action in the Actions column (RBAC-gated) that
  recomputes archetype membership from the criteria tags in the store and toasts the actual
  diff; the byte-equality fixture caught up with row 185's Progress bars.
- **In-application online help (defect row 189, Suggestion 54 demo)** — a Help drawer with
  six embedded, version-matched task topics: context-aware opening from the help menu,
  full-text search, `&help=<topic>` deep links, and a per-topic feedback stub.
- **Migration assistant (defect row 190, Suggestion 55 demo)** — a masthead sparkle button
  opens a governed assistant panel: answers computed live from the tenant's records with
  citations, the AI attribution footer per answer, a session meter (#20), accept/reject
  action cards (#16), and live #41 scoping (a tenancy pivot turns answers into refusals).
- **Wave re-validate wired (defect row 191, Suggestion 46 item 6)** — the dead waves-screen
  stub becomes the real "composition changed underneath me" verb: confirms the rule R-12
  propagation, recomputes effort, reports the #25 dependency check, clears the flag, toasts
  the diff.
- **Wave member table: gate-blocking order + tfoot fix (defect row 192, user choice)** —
  Application · Risk · Analysis · Incidents · Effort · Agent spend · Business service; the
  footer was also one column short (effort sum under Incidents) and now spans all 7.
- **Gate status above the wave tabs (defect row 193, user choice)** — the progress stepper
  becomes a verdict + chip strip on every wave: BLOCKED/ON TRACK/NOT EVALUABLE plus one
  clickable ✓/✕/⚠ chip per gate condition (live from `waveGateFacts`); a chip opens the
  Gates tab, and member-less waves report "not evaluable" instead of silence. Refined in
  row 194: the verdict label is gone (the wave lane header already reports blocked/done) —
  chips only. Rows 195/196: the "Tickets closed" chip opens the Tickets tab while tickets
  are open, and the "Verification green" chip opens the Verification-evidence tab while
  red or unevaluable — each chip jumps to the tab carrying its evidence.
- **Seed alignment (defect row 197)** — claims-batch's citrus suite (the failed WR-12 run
  on the Agentic screen) now appears in its wave Verification evidence: 1 suite, 1 red;
  the wave-3 gate rollup reads "3 of 10 suites red" everywhere (dict fragments updated in
  all 9 locales).
- **Blocking incidents data-backed (defect row 198, user refinement)** — the "Zero blocking
  incidents" gate condition gets a referent: claims-batch's kafka-contract blocker (from
  WR-12) turns the strip chip red — clicking opens the Incidents screen scoped to that
  app — fails the gate, and names the incident in the Gates tab and the admin wave-gate
  summary (9-locale rules); the strip is skip-pinned as English-only chrome pending the
  i18n pass. Row 199: the wave tab bar gains a fifth lens — **Blocking incidents** (count
  badge, blocker rows with finding, source and an "Incidents →" deep link, honest empty
  state) — and the strip chip now opens that tab, keeping the chip-per-tab evidence rule
  uniform. Row 200: the sixth lens — **Quota blocks** (badge, the #38-parked members with
  a "Tasks →" deep link, honest empty state); the quota chip joins the same rule. The
  row-198 seed also re-pointed inc42's incidents-pool counts (11 → 12 rows). Row 201: the
  green "No quota blocks" chip opens the Quota-blocks tab too — every chip now opens its
  own tab in both states. Row 202: wave capacity is derived from staffing (#46 item 4) —
  stakeholders × working days × 60% allocation, the plan's load from a seeded map,
  "over-committed" when load exceeds it, "capacity unknown — staffing pending" on unstaffed
  waves; the old decorative 18/22 is gone (9-locale rules extended for the new tail).
  Row 203: capacity becomes first-class on Migration Waves — a Capacity stat tile on every
  wave header (visible even collapsed, member-less waves included), a Capacity column in
  the #43 cross-team coordination table, and a 4th "Wave capacity" KPI tile
  ("9/29 team-days · 3 of 4 waves staffed") on the program landing. Row 204: the
  "Credentials ready" chip opens a new seventh wave tab, "Credentials verified" (count
  badge, panel mirroring the gate list's credential condition) — every strip chip now
  opens its own tab in both states. Row 205: with every condition covered by its own tab,
  the "Gate status" tab is retired — six lenses remain; the verdict stays on the lane
  header and strip, capacity on the stat tile; a structural incident during the panel
  removal (over-broad span cut + HEAD-based restoration over-grab) was fully recovered
  and is recorded in the defect log. Row 206: each wave's timeline bar now carries the
  same status hue as its lane pill (wave 2's yellow slippage-era bar turned green under
  its "done" pill; the +2d slip chip keeps yellow) — refined to the exact pill tints via
  PF6's nonstatus token pairs after pixel comparison. Row 207: a Wave burndown chart
  (suggestion #14) renders per wave in the wave detail and as an all-waves card on
  Reports → Trends — in a dedicated Burndown tab (7th lens) in the
  wave-detail tab bar, one per analysis-run point, derived live from the member rows
  (first point = live total, last = live remaining), rendered by the real PatternFly
  react-charts ChartLine with per-point dots (self-hosted esbuild bundle — PF charts
  are React-only per the v6 docs), dashed ideal, nice-scale gridlines, hover tooltips,
  light WHITE surface over the gray detail well (tab parity), scheme-aware via re-resolved
  token colors, compact 720×210
  aspect, single clamped hover tooltip per point; hand-rolled SVG fallback for offline/jsdom;
  honest empty/unsampled states, slippage
  drawn past the window, state carried in text. Row 208: wave 3's gantt bar gains a
  hatched overrun continuation segment from the planned end (Oct 24) to the snapshot
  date (Nov 18) with a "+25d overdue" badge in the wave's pill hue — token-pair only,
  dark-scheme verified, dict key ×9. Row 209: wave 4's pill renders a distinct yellow
  "blocked by dependency" state (tooltip names the Wave 3 → Wave 4 edge; the aggregate
  chart hue follows the pill live), replacing the understating plain "planned".
  Row 210 supersedes its shape: wave 4 carries the red "blocked" pill PLUS a yellow
  "blocked by dependency" chip that routes to a new Dependencies tab (8th lens) whose
  table derives the blocking provider wave and its CURRENT status live from the
  dependency graph (WAVE_DEPS) — i18n ×9 incl. per-language "consumed by" rules.
  Same-session strip move (user): the chip now lives in the wave-gate strip named
  "No blocking dependencies" in the strip's healthy-form convention — yellow ⚠ while
  a provider is not done (held, not failing), green ✓ when clear — and still routes
  to the Dependencies tab; the lane header keeps the single red "blocked" pill.
  The Dependencies tab's edge cell now links both applications (openApp), the verb
  riding a per-locale positional mid-node dict key (" consumed by " ×9).
- Row 211 — Dutch as the 11th locale (user request): full dict parity (1116 keys),
  65 word-order rules, EUR currency, Dutch month names and day-first dates; switcher
  shows "Nederlands"; verify-i18n extended with an NL block + deep link.
  Same-session fix (user report): the JS-composed trends caption ("open incidents per
  analysis run, last five runs — latest N on …") had no dict key in any locale —
  added ×10; de/ja/es/… had rendered that caption EN all along.
  Applications-view pass (user report): "Up to date", "Approved", "Changes requested"
  and the review-modal fragments added ×10; nl "Assessment"/"Review" loanwords made
  real Dutch (Beoordeling / Toetsing, compounds aligned).
  Dutch-demo frame review: the "Stale > 30d" inventory filter chip had no key
  in any locale — added ×10 (locale's stale term + day abbreviation).
  New suite `verify/verify-reviewchanges.js` (21 assertions); battery 33/33; visual checks via
  headless Chrome at 1600px.
- **Insights "Single application" → "By application" (defect row 144)** — the second insights
  sub-tab now covers all tenancy-visible applications with both filters (Application, Category)
  defaulting to unfiltered — no more pick-first empty state; the app menu derives from
  `scopedApps()` (#41) instead of the sampled-insight set, and both menus gained All options.
  Rows carry a leading Application column; latent drawer gap fixed (dynamic rows now carry the
  full insight record). Tab label renamed, ids/`&sub=single` deep link unchanged; exact dict
  keys in 9 locales. Supersedes the row-135 pick-one semantics by user decision.
- **Incidents deep link into an un-ticketed app no longer renders an empty queue (defect row 141)** —
  clicking an application's incidents link (claims-batch "88 incidents") left the default
  "Assigned to me" chip on, and since un-ticketed apps stay pool triage (`WAVE_TICKETS`), the mine
  filter zeroed the very queue the link promised. `showIncidentsForApp` now relaxes the chip when
  the target app is un-ticketed; ticketed apps keep it. Found via the Review.md triage
  (`demos/mock/Review-triage.md`); the reviewer's "separate Architect view" alternative was declined
  (contradicts #41/#2's one-shared-queue design). `verify/verify-reviewfixes.js` (11 assertions),
  battery 32/32.
- **Insights category filter gains an "All categories" option (defect row 142)** — the
  Single-application menu had no way back to the unfiltered view once a category was picked.
  Exact dict keys added in all 9 non-EN locales (phrase-pass partials avoided).
- **All-insights row links every application (defect row 143)** — claims-batch was plain text in
  the hard-coded-hostnames row while its sibling apps were links; now consistent.

## 2026-11-17

- **Masthead overlap with annotations ON fixed (defect row 140)** — with the annotation badges
  visible, the two masthead clusters overflowed and Chrome's `space-between` resolved the
  negative free space as an overlapping gap while the shrinking `__main` wrapper overflowed its
  unshrinkable brand — the tagline painted across the directory username. The brand track now
  keeps its width (PF6 grid intent) and the content cluster right-aligns via
  `margin-inline-start:auto`, handing overflow to the row-98 shrink chain. Found during row-139
  verification; assertions added to `verify/verify-annomenu.js` (10), battery 31/31.
- **Annotations toggle into the help menu; masthead divider removed (defect row 139)** — the
  dark-scheme masthead switch moves into a new "Mockup view" group in the help menu as a PF6
  `menuitemcheckbox` (menu stays open on toggle, state synced both ways, `&anno=1` deep link
  unchanged, `body.anno-off` semantics unchanged), and the `mh-group` vertical divider is
  removed (the spacing gap carries the separation). En route fixed a latent PF6.7 layout bug:
  `menu.css`'s column-direction stacked the checkbox above its label on every
  `menuitemcheckbox` — including the inventory filter menus, which had rendered that way since
  the 6.7 pin; a mock-layer row-axis override restores check-left-of-label for all 34 items.
  i18n suite re-anchored to the menu item (`#annoMenuText`). `verify/verify-annomenu.js`
  (9 assertions), battery 31/31.
- **Persona switcher as a masthead dropdown with the username (defect row 138)** — the
  six-persona toggle group is replaced by a compact dropdown (full persona names, selected
  state, standard masthead-menu focus/restore behavior), and the active persona's directory
  username from the row-131 user store renders left of it (e.g.
  `m.keller@northwind-financial.com` for Architect). The `&persona=` deep link follows the
  new markup. `verify/verify-personamenu.js` (9 assertions), battery 30/30.
- **Assessment override gate (defect row 137)** — the Assess verb on an application associated
  with archetypes now warns first, at live parity: the "New assessment" modal carries the
  association alert (app + archetype), the verbatim override question, and
  **Override / View archetypes / Cancel**. Override opens the questionnaire in dedicated mode
  (answers override the inherited archetype assessment(s); the archetype baseline stays
  untouched, #45); View archetypes jumps to the cohorts tab.
  `verify/verify-assessoverride.js` (11 assertions), battery 29/29.
- **Agentic authoring (defect row 136)** — agent/skill registries gain Edit verbs (live kebab
  parity) with pre-filled Save modals; renames cascade into run records / agent skill bindings
  and every registry mutation is now audited. The workflow modal's stage-count number is
  replaced by the **live stages builder** (per-stage name + agent + instructions rows, Add
  stage, artifact-chaining alert, Guide select) with the count derived from the rows. The
  per-run transcript item was already modeled (structured event stream + the ephemeral-by-design
  alert) — recorded, not re-built. `verify/verify-agauthor.js` (16 assertions), battery 28/28.
- **Insights Single-application sub-tab (defect row 135)** — the live two-tab structure:
  the Insights card gains the All insights / Single application sub-tabs, with the single-app
  view carrying the live column set (Insight/Category/Source/Target(s)/**Affected files**),
  an Application + Category filter pair, the verbatim empty state until an app is picked, and
  per-application file samples (assessment-sourced insights honestly show no files). Rows are
  the same sampled records, drillable; `&tab=insights&sub=single` deep-links.
  `verify/verify-inssingle.js` (14 assertions), battery 27/27.
- **Identities: Created By + per-type credential entry (defect row 134)** — the Add-credential
  button on the Credentials screen was inert; it now opens the live "New credential" modal
  (five live types, each with its own field set — Source Control user-credentials + the
  Default-credential switch, Maven settings upload/paste, Proxy, Basic/Bearer Token (Jira)),
  validation gates state location+cause+fix, and the secret is never stored (#15). The table
  gains the live **Created by** column (persona directory login, row 131) and the kebab's
  **Remove default** verb — the default flag is exclusive, and taking it is audited.
  `verify/verify-identities.js` (24 assertions), battery 26/26.
- **Stakeholder-side group membership editing (defect row 133)** — the Controls depth gap: the
  stakeholder modal gains a "Stakeholder groups" checkbox list and an Edit pencil on the rows
  (live parity: `/controls/stakeholders` carries an Edit action). `stakeholderSave` syncs
  membership both directions (`stakeSyncGroups` — check grants, uncheck removes), and a rename
  cascades into group memberships, application owners, business-service owners, and the wave
  cards' stakeholder cells. Audited (`stakeholder:create/update`). `verify/verify-stakegroups.js`
  (17 assertions), battery 25/25.
- **Archetype target profiles (defect row 132)** — the profile-assignment depth gap: each
  archetype's detail row gains a "Target profiles" block (live sample row verbatim) and a
  Manage-target-profiles modal (Name, the four live quickstart generator checkboxes,
  Analysis-profile select from the row-130 registry). Assignment writes through **both
  directions**: the profile registry's archetype list and the archetype table's Profiles cell
  (reassignment detaches the old profile, delete detaches on last reference only). Audited,
  `profiles:edit` RBAC, armed delete. `verify/verify-archtp.js` (29 assertions), battery 24/24.
- **Directory users on the mock's Config → Access tab (defect row 131)** — the Users view, the
  last whole-surface parity gap after row 130: a full-width "Users" card at the live `/users` column set (ID/Login/Name/Email/
  Roles/Tokens) over a new `MOCK_USERS` store of the realm demo identities, with the live
  Create-user modal (required-set / password-mismatch / duplicate-login gates, credential never
  stored), pre-filled edit whose **rename cascades token ownership and the stakeholder bind
  email** (#36a — no row-34 ghost binds), and token-guarded armed deletion (revoke first;
  bound stakeholder records stay). Audited, `users:edit` RBAC, shared pager. Grid: the
  full-width card sits in its own `grid12` container (Access panel split in two); added the
  missing `.grid12>.gc12` span class and extended the row-93 grid audit (`gc12: 12`,
  11 containers). `verify/verify-users.js` (27 assertions), battery 23/23.
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
