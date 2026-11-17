# Konveyor/MTA Improvement Program — Design

*Split from `design-implementation.md` (2026-11-16). This file holds **Part I — the designs** (§1–§7: repository landscape, process alignment, wave designs, filing plan, risks), **§19 — the console governance design decisions** backfilled from the UI mockup, and **§20 — the console navigation & screen anatomy** (abstract element model + per-screen wireframes). The implementation detail backlog (§8–§18: schemas, API contracts, diagrams, NFRs, security, tests, rollout, ADRs, KPIs, readiness checklist) lives in [implementation/implementation.md](../implementation/implementation.md). Numbering is unchanged and cross-referenced everywhere — cite sections as `design/design.md §N` / `implementation/implementation.md §N`.*

_Status: **draft v0.5** — grounded in the upstream `github.com/konveyor` repositories (surveyed 2026-11) ·
Requirements source: [`evidence/mta-improvement-suggestions.md`](../evidence/mta-improvement-suggestions.md) (53 suggestions, §5.1 sequencing) ·
Evidence base: live MTA 8.3.3 evaluation, 2026-11_

---

# Part I — Design

## 1. Repository landscape (surveyed)

The suggestions map onto these active upstream repositories. The last
column of the table below shows which of the five drafted enhancement
proposals (§6.2) touch each repo, and with which role: **P** primary,
**S** secondary, **D** docs/CI-only.

**Proposal legend** (drafted enhancements in this workspace's
`proposals/` directory):

| # | Proposal | Suggestions covered | Primary repo(s) |
|---|---|---|---|
| [①](../proposals/deterministic-analyses-and-incident-identity.md) | [deterministic-analyses-and-incident-identity.md](../proposals/deterministic-analyses-and-incident-identity.md) | #7, part of #1 | `analyzer-lsp`, `tackle2-hub`, `kantra` |
| [②](../proposals/triage-store-and-run-comparison.md) | [triage-store-and-run-comparison.md](../proposals/triage-store-and-run-comparison.md) | #33(1–2), #1, #6, #10 | `tackle2-hub` |
| [③](../proposals/sarif-and-cyclonedx-export.md) | [sarif-and-cyclonedx-export.md](../proposals/sarif-and-cyclonedx-export.md) | #12, #18 | `tackle2-hub` |
| [④](../proposals/batch-events-and-aggregates-api.md) | [batch-events-and-aggregates-api.md](../proposals/batch-events-and-aggregates-api.md) | #33(3–6) | `tackle2-hub` |
| [⑤](../proposals/vulnerability-and-coverage-issue-types.md) | [vulnerability-and-coverage-issue-types.md](../proposals/vulnerability-and-coverage-issue-types.md) | #24, #22 | `tackle2-hub` |

| Repo | Role | Suggestions primarily touching it | Drafted proposals (§6.2) |
|---|---|---|---|
| [`tackle2-hub`](https://github.com/konveyor/tackle2-hub) | Go monorepo (`cmd/`, `internal/`, `shared/`, `docs/openapi3.json`): inventory, tasks, analyses, reports, agentic REST | #3, #5, #12, #33, #10, #4, #32, #25 | **P: [①](../proposals/deterministic-analyses-and-incident-identity.md)[②](../proposals/triage-store-and-run-comparison.md)[③](../proposals/sarif-and-cyclonedx-export.md)[④](../proposals/batch-events-and-aggregates-api.md)[⑤](../proposals/vulnerability-and-coverage-issue-types.md)** (the only repo every proposal touches) |
| [`tackle2-ui`](https://github.com/konveyor/tackle2-ui) | React + PatternFly web console | #35, #3, #36, #1, #2, #8, #32 | S: [②](../proposals/triage-store-and-run-comparison.md)[③](../proposals/sarif-and-cyclonedx-export.md)[④](../proposals/batch-events-and-aggregates-api.md)[⑤](../proposals/vulnerability-and-coverage-issue-types.md) |
| [`analyzer-lsp`](https://github.com/konveyor/analyzer-lsp) | Analysis engine (LSP-based), YAML violations output | #7, #23, #24, #8 | P: [①](../proposals/deterministic-analyses-and-incident-identity.md) |
| [`kantra`](https://github.com/konveyor/kantra) | CLI unifying analysis + transformation; packages the static report | #7, #12, #15* | P: [①](../proposals/deterministic-analyses-and-incident-identity.md) · S: [③](../proposals/sarif-and-cyclonedx-export.md) |
| [`operator`](https://github.com/konveyor/operator) | Deploys the platform (Tackle CR) | #31, #30, #5, #20 | D: [②](../proposals/triage-store-and-run-comparison.md) (Keycloak realm packaging); none in [④](../proposals/batch-events-and-aggregates-api.md) v1 |
| [`agentic-controller`](https://github.com/konveyor/agentic-controller) | CRDs: `SkillCard`, `SkillCollection`, `Gateway`, `Agent`, `AgentRun`, `AgentWorkflow(Run)`; execution via [Agent Sandbox](https://github.com/kubernetes-sigs/agent-sandbox); ACP over HTTP (`goose serve`) | #16, #19, #20, #28, #29 | — (Wave 4 clusters are build-on-#341 actions, not yet drafted) |
| [`kai`](https://github.com/konveyor/kai) | AI remediation: LLMs guided by analyzer output; **ships `kai_mcp_solution_server/`** (MCP solution server) and `kai_analyzer_rpc/` (analyzer over RPC for IDEs) | #10, #19, #26, #16 | S: [①](../proposals/deterministic-analyses-and-incident-identity.md) (mirrored identity fn) · [②](../proposals/triage-store-and-run-comparison.md) (MCP triage tools) |
| [`editor-extensions`](https://github.com/konveyor/editor-extensions) | VS Code extension(s) (core/java/csharp/go/javascript); npm workspaces incl. `agentic/` (solution-generation workflows), `webview-ui/` (React+PatternFly), Playwright E2E | #26, #10 | S: [②](../proposals/triage-store-and-run-comparison.md) (consume MCP triage surface) |
| [`static-report`](https://github.com/konveyor/static-report) | Static report UI; data via `public/output.js` produced by `analyzer-output-parser` from analyzer YAML; packaged into kantra | #11 | S: [①](../proposals/deterministic-analyses-and-incident-identity.md) (manifest footer) · [②](../proposals/triage-store-and-run-comparison.md) (triage state) · [⑤](../proposals/vulnerability-and-coverage-issue-types.md) (inherits parity from Hub data) |
| [`rulesets`](https://github.com/konveyor/rulesets) | Bundled rules | #8, #9, #18, #23 | S: [①](../proposals/deterministic-analyses-and-incident-identity.md) (bundle digests) · [⑤](../proposals/vulnerability-and-coverage-issue-types.md) (`rhda` ruleset re-typing) |
| [`tackle2-addon`](https://github.com/konveyor/tackle2-addon) | Go addon SDK + bundled addon containers (the custom-task mechanism of #21) | #21, #22, #24 | S: [⑤](../proposals/vulnerability-and-coverage-issue-types.md) (RHDA/Exhort task, coverage import task) |
| [`tackle2-seed`](https://github.com/konveyor/tackle2-seed) | Hub database seeds (the 434 seeded tags/categories observed in 8.3.3) | #36 (Controls findings) | — |
| [`go-konveyor-tests`](https://github.com/konveyor/go-konveyor-tests) | Integration/e2e test suites | — | D/P: [①](../proposals/deterministic-analyses-and-incident-identity.md) (nightly double-run harness home, or a new `determinism-harness` repo) |
| [`enhancements`](https://github.com/konveyor/enhancements) | KEP-style enhancement process, `guidelines/`, `ROADMAP.md` | delivery vehicle for this program (§2) | D: [①](../proposals/deterministic-analyses-and-incident-identity.md)–[⑤](../proposals/vulnerability-and-coverage-issue-types.md) (proposal PRs + implementable/implemented milestone merges) |

\* `mta-ops` (container migration pipeline) is Red Hat downstream — not in the
konveyor org; its design (§3.3) is downstream-only.

**Key upstream design facts that shape this program** (from the
`agentic-controller` README/ADRs and repo docs):

- **Workspaces are ephemeral by design — "git is the persistence layer."**
  The ephemeral agent transcripts observed in 8.3.3 are an architectural
  decision, not an accident. Run-report persistence (#16) is therefore a
  deliberate architecture change (bucket/report persistence), to be proposed
  as an enhancement with an ADR, not a bug fix.
- **SkillCards support OCI images, git repos, or inline content** upstream —
  the 8.3.3 instance showed only image-sourced skills; the Skills-view
  improvements (#16) should surface the existing source flexibility.
- **Agent Sandbox is a hard dependency; OpenShell is under evaluation
  (adoption deferred)** — #16's guardrail design aligns with the evaluated
  direction, not a hypothetical one.
- **Platform floor:** Kubernetes 1.33+ (ImageVolume gate), OpenShift 4.20+,
  Agent Sandbox v1.0.x — constrains where agentic features can ship.
- **kai's MCP solution server already exists** — #19 is *partially built*:
  the solved-examples domain has a working MCP server; extending it (or the
  Hub) to expose inventory/analyses/triage is incremental.
- **The static report is a separate rendering path** (analyzer YAML →
  `analyzer-output-parser` → `output.js`) from the Hub UI (Hub API) — the
  parity contract test (#11) has exactly two artifacts to compare.

## 2. Process alignment: deliver as Konveyor enhancements

Konveyor tracks cross-repo designs via [`konveyor/enhancements`](https://github.com/konveyor/enhancements)
(KEP-inspired: numbered proposals under `proposals/`, a community
`ROADMAP.md`, RFEs via issues, maintainer consensus required). This program
maps onto that process:

1. **Cluster the 53 suggestions into enhancement proposals** — one per
   coherent design unit (see §6; ~12 proposals, not 36). Wave 0/1 items first.
2. Each proposal follows the `enhancements` template (guidelines/README.md):
   motivation (our evidence base), design detail, test plan, upgrade/downsides,
   rollout (feature flags).
3. Items that are pure bugs/friction (e.g., the 302-instead-of-401 auth
   response, task-list filter gaps) are **filed as issues** in the owning repo,
   not enhancements — per the repo's own "Is My Thing an Enhancement?"
   heuristic.
4. Cross-repo sequencing (the §5.1 wave handoffs) is material for the
   community `ROADMAP.md` discussion.

---

## 3. Wave 0 designs

### 3.1 #35 — Automated UI quality gate (a11y, navigation, interaction regression)

**Where it lives.** `tackle2-ui` (new `e2e/quality/` harness) — and, as the
proven-in-repo pattern, `editor-extensions` already runs Playwright E2E
(`test/`), so the toolchain choice matches upstream practice.

**Design.**

- A view registry enumerating all product routes (the 8.3.3 audit's 31 views:
  17 Migration + 14 Administration), each parameterized with: authenticated
  crawl, axe-core scan, console-error and failed-request assertions,
  breadcrumb/landmark contract checks.
- **Baseline ratchet:** `quality-baseline.json` (view → rule → selector
  counts) checked in from the current audit (violations exist on every view —
  critical: `button-name`, `empty-table-header`, `landmark-unique`,
  `aria-valid-attr-value`, `svg-img-alt`, `heading-order`,
  `scrollable-region-focusable`). CI fails on any violation not in the
  baseline; fixes remove baseline entries; the ratchet cannot grow.
- Runs: PR check (affected views) + nightly full scan; JUnit + HTML artifacts.
- **Apply the same harness to `static-report`** (it renders the same data and
  is shipped to auditors) and optionally to `editor-extensions` `webview-ui/`.

**Acceptance criteria.** CI blocks new critical/serious violations and console
errors; registry test fails for unregistered routes; baseline monotonically
shrinks or stays equal.

### 3.2 #3 — Task failure diagnostics

**Where it lives.** `tackle2-hub` (task API filters) + `tackle2-ui` (task
views). The data exists — verified task resource carries `errors[]`
(severity/description), `events[]` (kind/count/reason/last), `pod`.

**Design.**

1. Task detail: `errors[]` as PatternFly danger alerts; `events[]` as a
   timeline; raw YAML/JSON behind "Technical details" (keep — good admin
   transparency).
2. List: "Reason" column (first error description) for Failed tasks.
3. Hub `GET /tasks` filters: `state`, `kind`, `application`, `createdBefore`
   (today: ID only — verified). UI toolbar state/kind selects with counts.
4. Pod-log deep link into the OpenShift console (CR carries `pod`).
5. Error taxonomy: addons emit structured errors (code, severity, description,
   hint); curated UI hint map for known cases (MTA-6140: missing build file).
6. QuotaBlocked: derive which quota from task events; link to configuration.

**Filing note.** The filter gap and 302-vs-401 class fixes are issues on
`tackle2-hub`; the structured-error taxonomy (addon contract change) is the
enhancement-worthy part.

**Acceptance criteria.** A PVC-permission failure renders its message as an
alert without reading YAML; state/kind filters work; known-error hints render.

### 3.3 #15 — mta-ops pipeline ergonomics & safety (Red Hat downstream)

**Design** (unchanged from v0.1; downstream-only, no konveyor org surface):
`--check` preflight (namespace state, overwrite conflicts per MTA-7103, stage
collisions per MTA-7234), explicit `--overwrite`, replace-guards on
`kubectl apply`, runbook. Acceptance: re-run without `--overwrite` stops
safely; `--check` prints a full create/replace/skip plan and exits non-zero on
conflicts.

### 3.4 #5 — SSO hardening

**Where it lives.** `tackle2-hub` (auth middleware, PAT issuance),
`operator` (Keycloak realm packaging; note the archived `tackle-keycloak-theme`
— theming needs a decision: revive theme repo or configure in-realm).

**Design.**

- Single OIDC provider (Keycloak realm `mta`); deprecate the dual-provider
  setup observed on 8.3.3.
- **401 fix**: `401` + `WWW-Authenticate: Bearer` for unauthenticated `/hub/*`
  (observed: 302-to-SPA) — file as a `tackle2-hub` issue; small, but it
  unblocks every machine-client feature in #33/#12.
- PAT UX: scope selection from the existing `resource:verb` scopes (366
  verified), expiry defaults, curl test snippet in-product.
- CSP on the SPA (Keycloak already ships one; the SPA does not — verified).

**Acceptance criteria.** `curl /hub/tasks` unauthenticated → 401 JSON; single
provider login; scoped PAT creation in-product.

### 3.5 #11 — UI vs. static report parity (process, now precise)

**Where it lives.** `tackle2-hub` (report generation/CI) + `static-report`
(`analyzer-output-parser`).

**Design.** Upstream fact: the static report is produced
`analyzer YAML → analyzer-output-parser → public/output.js` while the Hub UI
reads the Hub API. Parity = a **three-way contract test** in CI: fixture
analyzer output → (a) Hub API JSON, (b) `output.js` extraction → compare
per-issue (name, target, effort, incident count) and dependencies. Drift fails
the release. Intentional divergences labeled in the report ("Hub-only
filters").

**Acceptance criteria.** Contract test in `static-report`/`tackle2-hub` CI;
divergence labeling shipped.

### 3.6 #13 effort-methodology docs & #21 addon docs

Docs-only; scheduled first because they unblock #4/#25/#32 (effort semantics)
and #22/#24 (addon authoring). #21's worked example: an import-time SCA addon
(becomes #22's RHDA integration). Include the verified task CR contract
(`data`, `errors`, `events`, `reported`, `bucket`).

---

## 4. Wave 1 designs

### 4.1 #7 — Deterministic analysis results

**Where it lives.** `analyzer-lsp` (output ordering, incident identity),
`tackle2-hub` (analysis model + toolchain manifest), `kantra` (flags),
`rulesets` (bundle digests), plus a fixture-corpus harness (`go-konveyor-tests`
or a new `konveyor/determinism-harness`).

**Design.**

1. **Toolchain manifest** recorded per analysis:

   ```yaml
   toolchain:
     analyzerImage: <registry>@sha256:<digest>     # digest, not tag
     ruleBundles: [{name, digest}]                 # rulesets actually loaded
     providerVersions: {java: "..."}
     mode: source+dependencies
     settingsFingerprint: sha256:<effective settings>
   ```

   Rendered in Hub UI, CLI output, static-report footer.
2. **Deterministic incident ordering** in `analyzer-lsp`: sort key (file,
   line, rule ID) with a stable tiebreak; no timestamps/UUIDs in result
   payloads (metadata only).
3. **Incident identity** (prerequisite for #1/#6/#33): rule ID + file + line +
   *snippet hash* — aligned with kai's incident storage (blog: "Incident
   Storage in Kai — A Deep Dive", 2024) so Hub and kai agree on keys.
4. **`--strict` mode** (kantra/Hub profile): fail rather than degrade on
   incomplete Maven resolution (pairs with #23).
5. **Nightly double-run harness**: same fixture corpus, two pods, normalized
   diff; zero-diff required for release.

**Acceptance criteria.** 7 consecutive nightly zero-diff runs; toolchain
manifest visible in all three surfaces.

### 4.2 #12 — SARIF + CycloneDX export

**Where it lives.** `tackle2-hub` (export endpoints, `shared/` serializers),
`kantra` (CLI flag), `tackle2-ui` (export menu next to existing CSV —
`download.csv.enabled` setting pattern verified).

**Design.**

- `GET /analyses/{id}/export/sarif` — incidents as `results`, rules as
  `tool.driver.rules` (ID = `ruleset/rule`), effort in
  `properties["konveyor/effort"]`.
- `GET /applications/{id}/export/cyclonedx` — dependency list (name, version,
  purl, direct/indirect scope) as CycloneDX 1.5. The API already carries
  version/indirect (verified).
- Schema validation in CI (SARIF 2.1.0, CycloneDX 1.5 JSON schemas, test
  scope); consumer smoke test (GitHub code scanning ingest, `cyclonedx-cli
  validate`).
- **Standards note (#18):** these exporters are the first concrete SARIF/
  CycloneDX boundary — file them together with the #18 contract-policy
  enhancement.

**Acceptance criteria.** SARIF opens in a code-scanning consumer with correct
rule metadata; CycloneDX validates; feature flag
`export.sarif.enabled` per §2 rollout rule.

### 4.3 #33 — Hub API extensions (triage, diff, bulk, events, aggregates)

**Where it lives.** `tackle2-hub` (`internal/` API + `docs/openapi3.json`
in-PR). **kai interplay:** triage write-back should be exposed through the
existing `kai_mcp_solution_server` MCP surface so the IDE (editor-extensions)
consumes one mechanism, not two.

**Design.** Additive, versioned, PAT-authenticated (after the §3.4 401 fix):

1. **Triage store** (verified read-only today):

   ```
   POST /analyses/incidents/{id}/triage   {state ∈ {confirmed|false-positive|
                                           not-an-issue|resolved|deferred}, comment}
   GET  /analyses/{id}/triage
   ```

   First-class entity (id, author, timestamp, state, comment); carries over
   across runs by the incident identity of §4.1(3).
2. **Diff:** `GET /applications/{id}/analysis/diff?from=<taskId>&to=<taskId>`
   → `{added[], resolved[], changed[], effortDelta, triageCarryover}`.
3. **Batch:** extend the verified `/batch/tags`, `/batch/tickets` pattern with
   `/batch/analyses`, `/batch/applications`.
4. **Webhooks:** `Webhook` resource (URL, secret, filters:
   `task.completed`, `analysis.completed`, `triage.changed`,
   `application.changed`), HMAC signing, delivery log; smallest viable version
   = single attempt + log (risk §7.3).
5. **Aggregates:** `GET /report/effort?groupBy=…`,
   `GET /report/issues?groupBy=…` — server-side rollups for #4/#32/#36.
6. **Tag usage:** `GET /tags/{id}/applications` (404 today — verified).

**Acceptance criteria.** Triage via API visible in UI + IDE and preserved
across re-analysis (same incident key); webhook demo triggers in CI;
aggregate endpoint matches UI rollup.

### 4.4 #30 — Observability

**Where it lives.** `tackle2-hub` + addon images + `operator` (dashboards/
alerts as configmaps). Aligns with `agentic-controller`'s existing
controller-diagnostics practice (continuous metrics capture documented there).

**Design.** Prometheus: `mta_tasks_queue_depth{state,kind}` (the 460-stuck
backlog becomes a graph), `mta_tasks_duration_seconds`, `mta_tasks_failed_
total{kind,errorCode}` (labels from §3.2's structured errors), Hub API RED
metrics, OTEL spans task lifecycle (created→scheduled→running→terminated,
pod correlation). Operator-shipped dashboards + alerts: queue aging (oldest
Created > N h), failure-rate spike, QuotaBlocked count, `up == 0` on scrape
targets (MTA-4774). Reserve `mta_ai_*` namespace for Wave 4 (#20/#16: tokens,
cost, model stamping).

**Acceptance criteria.** Dashboards render live in stock OpenShift +
Prometheus; queue-aging alert fires under fault injection.

### 4.5 #31 — Declarative deployment customization (Tackle CR)

**Where it lives.** `operator` (relates to upstream RFE #543, Structured
Tackle CR).

**Design.** As v0.1: `spec.hub/ui/keycloak.{replicas,resources,placement}`
with validation and status conditions; clearly-labeled raw-patch escape hatch;
upgrade-safe overrides.

**Acceptance criteria.** Fields reconcile; invalid CR rejected with a
condition message; overrides survive upgrade.

---

## 5. Waves 2–5 — design notes (updated for the repo landscape)

### Wave 2 — Analysis & inventory quality
- **#23 manifest-first dependency resolution** in `analyzer-lsp` java
  provider (+`kantra`): parse pom/Gradle against configured repos; build only
  enriches. Explicit `resolutionIncomplete` output state. Related repo:
  `maven-search-index` (binary classification, the "frequently unavailable"
  index — mitigation belongs here too).
- **#22 RHDA/RHTPA**: Red Hat downstream addon (Exhort API) written against
  the addon SDK (`tackle2-addon`); upstream community equivalent = a generic
  SCA provider example (#21's worked example).
- **#24 issue types**: vulnerability insights with CVSS/fixed-in/advisory
  linkage; excluded from effort totals; rendered as a distinct type in
  `tackle2-ui` (#32 exports follow).
- **#18 standards**: the versioning policy enhancement + boundary standards
  inventory (SARIF #12, CycloneDX #12, OTEL #30, ACP/Agent Skills already in
  `agentic-controller`, MCP via kai).

### Wave 3 — Decision support
- **#1 diff** and **#6 triage loop** consume #33; **#10** surfaces kai
  solution-server confidence (the MCP solution server stores solved examples —
  "resolution applied N times with M acceptances" is derivable there) into Hub
  and editor-extensions.
- **#4/#32** server-side aggregates → `tackle2-ui` dashboards; **#25** wave
  planner (weighted score first, optimizer later) over dependencies + effort +
  risk; **#14** trends from analysis history; **#2** saved views (URL state v1).

### Wave 4 — Governed AI & agentic trust
- **#20 MaaS**: build on the existing `Gateway` CRD (provider/model/
  contextWindow/tier — verified in 8.3.3 and defined in `agentic-controller`);
  add default-gateway, fallback chains, per-run model stamping, token/cost
  accounting into `mta_ai_*` metrics.
- **#19 MCP**: extend `kai_mcp_solution_server` (exists) with Hub inventory/
  analysis/triage tools — or a Hub-native MCP gateway that proxies it; auth
  via PAT/OIDC.
- **#16 run reports**: the pivotal change is persistence — persist transcripts
  + outcome artifacts (diff, commit list, evaluation) to the run's bucket,
  revising the "ephemeral workspaces / git-is-persistence" ADR for run *records*
  (not workspaces). Requires an enhancement + ACR: agent run report as a
  first-class artifact. Plus: red-flag Reason column, failed-run diagnostics,
  evaluation rendering (#29).
- **#50 persistent run-event log**: the durability contract under #16's
  bundle — a stage's event timeline (tool invocations, model calls with
  token counts, sandbox denials in OCSF form per #16 item 6, git
  checkpoints, retries) lands as `events.jsonl` alongside the transcript,
  so failed stages are diagnosable without a re-run, spend reconciles
  against #20's token/cost totals, and security review gets a replay.
  In-product precedent: the task resource already carries a structured
  events timeline — #50 extends it to agent stage runs.
- **#28 versioned prompts**: prompt templates as versioned artifacts (candidate
  home: Apicurio registry per #27, or OCI SkillCard-style packaging —
  `agentic-controller` already has the SkillCard delivery machinery).
- **#29 guardrails/evals**: NeMo Guardrails at tool-call boundaries; Garak/
  EvalHub suites in CI; results rendered per run (#16's evaluation hook).
  Platform floor: K8s 1.33+/OCP 4.20+ (Agent Sandbox) constrains rollout.
- **#49 workflow authoring**: workflow definitions as versioned Hub resources
  (`/workflows`, into the #48 contract from day one) whose stages reference
  curated-registry A2A agents (#16 item 4) and whose stage context rides the
  #16 item 7 Hub-persisted task artifacts; draft → validate → activate
  lifecycle reusing the #45 questionnaire machinery; per-stage governance
  inherited from the factory envelope (#20/#16/#38/#42). Depends on #39's
  harness fixes landing first.

### Wave 5 — Ecosystem & experience
- **#34 plugin architecture**: specification-first catalog of the extension
  points proven in Waves 2–4 (data providers, inference, exporters, trackers);
  conformance tests; ≥2 implementations per point.
- **#27 Apicurio**: registry-backed types for prompts/skills/rules.
- **#36 role-adaptive UI**: navigation blueprint (8 work views +
  Administration hub, global search, RBAC-driven visibility) — gated on
  aggregates (#4/#32) and the #35 baseline; tag taxonomy management pairs with
  `tackle2-seed` (mark seed/managed entities — the seed repo is the natural
  source of that flag).
- **#17 generators** (`quickstart-generators` Helm charts exist upstream —
  customization design extends them), **#2** refinements.

## 6. Enhancement clustering (filing plan)

Filing strategy per the `konveyor/enhancements` process: **adopt existing
issues before filing new ones** — several proposals already have upstream
RFEs/enhancements to build on (marked ✅ below); only the unmarked clusters
need new filings. Statuses verified 2026-11.

| Proposal | Suggestions | Repos | Upstream/JIRA status |
|---|---|---|---|
| Deterministic analyses & incident identity | #7, part of #1 | analyzer-lsp, tackle2-hub, kantra | MTA-7445 (Hub↔IDE divergence), MTA-8155 (resolution parity vs oracles — Dev Complete), editor-extensions#1482 (assertion failing silently); proposal drafted: [deterministic-analyses-and-incident-identity.md](../proposals/deterministic-analyses-and-incident-identity.md) |
| Export standards (SARIF/CycloneDX) | #12, #18 | tackle2-hub, kantra, static-report | *nothing filed upstream — genuinely novel* (JIRA/GitHub searches empty); proposal drafted: [sarif-and-cyclonedx-export.md](../proposals/sarif-and-cyclonedx-export.md) |
| Triage store + run comparison + diff | #33(1–2), #1, #6, #10 | tackle2-hub, tackle2-ui, kai, editor-extensions | ✅ konveyor/enhancements#279 (REST frontend + rule candidate staging for Kai Solution Server) — complement, not duplicate (triage is portfolio data, not example data); MTA-7358 (weight learning by seniority/role); proposal drafted: [triage-store-and-run-comparison.md](../proposals/triage-store-and-run-comparison.md) |
| Batch, events & aggregates API | #33(3–6) | tackle2-hub | MTA-7482 / tackle2-ui#3523 (server-side filter chips — first move); MTA-8247 (tasks:GET scope gap); *webhooks/batch/aggregates unfiled upstream*; proposal drafted: [batch-events-and-aggregates-api.md](../proposals/batch-events-and-aggregates-api.md) |
| Observability baseline | #30, part of #31 | tackle2-hub, operator, addons | ✅ tackle2-hub#335 (closed — Prometheus metrics baseline exists to extend); agentic-controller#192 / MTA-8100 / MTA-8049 (agent accounting/telemetry — in flight) |
| Deployment customization | #31 | operator | ✅ konveyor/operator#543 (open RFE: Structured Tackle CR) |
| Dependency resolution from manifests | #23, part of #24 | analyzer-lsp, kantra | MTA-8155 (Dev Complete — parity oracles); tackle2-hub#1141 + analyzer-lsp#1196/#1192 (internal-repo CA, closed); MTA-8184 (GAV normalization) |
| Vulnerability & coverage issue types | #24, #22 | hub, addons, tackle2-ui | MTA-5973 (indirect-dependency FP RFE); *issue-type model unfiled upstream*; proposal drafted: [vulnerability-and-coverage-issue-types.md](../proposals/vulnerability-and-coverage-issue-types.md) |
| Agentic run reports & persistence | #16, #28, #29, #50 | agentic-controller, tackle2-hub, kai | ✅ agentic-controller#341 (open RFE: persist/visualize transcripts + pod logs, pluggable bucket upload); agentic-controller#192; MTA-7957/58/59 (failed-run UX bugs — New) |
| Governed inference (MaaS) & MCP interop | #20, #19 | agentic-controller, kai, operator | ✅ konveyor/enhancements#259 (Analyzer MCP Server), agentic-controller#256 / MTA-8051 (MCP as Agent attachment spike); MTA-6891 (MCP server docs) |
| Role-adaptive UI & a11y gate | #36, #35, #2 | tackle2-ui | tackle2-ui#3048 (closed — nav grouping exists; persona-adaptivity missing); MTA-7482/tackle2-ui#3523; MTA-6821 (a11y/persona verification doc); editor-extensions#1482 (silent test failure — gate motivation) |
| Wave planner & combined risk | #25, #32, #4, #14 | tackle2-hub, tackle2-ui | ✅ tackle2-ui#3694 (open use case: plan waves from declared dependencies); MTA-8044/8045/8261 (dependency-based archetype criteria); MTA-8184 |

Wave-0 friction items not needing enhancements (repo issues): task filters,
302→401 auth, Reason columns, Skills/Agents detail views — plus the three
New agent-run UX bugs (MTA-7957/58/59) that match this evaluation's findings.

**Routing of the v0.5+ suggestions** (added from field evidence and the
mock/agentic work — each entry names its route, wave, and draft text):

| Suggestion | Route | Wave / conditions | Notes |
|---|---|---|---|
| #37 Jira Cloud tracker compatibility | repo issues (no enhancements); drafts: Route 3 A8/A9 | Wave 2 | protocol half complemented by the Jira/Tracker view workup (issue 17 below) |
| #38 task-queue resilience | Route 2 issue 10 | Wave 0 | draft text ready |
| #39 agentic harness production-readiness | repo issues; drafts: Route 3 A8/A9 | Wave 4 | |
| #40 pluggable tracker SPI | Tier B — rides the #34 plugin KEP | filed only after #34's ADR closure (Route 3 register) | #37's Jira fix is its first plugin |
| #41 multi-tenancy | Route 1 comment 8 — extends enhancements#110 (open since 2023-03, stale-labeled) | — | field context + broadened scope; no new issue |
| #42 Hub audit logging | Route 1 comment 9 — answers the open audit question in enhancements#266 (long-lived API keys) | — | no new issue; concrete settings-change case = issue 14 below |
| #43 in-console help system | Route 2 issue 11 (plain feature issue — no feature template in `tackle2-ui`) | Wave 0 | help grows with the UI; docs links are #35-gate checked |
| #44 wizard-driven onboarding | Route 2 issue 12 | Wave 0 | wizard framework + 3 highest-leverage flows (import, tracker connection, agentic run launch) |
| #26 item 9 (repo-link ask: clickable repo URLs, run commit refs) | Route 2 issue 13 | Wave 0 | small `tackle2-ui` UX gap, no KEP — severable from #26's Wave-4 IDE work |
| #45 archetype lifecycle | Route 3 Tier A entry A10 (`tackle2-ui` use-case issue; rules engine in `tackle2-hub`) | Wave 3 | anchors MTA-8172, MTA-8044/8045/8261, MTA-8184; risk-provenance half folded into #32 item 6 |
| #46 wave execution tracking | Route 3 Tier A entry A11 (`tackle2-ui` use-case issue extending the #3694 planning thread — Route 1 comment 7) | Wave 3 | API half folded into #33 item 10 (actuals/gates/rollups); planned-vs-actual wiring note in #14 |
| #47 verification & integration testing | Route 3 Tier A entry A12 (use-case issue extending the A11 execution thread) | Wave 4 | gate wiring → #46 item 2; evidence artifacts → #16's references; test-generation row → #36 plugin table; Tier-1 filing cluster |
| #50 persistent run-event log | Route 1 comment 4 — extends agentic-controller#341's bundle proposal, not a new filing | Wave 4 | durability contract: `events.jsonl` (tool invocations, model calls with token counts, OCSF sandbox denials per #16 item 6, checkpoints, retries) so spend reconciles against #20's totals and failed stages are diagnosable without a re-run |
| #48 Hub API as a supported contract | Route 3 Tier B register (design-first; seed = implementation.md §9 + the contract-v2.1 reference implementation in `deliverables/hub-backend`) | Wave 1 | anchor MTA-5128 (stale published OpenAPI spec); #49 composes into this contract from day one |
| #49 workflow authoring | Route 3 Tier B register — rides the #34 plugin KEP | Wave 4 | workflow definitions as versioned Hub resources (`/workflows`), into the #48 contract from day one |
| #51 multi-lingual console UI | Route 3 Tier A entry A13 (`tackle2-ui` use-case issue) | Wave 5 | 8 locales + RTL + per-locale currency demonstrated in the mock; per-user persistence |
| #52 light/dark color scheme | Route 3 Tier A entry A14 (feature issue — no KEP) | Wave 5 | Red Hat theming model; persisted + deep-linkable; contrast-safe token remap |
| #53 collapsible nav sidebar | Route 3 Tier A entry A15 (feature issue — no KEP) | Wave 5 | masthead ☰ toggle + per-user preference; explicit grid placement when the sibling hides |

**Routing of the view workups** (console-view audit dispositions — where
each view's findings landed):

| View workup | Filed | Findings landed |
|---|---|---|
| General Configuration | Route 2 issue 14 (self-documenting/validated/audited settings view) | #33 item 11 fold-in (settings manifest, validation, export/import); #42's audit facility is its concrete case; the Git view workup strengthened the evidence (Git/SVN pages are also single hardcoded switches, holding `git.insecure.enabled`/`svn.insecure.enabled`) + one-line aria-label drive-by bug for the filing checklist |
| Subversion | nothing new — findings already carried by issue 14 | its one delta: the three one-switch repository pages (Git/SVN/Maven) collapse into a single manifest-driven "Repository access" entry — folded into #26's Administration-hub blueprint (*Platform* section) |
| Maven | nothing new | issue 14 paragraph (documented-toggle inconsistency, analyzer-lsp#1190's no-op insecure-switch history, half-wired `mvn.dependencies.update.forced`) + cache-effectiveness clause in #30 item 2 (kantra#808) |
| Proxy | Route 2 issue 16 | scope display, NO_PROXY exclusions, reachability test — anchor tackle2-hub#420 (tracker traffic bypassing the proxy) |
| Jira / Tracker | Route 2 issue 17 | sync-outcome visibility, server-side connection status replacing the client-side 8-second timer, guarded lifecycle — anchors tackle2-ui#3111/#3224; complements #37's protocol half and #46's ticket-state rendering |
| Assessment questionnaires | Route 1 comment 11 (on open tackle2-ui#2749 import-validation — first view whose largest gap already had an upstream home) | guard half → #45 item 5 (usage/outdated warnings); export half → #33 item 11 (questionnaires as versionable documents) |
| Source platforms | Route 1 comment 12 (on open tackle2-ui#2566 connection-status) | carries issue 17's trustworthy-status pattern; cross-links enhancements#293's offline-discovery gap; discovery-wizard findings already in Route 1 comment 10 + issue 12 |
| Generators | Route 1 comment 13 (on open tackle2-ui#2498 parameters — keystone of a six-issue cluster) | the #2595 removal makes parameters a regression; schema-as-contract argument generalizes #33 item 11's manifest |
| Task manager | nothing new (honesty pass) | the audit of this view generated Suggestions 3/30/36/38/33; upstream `main` partially delivered filtering/priority/task-log since 8.3.3 (markers in §3.1, #36 item 6, #30 item 2; queue-health header still absent); tackle2-ui#2543 (Platform column) cross-linked to Source platforms |
| Users | nothing new | directory-split finding (User management vs. hand-maintained Stakeholders, nothing binding the two) → #36 Controls clause (a); ID-desc instance → #36 root-cause list; Tokens-tab evidence → Route 1 comment 9 |
| Tokens | nothing new (same surface as Users, view-level) | management-UX asks (last-used signal, expiry warnings, sane lifespan defaults — hub#1082 open lifespan bug, editor-extensions#1451 unrealistic-duration history) → comment 9's management-UX clause; filing checklist gained hub#1082 and #3418↔MTA-7152 twin links |
| Roles | nothing new (RBAC direction is enhancements#110 / comment 8's) | flat-scope dual-list finding → #36 item 2 admin half (resource-grouped scope picker); role-usage visibility → #33 item 9 (`/roles/{id}/consumers`) |
| Scopes | nothing new | bare name/resource/verb registry → #36 item 2 as the picker's missing data source; never-populated header tooltips as its demand signal |
| Credentials | Route 2 issue 15 | usage visibility, effective-credential display, verify action; API half → #33 item 9 (identity reverse relations); scoping half → #41 (agentic-controller#288) |

**Filing actions:** (1) comment on and extend the five ✅-marked issues with
this program's designs rather than filing duplicates; (2) file the new
enhancements — all five new-filing clusters now have complete draft
proposals in this workspace ([deterministic-analyses-and-incident-identity.md](../proposals/deterministic-analyses-and-incident-identity.md), [triage-store-and-run-comparison.md](../proposals/triage-store-and-run-comparison.md), [sarif-and-cyclonedx-export.md](../proposals/sarif-and-cyclonedx-export.md), [batch-events-and-aggregates-api.md](../proposals/batch-events-and-aggregates-api.md), [vulnerability-and-coverage-issue-types.md](../proposals/vulnerability-and-coverage-issue-types.md)), ready for PR after
maintainer review; the export-standards, batch/events, and issue-type
clusters are the strongest novelty claims in the program; (3) link
MTA-7957/58/59 fixes to the run-report RFE so the UX bugs and the
persistence design land together.

### 6.1 Repository impact matrix

Impact per implementation item. Legend: **P** = primary (design + code land
here), **S** = secondary (schema/contract/UI changes to consume or support),
**D** = docs/CI-only. Volume: S/M/L ≈ days/weeks/multi-week.

#### Wave 0

| Item | tackle2-ui | tackle2-hub | kantra | editor-extensions | operator | Other |
|---|---|---|---|---|---|---|
| #35 UI quality gate | **P** (harness, registry, baseline, CI) | D (OpenAPI drift check) | — | S (reuse harness for webview-ui; #1482 fix) | — | `static-report` S (same scan) |
| #3 task diagnostics | **P** (alerts, timeline, filters, columns) | **S** (GET /tasks filter params) | — | — | — | addons D (structured-error contract) |
| #15 mta-ops safety | — | — | — | — | — | downstream mta-ops **P** (CLI) |
| #5 SSO hardening | S (login flow) | **P** (401 middleware, PAT UX) | D (auth docs) | S (token/SSO config) | S (realm packaging) | Keycloak theme decision |
| #11 report parity | — | S (report generation CI) | S | — | — | `static-report` **P** (contract test) |
| #13/#21 docs | D | D | D | D | — | konveyor.github.io / community D |

#### Wave 1

| Item | tackle2-ui | tackle2-hub | analyzer-lsp | kantra | operator | Other |
|---|---|---|---|---|---|---|
| #7 determinism | S (toolchain display) | **P** (analysis model + toolchain manifest) | **P** (sort keys, stable output) | **P** (`--strict`) | — | `rulesets` S (bundle digests); harness repo **P** (new) |
| #12 export | S (export menu) | **P** (SARIF/CycloneDX endpoints) | — | S (`--output-format`) | — | schema-validation CI in tackle2-hub |
| #33 API extensions | **S** (consume triage/diff/aggregates) | **P** (triage store, diff, batch, webhooks, aggregates, tag-usage) | — | — | — | `kai` **S** (MCP solution server exposes triage) |
| #30 observability | — | **P** (metrics, OTEL spans) | — | S (CLI metrics) | **P** (dashboards, alerts, `up==0` rules) | addons S (OTEL SDK) |
| #31 deployment CR | — | — | — | — | **P** (CR schema, validation, status) | — |

#### Waves 2–5 (per cluster)

| Cluster | Primary repos | Secondary repos |
|---|---|---|
| #23 dependency resolution | `analyzer-lsp` (java provider), `kantra` | `maven-search-index`, `tackle2-hub` (resolution state), `editor-extensions` |
| #22/#24 SCA + issue types | `tackle2-addon-analyzer` / new addon, `tackle2-hub` | `tackle2-ui`, `editor-extensions`, `static-report` |
| #18 standards | `enhancements` (policy), all repos (boundaries) | — |
| #1/#6/#10 triage & diff | `tackle2-hub` (triage store, diff), `tackle2-ui` | `kai` (MCP triage tools), `editor-extensions` (sync UI), `static-report` |
| #4/#32/#25/#14 reporting & planning | `tackle2-hub` (aggregates, planner), `tackle2-ui` | `tackle2-seed` (tag-grouping data) |
| #16/#28/#29 run reports & guardrails | **`agentic-controller`** (persistence, bucket upload, ADR revision), `tackle2-hub` (run-record API) | `tackle2-ui` (run views), `kai`, guardrail/eval infra |
| #20/#19 MaaS & MCP | `agentic-controller` (Gateway defaults/fallbacks), `kai` (MCP server extension) | `operator` (MaaS workload), `tackle2-ui` (gateway views), `editor-extensions` |
| #34 plugin architecture | `enhancements` (specs), all provider repos | `ci` (conformance) |
| #27 Apicurio | new integration repo/addon | `apicurio` (upstream), `agentic-controller` (skill/prompt storage) |
| #36 role-adaptive UI | **`tackle2-ui`** (nav, workspaces, search) | `tackle2-seed` (seed/managed flags), `tackle2-hub` (role prefs) |
| #17 generators | `quickstart-generators` | `asset-generation`, `operator` |

#### Per-repo change summary (whole program)

| Repo | Items touching it | Volume | Dominant change types |
|---|---|---|---|
| `tackle2-hub` | #3,#5,#7,#12,#33,#30,#10,#4,#32,#25,#16,#36 | **L** | API endpoints + OpenAPI, data model (triage, toolchain, run records), exporters, webhooks, metrics |
| `tackle2-ui` | #35,#3,#36,#1,#2,#4,#8,#32,#16,#20 | **L** | views/detail levels, filters, export menus, navigation IA, a11y fixes |
| `agentic-controller` | #16,#19,#20,#28,#29 | **M-L** | run-record persistence (ADR revision), Gateway defaults/fallbacks, MCP attachments, prompt/persistence CRs |
| `analyzer-lsp` | #7,#23,#24 | **M** | deterministic output, manifest-first resolution, structured errors |
| `kantra` | #7,#12,#23 | **S** | flags, toolchain reporting, export plumbing |
| `kai` | #19,#10,#16,#26 | **M** | MCP tool surface (triage/inventory), confidence surfacing |
| `editor-extensions` | #26,#10,#23 | **M** | two-way sync UI, triage rendering, MCP consumption |
| `operator` | #31,#30,#5,#20 | **S-M** | CR schema + validation, dashboards/alerts, realm packaging |
| `static-report` | #11,#35 | **S** | parity contract test, a11y scan |
| `tackle2-seed` | #36 | **S** | seed/managed metadata flags |
| `rulesets` / `maven-search-index` | #7,#8,#23 | **S** | digests, index reliability |
| `enhancements`, `ci`, docs repos | all | **S** | proposals, conformance CI, documentation |

**Sequencing note:** `tackle2-hub` and `tackle2-ui` are the highest-contention
repos — the wave plan's stream separation (engine vs. platform/API vs. UI)
exists precisely so their change sets don't block each other; within them,
#33's endpoints should merge incrementally (triage → diff → aggregates →
batch → webhooks) to keep review velocity.

### 6.2 Repository impact per drafted proposal

The five drafted enhancement proposals (this workspace, `proposals/`),
with the repos each PR touches. Legend as in §6.1: **P** primary,
**S** secondary, **D** docs/CI-only.

| Proposal | Primary (P) | Secondary (S) | Docs/CI (D) |
|---|---|---|---|
| [deterministic-analyses-and-incident-identity.md](../proposals/deterministic-analyses-and-incident-identity.md) | `analyzer-lsp` (deterministic ordering, payload hygiene), `tackle2-hub` (toolchain manifest, identity function, carry-over), `kantra` (`--strict`, manifest display) — the only multi-primary proposal | `rulesets` (bundle digests), `static-report` (manifest footer), `kai` (mirrored identity fn) | harness repo — `go-konveyor-tests` jobs or new `determinism-harness` (P there); nightly zero-diff CI |
| [triage-store-and-run-comparison.md](../proposals/triage-store-and-run-comparison.md) | `tackle2-hub` (triage/history tables, endpoints, carry-over execution, event emission) | `tackle2-ui` (badges, edit affordance, diff view, re-confirm prompt), `kai` (MCP triage tools), `editor-extensions` (consume MCP surface), `static-report` (render triage state) | OpenAPI in-PR; RBAC scope packaging in `operator` realm |
| [sarif-and-cyclonedx-export.md](../proposals/sarif-and-cyclonedx-export.md) | `tackle2-hub` (export endpoints, serializers in `shared/`, settings flags) | `kantra` (`--export-sarif` local export), `tackle2-ui` (export menu entries) | schema-validation CI job; consumer smoke tests (GitHub code scanning, `cyclonedx-cli`) |
| [batch-events-and-aggregates-api.md](../proposals/batch-events-and-aggregates-api.md) | `tackle2-hub` (batch endpoints, Webhook + delivery-log model, delivery worker, aggregate queries, tag usage) | `tackle2-ui` (webhook admin view, aggregates consumption replacing client-side rollup) | OpenAPI in-PR; `operator` none in v1 (delivery worker is in-process) |
| [vulnerability-and-coverage-issue-types.md](../proposals/vulnerability-and-coverage-issue-types.md) | `tackle2-hub` (type field, payload schemas, effort exclusion, identity variant, coverage correlation, RHTPA sync task) | `addons` (RHDA/Exhort task, coverage import task — or a new addon repo), `tackle2-ui` (type filter, CVSS/CVE columns, dashboard breakdown), `static-report` (inherits parity from Hub data) | payload schemas served with OpenAPI; CI service container for RHTPA/Exhort mocks |

**Observations:**

1. `tackle2-hub` is primary in **all five** proposals — it is the only repo
   every proposal touches, which confirms the §6.1 contention note and
   argues for landing them in dependency order (identity → triage →
   aggregates/batch → exports → issue types) rather than in parallel.
2. Proposal 1 (determinism) is the only one with **three primary repos** —
   it is an engine-surface change, while the other four are
   platform/API-surface changes; this matches the wave plan's stream
   separation.
3. `kantra` and `static-report` are never primary — they are surfaces over
   Hub/analyzer data, so their changes are consumers of the proposals'
   contracts.
4. The `enhancements` repo itself is impacted by all five (the proposal PRs
   plus the implementable/implemented milestone merges).

### 6.3 Effort estimates per proposal

Order-of-magnitude engineering estimates in **engineer-weeks (ew)**,
assuming senior engineers already familiar with each codebase, including
unit/integration tests, contract tests, and OpenAPI/spec documentation in
the same PR; excluding community review cycles, QE sign-off, the downstream
MTA port, and on-call/steady-state support.

| Proposal | analyzer-lsp | tackle2-hub | tackle2-ui | Other | **Total** |
|---|---|---|---|---|---|
| ① determinism + identity | 3 (sort key, payload-hygiene audit) | 4.5 (manifest 2, identity/carry-over fn + contract tests 2.5) | — | kantra 1, rulesets 0.5, harness 2.5, static-report/kai 0.5 | **≈ 12 ew** |
| ② triage + diff | — | 5.5 (tables/endpoints/OpenAPI/RBAC 3.5, carry-over wiring 0.5, diff 1.5) | 3.5 (badges/edit/history 2, diff view 1.5) | kai 1.5, editor-extensions 1.5, static-report 0.5 | **≈ 12.5 ew** |
| ③ SARIF/CycloneDX export | — | 3 (serializers, streaming, endpoints) | 0.5 (menu) | kantra 0.5, CI validation/smokes 1, NFR tuning 0.5 | **≈ 5 ew** |
| ④ batch/events/aggregates | — | 7.25 (batch 1.5, webhooks+worker+HMAC+log 3.5, aggregates+parity 2, tag usage 0.25) | 2.5 (webhook admin 1.5, aggregates 1) | — | **≈ 10 ew** |
| ⑤ vulnerability/coverage types | — | 4.5 (type+schemas+effort-exclusion parity 2.5, identity variant 0.5, RHTPA sync 1.5) | 2 (filters, CVSS columns, dashboard) | tackle2-addon: Exhort 2, coverage 2.5 | **≈ 11 ew** |

**Program total ≈ 50 ew** (≈ one engineer-year of implementation), or
**3–4 calendar months with a 3–4 person team** aligned to the wave plan's
streams — plus review cycles and the 7-night determinism gate
(≈ 2 weeks calendar) before a release cut.

Reconciliation with the suggestions doc: the per-suggestion S/M/L
estimates (#7 M, #33 M, #12 S–M, #22 M, #24 M) are consistent in *relative*
ordering; the proposal totals are higher because they price what
suggestion-level estimates do not — cross-repo integration (② touches four
repos, ① has three primaries plus a harness), the E2E/contract-test suites,
in-PR documentation, and the §11 NFR targets.

Cost drivers and sequencing consequences:

1. **① is the keystone and the schedule gate** — every other proposal
   consumes its identity function; the analyzer payload-hygiene audit is
   the least-bounded item. Land first (matches the wave plan).
2. **Dependency order:** ① → ② → ④ → ⑤; ③ is the standalone quick win
   (≈ 5 ew, soft dependency only on ①'s fingerprint reuse — shippable
   without it, fingerprints added later as a contract addition).
3. **② 's risk is the E2E round-trip**, not the CRUD — the
   editor-extensions Playwright path across Hub + kai MCP is the tricky
   integration.
4. **④ 's webhooks are the only genuinely new infrastructure** (worker,
   signing, delivery log); everything else extends existing Hub patterns.
5. **⑤ 's hidden cost is effort-exclusion parity** across ~6 surfaces at
   once, plus format-fiddly coverage correlation (JaCoCo inner classes,
   Go paths).

### 6.4 Filing status of the drafted proposals

All five drafts are **new filings** — none exists upstream today, and none
has been filed by us yet (they exist only in this workspace, ready as PRs
against `konveyor/enhancements` at the `provisional` milestone). Verified
via JIRA/GitHub searches, 2026-11.

| Proposal | New filing? | Upstream relationship | Filing coordination |
|---|---|---|---|
| ① determinism + identity | **Yes — new** | Related *evidence* issues only (MTA-7445, MTA-8155, editor-extensions#1482) — motivation, not proposals | Straightforward PR; lead with the divergence evidence |
| ② triage + diff | **Yes — new** (closest call) | **enhancements#279** (Kai Solution Server REST frontend + rule candidate staging) is *adjacent*: solved-example staging vs. Hub portfolio triage data | Open the PR with a cross-reference comment on #279 so its participants review the complement, not a perceived duplicate; the Alternatives section already records why triage does not live in the solution server |
| ③ SARIF/CycloneDX export | **Yes — new** | JIRA/GitHub searches empty — strongest novelty claim | Lead the PR description with the empty-search evidence (recorded in the proposal's Motivation) |
| ④ batch/events/aggregates | **Yes — new** | Related consumer-side *moves* only (MTA-7482 / tackle2-ui#3523 server-side filter chips; MTA-8247 tasks:GET scope) — not the API extensions | Same novelty-evidence framing as ③; link MTA-8247 as the adjacent RBAC fix |
| ⑤ vulnerability/coverage types | **Yes — new** | MTA-5973 (indirect-dependency FP RFE) related but different; the issue-type model itself is unfiled | Note the 8.3.3 rhda-ruleset observation as live evidence; MTA-5973 linked as related |

By contrast, the **other six clusters** in the §6 filing plan follow the
adopt-and-extend route (build-on existing upstream issues — the five
✅-marked items plus the observability baseline), per Filing Actions above:
enhancements#279, tackle2-hub#335, operator#543,
agentic-controller#341, enhancements#259 (+ agentic-controller#256),
tackle2-ui#3694. Suggestions 41 and 42 (v0.5) join this route with two
more build-on targets: **enhancements#110** — the multi-tenancy RFE
open (and `stale`-labeled) since 2023-03; Route 1 comment 8 revives it with
field context and the broadened scope (Suggestion 41's §3.27 design) — and
**enhancements#266** — the long-lived API-key enhancement whose body asks
"How should API key usage be audited/logged?"; Route 1 comment 9 answers it
with Suggestion 42's audit-log design. Comment 10 (v0.5) extends the
adjacent pairing **tackle2-ui#3704 + tackle2-hub#1177** — repo-linking and
onboarding-time repository validation — with the field-validated
import-failure evidence behind Suggestion 44's import wizard.

Filing mechanics per the `konveyor/enhancements` process: socialize the
idea with the relevant maintainers first, then one single-topic PR per
proposal at the `provisional` milestone, with further PRs at each status
transition (provisional → implementable → implemented). Pre-file checklist:
author handle confirmed (`@jcordes73`); reviewers/approvers assigned from
upstream evidence — remaining TBDs: a tackle2-ui maintainer for ④ and an
RHDA/RHTPA-facing reviewer for ⑤, to be named during socialization; for ②
coordinate timing with #279's participants (both are now among its
reviewers).

## 7. Risks and open questions

1. **Upstream/downstream split:** `mta-ops`, RHDA integration, and MTA branding
   are Red Hat downstream; contributions land upstream first. Each enhancement
   proposal should state its downstream-ship vehicle (MTA release train).
2. **Incident identity** (rule+file+line+snippet-hash) is the keystone for
   #1/#6/#33/#16 — align with kai's incident storage before implementing.
3. **Agent run persistence (#16) revises an upstream ADR** (ephemeral
   workspaces); expect design debate — scope it to *run records*, not
   workspaces, and offer opt-in retention.
4. **Platform floor for agentic features** (K8s 1.33+, Agent Sandbox v1.0.x,
   ImageVolume gate) constrains Wave 4 rollout targets.
5. **Webhooks** are new ops surface for the Hub — smallest version first
   (single delivery + log).
6. **Agentic API velocity:** 8.3.3's agentic paths are not in upstream main
   yet; re-validate Wave 4 designs at entry.
7. **Capacity:** waves assume ~4 parallel streams; single-team delivery makes
   Wave 0's quick-win value even more important.

---

---

## 19. Console governance design decisions (from the UI mockup)

The UI mockup's verification arc (`deliverables/ui-mockup/index.html`, recorded in
[use-case-verification.md](../deliverables/ui-mockup/use-case-verification.md)) produced a set
of concrete console-design decisions that are **not** suggestions from the
catalog — they are governance requirements worked out during mock iteration
(most at user request) and implemented as in-memory behavior with verified
regression suites (tenancy 49 · RBAC 167 · waves 27). They are backfilled here
because they are design decisions the console work would inherit, not just
mock trivia. The behavior record and reproduction steps live in the
use-case-verification doc; this section captures the decisions themselves.

### 19.1 Governance invariants

| Invariant | Design decision |
|---|---|
| Application ownership | Every application has exactly one owner: boot-derived from the team roster (first architect, else first member), required in the application form, and delete-guarded — a stakeholder who owns an application cannot be deleted. |
| Business-service ownership & description | Every business service has an owner and a non-empty description; both are required in the create/edit modal (save refuses with a field error naming the accountable role). Boot data is fully conformant — the em-dash placeholder never fires at boot. |
| Stakeholder org membership | Every stakeholder belongs to exactly one organization: `org` is stamped at boot derivation (persons derive from team rosters), required in the Add-stakeholder modal (org admins are locked to their own org; the platform administrator picks), and drives the auto-email (address follows the org's domain). The early "unaffiliated" carve-out was removed when org became required. |

### 19.2 Identity binding (Users ↔ Stakeholders)

Upstream splits user management (IdP-backed directory) from hand-maintained
Stakeholders with nothing binding the two (filed into #36 Controls clause (a),
§6). The mock's design for binding them:

- The binding map **derives by construction**: one row per stakeholder record,
  link column computed from the record set — a stale binding degrades to an
  amber "stale binding" state, never a ghost ✓.
- Logins are emails; a bound login equals the record's email. IdP-only
  accounts (no stakeholder record) render as promote candidates.
- Job function derives from the linked record, not from the role key.
- Status column (active/inactive) with icon actions `fa-user-slash` /
  `fa-user-check`: toggling is a directory verb (the stakeholder record is
  untouched) and is audited as `user:deactivate` / `user:activate`.

### 19.3 Tenancy model (orgs · departments · teams · persons)

Extends #41 (Route 1, enhancements#110) with the concrete model the mock
implements:

- **Admin tiers**: the organization admin manages one org; the **platform
  administrator** spans orgs. Cross-org pivots are first-class actions,
  announced by toast and audited (`tenant:access`, `tenant:provision`).
- **Persona tenancy locks**: the Project manager and Migrator are locked to
  their home team — the org switcher disables with a tooltip pointing at the
  persona that holds the scope, and deep-link `&org=`/`&team=` params lose to
  the lock.
- **Org-scoped person-pickers**: the business-service owner picker, the
  application owner picker (scoped to the owning team's org), and team roster
  pools (scoped to the team's org) filter strictly by stored org; only the
  platform administrator sees all orgs. Stakeholder-group member check-lists
  are deliberately cross-org (groups bind global waves).
- **Departments** are CRUD-managed with a `depts:*` scope family, and
  department changes cascade into the Applications filter/form.
- **Notifications are role- AND org-filtered**: every feed item declares
  `data-for` (role) and `data-org`; an org admin's feed is role-blanket but
  org-clamped, the platform administrator's is org-blanket but role-clamped.
  The bell badge **derives from the same filtered count** (never hard-coded)
  and hides at zero.
- **Cross-tenant audit trail** (extends #42): every governance verb is
  recorded as a `tenant:verb` entry (access pivots, provisioning,
  deactivations, CRUD cascades) with actor + target; the trail is visible to
  the platform administrator across orgs.

### 19.4 Visibility & navigation decisions

- **Reports excludes the Migrator** (five of six personas): the migrator's
  surfaces are queues and records — its run state, event logs, and cost
  accounting live on the run record itself — while Reports aggregates answer
  portfolio questions for the people who own the portfolio. Deep-link guard
  pinned in the RBAC suite.
- **Architect responsibility levels** (application · team · department ·
  organization) scope what an architect sees and edits, per level.
- **Tab ordering by admin importance**: the Administration hub orders its tabs
  by how often admins touch them (Controls first; Controls sub-tabs: Business
  services, Stakeholders, Stakeholder groups, Job functions, Tags, Teams,
  Departments, Organizations); Credentials was promoted out of the hub to a
  first-class view (team-owned resources, team ops).
- **Credential readiness is a wave GATE condition, not a card** (#46
  definition-of-done): the check appears in the wave's Gate status list —
  gate *state* for everyone gating the wave, management stays
  `identities:*` on the Credentials view.
- **Table pagination idiom**: one shared pager widget (real
  `pf-v6-c-pagination` markup) with two integration modes — display-toggle
  for tables whose rows must stay in the DOM for cross-module lookups and
  selection semantics (cross-tenant audit trail — the one unbounded-growth
  table, newest-page-first; task queue — pages compose with the filter chips),
  slice paging for renderers that rebuild rows (Stakeholders). Applied to the
  three growth tables; the 2–8-row config tables deliberately stay unpaginated
  (paginate scale, not everywhere).

### 19.5 Design-system standard (RHDS alignment, defect rows 73–92)

A full alignment pass against the Red Hat Design System (ux.redhat.com) set
the visual/interaction standard the console inherits. The two systems split
by surface: **PatternFly 6 governs component markup and chrome** (genuine
`pf-v6-c-*` widgets and `--pf-t--*` tokens inside PF components), **RHDS
governs the brand layer** — Red Hat fonts, accessibility practice, the AI
guidelines — and its `--rh-color-*` crayons, space, font-size, box-shadow,
border-radius, and opacity tokens are the required source for everything in
the mock's own layer (no raw hex, px spacers, decimal opacity; defect rows
74, 77, 79, 80). Top-level content layout sits on the RHDS fluid **12-column
grid base** (row 93): `.grid12` containers with whole-track spans, collapsing
to the 2-track mobile grid below 768px; component-internal grids stay PF6.
Durable interaction decisions:

- **One focus ring for every interactive element** (row 78): solid 3px
  `--rh-color-border-interactive`, 3px offset, `:focus-visible` only; no
  per-component focus styles, no `outline:none`.
- **Layered dismissal + focus management** (rows 89, 91): Escape closes
  drawers → modals → menus → filter menus → hover card → annotation tip;
  dialogs move focus inside on open, trap Tab, and restore focus to the
  opener (`focusToggle` re-queries by id — re-renders replace openers);
  menu-dropdowns focus their first item on expand and return focus to the
  toggle on Escape/selection; hover-revealed tips are dismissable,
  hoverable, persistent (WCAG 1.4.13).
- **Color SCHEMES, light/dark only** (rows 83–85; promoted to catalog
  Suggestion 52, row 101): `pf-v6-theme-dark` on
  `<html>`, persisted, deep-linked via `&scheme=`; the masthead and
  annotation tooltip are pinned dark in BOTH schemes (never the
  scheme-relative PF inverse tokens); any surface that keeps light-scheme
  text under the dark theme needs the inverse crayon flip.
- **Component idioms** (rows 86–88, 92, 94): exactly one `pf-m-primary` button
  per view; headings are the PF6 Title component (`pf-v6-c-title` — `pf-m-xl`
  h1 page titles, `pf-m-lg` h2 drawer/modal headings; never inline-styled or
  hand-rolled headings); deletion triggers are secondary-styled, danger
  reserved for the confirmation modal's submit (row 95, PF Actions pattern);
  the mock's own animations use PF6 motion tokens with reduced-motion
  collapse keyed to the OS setting (row 96, PF Motion foundation); table
  sort glyphs come from the RHDS `<rh-sort-button>`
  implementation (stacked double-triangle unsorted, single triangles sorted,
  `aria-sort` in sync); pagers hide on zero results; filter selections are
  `pf-v6-c-label` + close (PF6 removed Chip); code blocks ≥5 lines carry
  Expand/Collapse and a Copy action in the header; native `<select>` inputs
  always carry `pf-v6-c-form-control`; menu groups ≤7 items with group
  headings; the toasts follow the RHDS Toast style page (fixed top-right
  corner, drop shadow, slide-in, close button, 8s auto-dismiss,
  non-blocking `role="alert"`).
- **AI transparency standard** (rows 89–91, binding for all AI-enabled
  surfaces): agent runs keep full attribution (agent name, gateway + model,
  token/cost showback, timestamped events); run records also surface the
  per-stage loop telemetry — agent-loop turns and context-window usage as
  current/max/percent (row 105; the canonical record's peak-context table
  generalized to every agent-run surface); AI-generated records carry the
  dual indicator — `ai-experience` sparkle + "AI-generated" text in the
  heading (purple, the sanctioned informational-AI hue; light
  `--rh-color-purple-60` / dark `--rh-color-purple-30`); sparkle icons never
  appear without AI text or on non-AI content; robot icons never represent
  non-chat AI; no AI-specific color coding or gradients; no first-person AI
  persona anywhere.
- **Deliberate differences from RHDS defaults** (recorded, do not "fix"):
  9 sidebar nav items vs the RHDS primary-nav max of 5 and 6–8-tab
  tablists (console IA, mirroring the real MTA console); no Breadcrumb
  (the tenancy path is a state switcher, not page navigation); no Back to
  top (no screen exceeds the >2-screens threshold); risk labels instead of
  Health-index A–F boxes; Popover/Avatar/Spinner and the marketing elements
  (Announcement, Audio player, Readtime, Site status, Video embed) are out
  of console scope, as are the Personalization section and the theming
  variants (Customizing, Color Palettes, Project Felt).
- **Pagination + mutation affordances** (row 106): the seven secondary
  tables (workflow runs, agent runs, workflows, agents, skills,
  credentials, risk provenance) page through the shared pager factory in
  display-toggle mode — rows stay in the DOM so record jumps and cross
  surface lookups never break, and jumps are page-aware; the inventory
  bulk bar carries a two-step armed Delete (secondary trigger, danger
  only when armed, one attributed `applications:delete` audit record per
  batch), and analysis queueing is STATE-gated, not scope-gated: only
  `notstarted`/`succeeded` applications queue — the gate disables with an
  explanatory tooltip at every Queue surface (bulk bar, per-app modal,
  flagship template) and must survive RBAC re-passes (`data-gate-disable`
  keeps applyRbac from re-enabling state-disabled buttons; scope gating
  still applies on top). Any port (ui-react) or backend must reproduce
  the state rule, not just the UI affordance.

---

## 20. Console navigation & screen anatomy (abstract)

*Added v0.5 (2026-11-16). The abstract model behind the UI mockup
(`deliverables/ui-mockup/index.html`, ported to `deliverables/ui-react/`): what navigational and
screen elements exist, how they compose, and which suggestion (#N in
`evidence/mta-improvement-suggestions.md`) each implements. The wireframes in
§20.5 are derived from this model — greyscale structure, not visual
design; the visual layer (PatternFly 6 + RHDS tokens, theming, icon set)
is governed by §19.*

### 20.1 Application shell (persistent chrome)

Every screen renders inside one shell of four persistent regions:

| Region | Elements | Suggestions |
|---|---|---|
| **Masthead** (dark in both schemes) | brand tile + product title | — |
| | persona toggle group (Architect · Project mgr · Program mgr · Migrator · Admin · Platform admin) — switches the whole workspace, not just the nav | #36, #41 |
| | tenancy switcher (organization → department → team) — clamps every list, table and aggregate | #41 |
| | architect-responsibility menu (what the role is on the hook for) | #36, #41 |
| | annotation layer: Annotations switch + "Suggestions" menu — shows/hides the purple #N badges and their tips | #35 (auditability of the design), all |
| | task-queue quick access with live count | #30, #38 |
| | notification bell + drawer — role- and organization-filtered events (provisioning audit, wave windows, assigned incidents, task-queue backlog) | #42, #41, #46, #30 |
| | light/dark scheme toggle | #52 |
| | language switcher (8 locales incl. RTL) | #51 |
| | help menu with per-view docs deep-links and tour relaunch | #43, #44 |
| **Sidebar** (collapsible) | 9 primary-nav items: Home, Applications, Incidents, Migration waves, Reports, Agentic, Credentials, Administration, Task manager — the last two visible to admin personas only | #53, #36, #41 |
| | tenancy explainer hint (what the switcher scopes) | #41 |
| **Content region** | per-screen page title + subtitle (the screen's job in one sentence) | #43 (guided framing) |
| | everything deep-linkable: `#scr=…&persona=…&org=…&dept=…&team=…&tab=…&drawer=…&scheme=…&lang=…&anno=1` — shareable state at the shell level | #2 (shareable views) |
| **Overlay layer** | right-side drawer (row detail), modal (triage, confirmations), notification drawer, Swagger-UI OpenAPI modal | #33, #48 |

RBAC is *enforced, not depicted*: navigation, deep links, row verbs and
bulk actions are all persona-guarded (#36, #41).

### 20.2 Screen archetypes

The ten screens are compositions of five archetypes, not ten unrelated
layouts:

1. **Persona landing** — one page per role answering that role's first
   question; KPI stat tiles on a 12-column grid + work tables (#36, #4,
   #32, #30).
2. **Table workspace** — toolbar (search, saved/shared filter views,
   bulk selector with bulk actions, pagination) over a PF6 table with
   row-level state, hover cards and guarded row verbs (#2, #33, #38, #41).
3. **Tabbed hub** — one screen, many concerns: `&tab=`-deep-linkable
   tab strip, each tab a card grid of tables (#11 parity surfaces,
   #19/#28/#29/#34 agentic surfaces, manifest-driven Administration
   per #33 item 11).
4. **Detail-with-drawer** — work queue first, row opens a right-side
   drawer with the decision surfaces (triage modal, related incidents,
   artifacts) (#33, #6, #26).
5. **Execution tracker** — timeline + per-wave tab groups covering
   membership, gate status and verification evidence (#46, #47).

The **wizard** is its own full-screen archetype: stepped flow with
blocking per-step validation (#44) and repository-scoping fidelity (#39).

### 20.3 Shared screen elements (parts inventory)

| Element | Behavior | Suggestions |
|---|---|---|
| KPI / stat tile | single number + trend + drill-down link; scales to scoped max | #4, #32, #30 |
| Toolbar | text search, saved filter views (shareable), bulk selector, primary action, pagination | #2, #33, #38 |
| PF6 table | sortable headers with stacked glyph, row density toggle, hover cards, status/risk badges (never color alone) | #32, #36 items 6/7 |
| Row detail drawer | slides from the right; ESC-dismissable; deep-linkable (`&drawer=`) | #33, #26 |
| Modal | decision surfaces (triage state machine, delete confirmation) with focus trap + restore | #33, #16 |
| Empty state | guided first-action instead of a blank table | #43 |
| Annotation badge | purple `#N` chip + tip naming the suggestion(s) the depicted pattern implements; hidden by default | annotation layer |
| Cross-surface consistency | any CRUD re-renders dependent aggregates in the same tick (wave rollups, effort sums, coverage donuts) | #46, #4, #41 |

### 20.4 Screen inventory & suggestion map

| Screen | Archetype | Suggestions depicted (from the mock's badge layer) |
|---|---|---|
| Home | persona landing | 2, 3, 4, 13, 14, 15, 20, 30, 32, 36, 38, 41, 42, 46, 47 |
| Applications (Inventory) | table workspace + cohorts | 2, 4, 12, 23, 32, 33, 36, 38, 46, 47 |
| Incidents | detail-with-drawer | 1, 2, 3, 4, 6, 8, 9, 15, 16, 20, 22, 24, 26, 28, 29, 32, 33, 36, 37, 38, 41, 42, 43, 45, 46, 47, 48, 49, 50 |
| Migration waves | execution tracker | 15, 16, 20, 23, 33, 37, 43, 46, 47 |
| Reports | tabbed hub | 4, 6, 8, 9, 12, 14, 16, 19, 20, 22, 23, 24, 26, 28, 32, 33, 38, 42, 45, 47, 49 |
| Agentic | tabbed hub | 16, 20, 28, 33, 38, 49 |
| Credentials | table workspace | 15, 33, 41, 42, 43 |
| Task manager (admin) | table workspace | 3, 30, 33, 36, 38, 43 |
| Administration (admin) | tabbed hub | 3, 15, 16, 19, 20, 26, 27, 30, 31, 33, 34, 36, 37, 38, 40, 41, 42, 45, 48 |
| Import wizard | wizard | 2, 33, 39, 44 |

### 20.5 Wireframes

Greyscale structure derived from §20.1–§20.3. Conventions: `═` masthead,
`│` sidebar (collapsed on narrow screens), `┌─┐` cards/regions, `…`
repeated rows, `[ ]` controls, `(N)` suggestion references. The shell
frame below wraps every page wireframe; it is shown once and omitted
afterwards. Every wireframe line is exactly 78 characters and all
content inside the boxes is ASCII (`->` arrows, `^`/`v` carets, `!` for
warnings, `o!` for risk) so the borders align in any monospace renderer;
box-drawing characters (`┌─┐│└┘├┤┬┴`) are used for the frames only.
[implementation/implementation.md §21](../implementation/implementation.md#21-wireframe-to-patternfly-element-mapping-companion-to-designmd-205)
maps every convention and screen region below to its PatternFly 6 element.

**Shell (persistent chrome, wraps all screens):**

```
┌─ MASTHEAD - persistent chrome, dark in both schemes ───────────────────────┐
│ [MTA] brand tile + product title                                           │
│ [Architect|Project mgr|Program mgr|Migrator|Admin|Padmin] (36,41)          │
│ [org: northwind-financial / Retail Banking / Claims] (41)                  │
│ [annotations on/off] [Suggestions] [Tasks (3)] [bell] (30,38,42,41,46)     │
│ [scheme] (52)  [EN v] (51)  [Help v] (43,44)                               │
└────────────────────────────────────────────────────────────────────────────┘
┌────────────────────────┬───────────────────────────────────────────────────┐
│┌──────────────────────┐│                                                   │
││ NAV (53)             ││CONTENT REGION                                     │
││                      ││(page title + subtitle,                            │
││ Home                 ││ then the screen body)                             │
││ Applications         ││                                                   │
││ Incidents            ││deep-linkable state:                               │
││ Migration waves      ││#scr=&persona=&org=&dept=                          │
││ Reports              ││&team=&tab=&drawer=                                │
││ Agentic              ││&scheme=&lang=&anno= (2)                           │
││ Credentials          ││                                                   │
││ Administration*      ││overlay layer: right drawer,                       │
││ Task manager*        ││modal (triage), notif                              │
││                      ││drawer, OpenAPI modal                              │
││ * admin personas     ││(33,48)                                            │
└────────────────────────┴───────────────────────────────────────────────────┘
```

**1 · Home — persona landing (36):**

```
┌─ Home - persona landing (36) ──────────────────────────────────────────────┐
│ One landing per persona - it answers that role's first question            │
│                                                                            │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │ Effort      │ │ Combined    │ │ Analysis    │ │ Waves on    │            │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘            │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │ rollup (4)  │ │ risk (32)   │ │ coverage    │ │ track (46)  │            │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘            │
│ ┌──────────────────────────────┐ ┌────────────────────────────────────┐    │
│ │ Where the portfolio hurts    │ │ Trends (14,13)                     │    │
│ │ table: worst-first apps (32) │ │ sparkline + burn-down chart        │    │
│ └──────────────────────────────┘ └────────────────────────────────────┘    │
│(other personas: Program mgr = Wave status + Cross-team                     │
│ coordination (46); Migrator = My work queue; Admin = Organization          │
│ status; Padmin = Organizations tenant portfolio + Platform health +        │
│ Cross-tenant audit trail (41,42,30))                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

**2 · Applications (Inventory) — table workspace + cohorts:**

```
┌─ Applications (Inventory) - table workspace + cohorts ─────────────────────┐
│ Row-level state, density, hover cards, and cohort navigation               │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ [Applications] [Archetypes (23,45)]                <- tabs, &tab=      │ │
│ ├────────────────────────────────────────────────────────────────────────┤ │
│ │ [search] [filter v: saved views (2)] [bulk v: tag (33,38)] [+ Add]     │ │
│ ├────────────────────────────────────────────────────────────────────────┤ │
│ │ NAME ^ | BUSINESS SVC | TEAM (41) | RISK (32) | ANALYSIS | EFFORT      │ │
│ │ ...     | ...          | ...       | o! label   | current   | 34       │ │
│ │ ...     | ...          | ...       | o! label   | stale     | 55       │ │
│ │ hover card: owner, tags, archetype, last analysis (36 items 6/7, 23)   │ │
│ ├────────────────────────────────────────────────────────────────────────┤ │
│ │ < 1 2 ... >   20 / page                                    5 items     │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│ row verbs guarded by persona; SARIF/CycloneDX export from row (12)         │
└────────────────────────────────────────────────────────────────────────────┘
```

**3 · Incidents — detail-with-drawer (the migrator's daily surface):**

```
┌─ Incidents - detail-with-drawer (the migrator's daily surface) ────────────┐
│ Assigned work with decisions, provenance, and cross-app context            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ [Queue] [Insights (24,9)] [App detail: 8 tabs]      <- tabs, &tab=     │ │
│ ├────────────────────────────────────────────────────────────────────────┤ │
│ │ [search] [state v (33)] [ruleset v] [saved view (2)] [batch v]         │ │
│ ├────────────────────────────────────────────────────────────────────────┤ │
│ │ INCIDENT KEY ^ | APP | RULE | FILE:LINE  | STATE  | EFFORT             │ │
│ │ eap7-05000...   | ... | ...  | ...         | TRIAGE | 8    -> drawer   │ │
│ │ ...             | ... | ...  | ...         | ok RES.| 5                │ │
│ ├────────────────────────────────────────────────────────────────────────┤ │
│ │ < 1 2 ... >                                                            │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                  ┌─ drawer (&drawer=) ──────────────┐                      │
│                  │ incident detail (8,7)            │                      │
│                  │ TRIAGE (33,6):                   │                      │
│                  │ [state v] [comment] [Save]       │                      │
│                  │ Related incidents | diff (1,26)  │                      │
│                  └──────────────────────────────────┘                      │
│ Insights tab: issue breakdown, teams in scope, shared blockers (24,45)     │
└────────────────────────────────────────────────────────────────────────────┘
```

**4 · Migration waves — execution tracker (46,47):**

```
┌─ Migration waves - execution tracker (46,47) ──────────────────────────────┐
│ From static list + dates to progress, gates, timeline, and evidence        │
│ ┌─ Wave execution - timeline, membership & plan adherence (46) ──────────┐ │
│ │ W2 ----*######---------| today                                         │ │
│ │ W3 ----------*######---------                                          │ │
│ │ table: wave | window | members | progress | gate | effort rollup (4)   │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│ ┌─ Wave 3 (per-wave tab group; repeats per wave) ────────────────────────┐ │
│ │ [Applications] [Gate (46)] [Verification (47)] [Tickets (37)] &tab=    │ │
│ │ Gate status: admission checks x pass/fail + 'gate failing because...'  │ │
│ │ Verification evidence: per-app test runs, evidence links (47)          │ │
│ │ Tickets: synced issue-tracker rows, live Jira state (37)               │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│ aggregates re-derive on membership CRUD (46)                               │
└────────────────────────────────────────────────────────────────────────────┘
```

**5 · Reports — tabbed hub (11):**

```
┌─ Reports - tabbed hub (11) ────────────────────────────────────────────────┐
│ Combined risk, provenance, dependencies, and agent-run evidence            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ [Combined (32)] [Provenance (45)] [Deps (23)] [Agents (49,16)]         │ │
│ ├────────────────────────────────────────────────────────────────────────┤ │
│ │ [Rules (9,8)] [Answers] [Trends (14)]              <- tabs, &tab=      │ │
│ │ per tab: card grid -                                                   │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────┐ ┌──────────────────────────────────┐   │
│  │ Identified risks by            │ │ Risk provenance (45):            │   │
│  │ section (32): table            │ │ rule/answer -> risk chain        │   │
│  └────────────────────────────────┘ └──────────────────────────────────┘   │
│  ┌────────────────────────────────┐ ┌──────────────────────────────────┐   │
│  │ Analysis diff (1):             │ │ Trends (14):                     │   │
│  │ added/resolved/changed         │ │ burn-down per app                │   │
│  │ + effort delta                 │ └──────────────────────────────────┘   │
│ export: SARIF / CycloneDX / machine-readable (12,18)                       │
└────────────────────────────────────────────────────────────────────────────┘
```

**6 · Agentic — tabbed hub (16,19,20,28,29,34):**

```
┌─ Agentic - tabbed hub (16,19,20,28,29,34) ─────────────────────────────────┐
│ The migration factory's management surfaces                                │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ [Workflow runs] [Agent runs] [Workflows (49)] [Agents] [Skills]        │ │
│ ├────────────────────────────────────────────────────────────────────────┤ │
│ │ [Gateways (20)]                                    <- tabs, &tab=      │ │
│ ├────────────────────────────────────────────────────────────────────────┤ │
│ │ run tabs: table with lifecycle state + verbs (cancel/pause/resume)     │ │
│ │ RUN ^ | WORKFLOW | AGENT | GATEWAY/MODEL (20) | TOKENS | STATE         │ │
│ │ attribution + timestamped event log on every run (50,29)               │ │
│ │ registry tabs: Agents (A2A cards) / Skills / Gateways tables with      │ │
│ │ CRUD; workflows compose from registered agents (49,34)                 │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

**7 · Credentials — table workspace (15):**

```
┌─ Credentials - table workspace (15) ───────────────────────────────────────┐
│ Team-owned repository & registry credentials - managed, audited            │
│ ┌─ Repository credentials ───────────────────────────────────────────────┐ │
│ │ [search] [kind v] [+ Add credential]                                   │ │
│ ├────────────────────────────────────────────────────────────────────────┤ │
│ │ NAME ^ | KIND  | TEAM OWNER (41) | LAST USED (42) | EXPIRY  | ...      │ │
│ │ ...     | user/ | Claims           | 2h ago         | 30d !   |        │ │
│ │ secret write-only: never rendered back (15)                            │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

**8 · Task manager (admin) — table workspace (30,38):**

```
┌─ Task manager (admin) - table workspace (30,38) ───────────────────────────┐
│ Platform-health workspace - aggregate first, decisions not dumps           │
│ ┌─ Task queue ───────────────────────────────────────────────────────────┐ │
│ │ [state v] [kind v] [x select] [Cancel selected] (RBAC-guarded, 36)     │ │
│ ├────────────────────────────────────────────────────────────────────────┤ │
│ │ ID ^ | KIND  | APP | STATE  | AGE | QUOTA (38)   | ERROR (3)           │ │
│ │ ...   | anal. | ... | FAILED | 41m | analysis-min | ANALYZER_TIMEOUT   │ │
│ │ structured diagnostics: code + message + retry hint (3)                │ │
│ ├────────────────────────────────────────────────────────────────────────┤ │
│ │ queue health strip: counts by state | aging | failures by code (30)    │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

**9 · Administration (admin) — tabbed hub (33 item 11):**

```
┌─ Administration (admin) - tabbed hub (33 item 11) ─────────────────────────┐
│ One Administration hub instead of scattered one-switch settings            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ [Controls] [Access] [Registries] [Analysis] [Tracker] [Rules]          │ │
│ ├────────────────────────────────────────────────────────────────────────┤ │
│ │ [Automation] [Platform]                           <- tabs, &tab=       │ │
│ │ Controls tab - the controls CRUD grid (2-col card grid):               │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│  ┌─ Business services ┐ ┌─ Stakeholders ─┐ ┌─ Stakeholder groups ───────┐  │
│  │ table + CRUD (41)  │ │ users<->people │ │ real membership (45)       │  │
│  │                    │ │ (36)           │ │                            │  │
│  └────────────────────┘ └────────────────┘ └────────────────────────────┘  │
│  ┌─ Job functions ────┐ ┌─ Tags ─────────┐ ┌─ Teams ────────────────────┐  │
│  │ people taxonomy    │ │ categories     │ │ exactly-one-team (41)      │  │
│  └────────────────────┘ └────────────────┘ └────────────────────────────┘  │
│ Access: users<->stakeholders binding | tokens | RBAC scopes                │
│ Automation: gateways (20) | agent registry (34) | Hub API (48)             │
│ Platform: manifest-driven settings (33 item 11) | deployment (31)          │
└────────────────────────────────────────────────────────────────────────────┘
```

**10 · Import wizard — wizard (44,39):**

```
┌─ Import applications - wizard (44,39) ─────────────────────────────────────┐
│ Per-step validation kills the silent failure modes at the source           │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ 1. Source > 2. Credentials > 3. Repository > 4. Business service       │ │
│ ├────────────────────────────────────────────────────────────────────────┤ │
│ │ > 5. Review                                                            │ │
│ │ step body: form + live validation; blocking validation kills the       │ │
│ │ silent failure modes at the source (44); repo fidelity/scoping (39)    │ │
│ │ discovered apps listed as reviewable rows (23)                         │ │
│ ├────────────────────────────────────────────────────────────────────────┤ │
│ │                                     [Cancel]  [< Back]  [Next >]       │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```
