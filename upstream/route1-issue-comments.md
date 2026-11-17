# Route 1 — Issue comments (build on existing upstream issues)

Ready-to-post comments for the thirteen upstream issues that already have a
home. **Post these; do not file duplicates.** Each comment is self-contained
GitHub Markdown in a fenced block — copy, review, adjust the voice, post.
Every comment states where the author's fuller design lives (the drafted
proposals in this workspace and the design doc), so upstream readers can
follow the thread.

**Where to post** below each heading gives the exact validated issue URL
(all verified against the live upstream 2026-11) — open it and add the
comment; all are issues in the `konveyor` GitHub org, so a GitHub account
with normal access is sufficient.

**Repo conventions respected by these drafts** (verified against the live
issues and repo templates):

- `konveyor/enhancements`: the process is *comment → agree → PR with the
  KEP markdown* (issue #259 shows the end state: summary + implementation
  PRs). These comments therefore discuss first and offer the drafted KEP.
- `agentic-controller` issues carry prior art in-thread (#341 has a working
  prototype; #256 proposes its own mechanism) — the comments below
  acknowledge and extend rather than re-propose.
- `tackle2-ui#3694` is a *use-case discovery* issue ("worth covering before
  anyone builds anything?") — its comment answers that question and builds
  on the server-side pieces the issue itself lists.

---

## 1. konveyor/enhancements#279 — Kai Solution Server REST frontend

**Where to post:** https://github.com/konveyor/proposals/issues/279 — comment on the existing issue

```markdown
Hi @fabianvf — we've been working on closely adjacent problems and would like
to contribute a design that **complements** this enhancement rather than
duplicating it.

Your proposal's curation model is about **rule candidates**: producers
contribute candidate rules, and accept/reject workflows triage them toward
promotion into the Hub's rule management. That's the *content* pipeline.

We drafted **"Triage Store and Run Comparison"** (full KEP-format draft:
`triage-store-and-run-comparison.md`, happy to attach or link once this
discussion settles the #279 scope) for the *decision* pipeline — and the
distinction matters:

**Triage is portfolio data, not example data.** What's missing upstream is
the migration team's own per-incident record: accept/reject/needs-review
decisions on *analysis incidents*, reviewer identity, and rationale —
currently stored nowhere (at best in spreadsheets). These are different
data with different lifecycles from rule candidates, and conflating them
would distort both. (Your "producer-agnostic, APIs not flow" principle is
the right one — this is a second producer/domain, not a scope extension.)

What the draft adds on top of #279:

1. **Incident identity** — `sha256(rule | normalizedFilePath | line |
   snippetHash)` with exact / fuzzy (≤10-line drift) / re-ask tiers — so a
   triage decision survives re-analysis instead of being orphaned when code
   moves. Without this, neither #279's candidate staging nor any triage UI
   can carry decisions across runs.
2. **A Hub-native triage store** (Postgres, `tackle2-hub`) with a small REST
   surface (`/triage`, filterable by run/application/rule/disposition), RBAC
   mapped to the existing migrator/architect roles.
3. **Run comparison** — given stable incident identity, "what changed between
   run N and N+1" (new/resolved/changed incidents, effort delta) becomes a
   query, not a bespoke diff script.
4. **Explicit non-goal:** re-implementing the solution server's solved-example
   staging (#279's territory) — the triage store *references* accepted
   solutions instead of copying them.

Related Red Hat-side context: MTA-7358 (weight learning by seniority/role) —
triage dispositions with reviewer identity are exactly the input such
learning needs.

Questions for this thread:
- Does #279 see *incident* triage decisions as in scope (via the solution
  server) or explicitly out of scope? If the latter, does a sibling KEP for
  the portfolio-side store seem reasonable to maintainers?
- Schema/review overlaps: the incident-identity scheme needs analyzer-lsp
  review; would a joint review make sense?
```

---

## 2. konveyor/tackle2-hub#335 — Expose Prometheus metrics (closed)

**Where to post:** https://github.com/konveyor/tackle2-hub/issues/335 — comment on the existing (closed) issue; it implements #305

```markdown
Reopening the discussion (issue is closed — happy to move to a new issue or
an enhancement if maintainers prefer): #335 (implementing #305) established
the Prometheus baseline — `:2112/metrics`, `METRICS_PORT`/`METRICS_ENABLED`,
counts of applications, tasks, assessments, and Jira exports. That baseline
works, but an audit of a live MTA 8.3.3 instance shows the gap between
"inventory counters exist" and "an operator can see the migration platform's
health":

- Of 494 discovery tasks, **460 were stuck** (227 Created, 117 Ready,
  116 Postponed, 4 QuotaBlocked). No queue-depth metric, no backlog-age
  alert, no UI view distinguishes "waiting" from "wedged". MTA-4774
  (monitoring targets down, Keycloak) is still the class of failure users
  find before monitoring does.

We drafted a concrete extension proposal (KEP-format draft available; happy
to file as an enhancement if this repo is the wrong home):

1. **State-transition metrics**, not just counters:
   `mta_tasks_queue_depth{state,kind}`, `mta_tasks_duration_seconds`,
   `mta_tasks_failed_total{kind,errorCode}` — labels aligning with a
   structured task-error taxonomy (separate issue drafted: task API
   filters + error presentation).
2. **OTEL spans** for the task lifecycle (created→scheduled→running→
   terminated, pod correlation), extending today's CLI-only
   `--jaeger-endpoint` so one task is traceable across hub → addon →
   provider → report.
3. **Operator-shipped dashboards + alerts**: queue aging (oldest Created >
   N h), failure-rate spike, QuotaBlocked count, `up == 0` on scrape
   targets — reference Grafana dashboards renderable in stock OpenShift
   monitoring (the operator is the natural ship vehicle).
4. **Reserve the `mta_ai_*` metric namespace** now, before the agentic
   features scale (token/cost/model-stamp accounting lands there later —
   see agentic-controller#192 / MTA-8100 / MTA-8049).

Happy to break items out into individual issues if that's easier to triage.
```

---

## 3. konveyor/operator#543 — [RFE] Structured Tackle CR

**Where to post:** https://github.com/konveyor/operator/issues/543 — comment on the existing issue

```markdown
Strong +1, with live-instance evidence and design extensions for the
structured schema you've sketched.

Evidence from an MTA 8.3.3 deployment: tasks stuck in `QuotaBlocked` because
of namespace resource quotas — the UI shows the state string, but neither the
violated quota nor a resolution path; a platform engineer must correlate
OpenShift quota events by hand. Deployment/quota feedback belongs in the
product, and it needs a structured CR to hang it on. Meanwhile hub and UI run
single-replica with no supported path to HA, and the only "workaround" for
placement is hand-editing operator-managed Deployments (reverted on next
reconcile, unsupported).

Your example CR already sketches the per-component grouping; the audit
suggests these additions to the schema work:

1. **Standard placement pass-through** per component: `nodeSelector`,
   `affinity`/`antiAffinity`, `tolerations`, `topologySpreadConstraints` —
   e.g. hub on infra nodes, analyzer pods scaling on compute.
2. **Replicas and availability**: supported multi-replica for stateless
   components (hub, ui, solution server) + PodDisruptionBudgets, so rolling
   maintenance doesn't take MTA down mid-cutover.
3. **Pod-level overrides**: security contexts, env (corporate proxy),
   imagePullSecrets, annotations — the knobs platform teams require by
   policy.
4. **Validation and status conditions**: invalid CR rejected with a
   condition message; overrides survive upgrade; labeled raw-patch escape
   hatch for the long tail.
5. **GitOps goal**: full deployment config expressible in the CR alone —
   MTA fits the standard Argo CD model used for everything else on the
   cluster.

One question the structured-schema work should settle early: migration/
conversion of the existing flat field list (per-component fields already
deployed in the field), so upgrades don't strand existing CRs.
```

---

## 4. konveyor/agentic-controller#341 — Persist and visualize AgentRun transcripts and pod logs

**Where to post:** https://github.com/konveyor/agentic-controller/issues/341 — comment on the existing issue

```markdown
This RFE matches findings from a structured evaluation of the MTA 8.3.3
agentic layer — and it comes with strong prior art: the @dymurray prototype
(forked hub/UI `agentic-observability` branches, deployed on a live cluster)
already proves the capture-and-visualize half. This comment adds
independent evidence plus a bundle-layout proposal that fits the RFE's
stated direction (controller-owned capture, storage interface, TTL — no
tackle2-hub coupling).

Independent evidence from a stock 8.3 instance (no prototype involved):

- The transcript is **ephemeral by design** — "The live transcript is only
  available while the run is active." After completion the audit trail is
  gone; the only pointer is "any commits the agent made are on the target
  branch … the branch may not exist" (and in the two failed runs we
  observed, no commit appeared at all — see MTA-7957/7958/7959).
- No outcome artifacts: no diff, no changed-file list, no commit list.
- Token accounting shows context-window percentage (e.g. 40,979 of 128,000,
  24 turns) but **no total token consumption, cost, or model/gateway stamp**
  per run — the raw data exists in run status; totals and stamps don't.

Bundle-layout proposal for the storage interface (draft KEP + ACR
available): the current "workspaces are ephemeral — git is the persistence
layer" decision is right for **workspaces** and wrong for **run records**.

1. On termination, the controller (or a sidecar) writes a **run-record
   bundle** to the run's existing bucket:
   `/agentruns/{runName}/` → `summary.json` (workflow, stages, params,
   gateway, token totals, verdict), `transcript.jsonl` (ACP messages),
   `events.jsonl` (stage event timeline — tool invocations, model calls
   with token counts, sandbox denials, git checkpoints, retries),
   `artifacts/` (diffs, commit lists, stage-written reports),
   `meta.json` (retention class, redaction flag, schemaVersion).
2. **Per the RFE's decoupling requirement:** the controller only writes the
   bundle; *consumers* are out of its scope. A hub-side indexer for
   `summary.json` (run-view replay, artifact download, token/cost showback)
   would be the first consumer — via the prototype's fork branches or a
   follow-up RFE there, not in this repo.
3. Retention default **90 days, operator-configurable**; deletion is a
   controller task — matching the "controller-owned TTL" in this RFE's
   title.
4. **Event-timeline durability contract** (the observability half of the
   same ask): `events.jsonl` is append-only for the life of the run and
   survives workspace teardown with the rest of the bundle. Sandbox
   denials are first-class events in OCSF form (the format #16's security
   section already specifies), so security review can replay them without
   pod-log access; the token counts per model call make the `summary.json`
   totals reconcilable rather than a single unauditable number — and a
   failed stage becomes diagnosable from the event trail alone, without
   re-running it.

Happy to contribute the bundle schema against the prototype's storage
interface if that's the useful next step.
```

---

## 5. konveyor/enhancements#259 — Analyzer MCP Server

**Where to post:** https://github.com/konveyor/proposals/issues/259 — comment on the existing issue (currently labeled `stale` — a substantive comment also un-stales it)

```markdown
Supporting this enhancement — with one observation about scope, based on the
implementation PRs already linked here.

**What exists:** the linked `konveyor-ecosystem/analyzer-mcp` work covers
*analysis execution* well — 9 tools wrapping kai-analyzer-rpc (run analysis,
cached results, incident queries, provider management) with bearer-token
auth. That's the kai side of the house.

**What's still open** (and where an MTA 8.3.3 evaluation suggests this
enhancement's center of gravity should be): the **Hub/portfolio surface**.
Today MTA's analysis data is reachable only through the Hub UI, HTML
reports, or the bespoke VS Code extension — no MCP client can query
applications, dependencies, insights, effort, or solved examples. Gaps an
MTA-focused toolset would close:

1. **Portfolio tools**: applications, dependencies, insights, effort —
   notably analysis **Insights** (zero-effort findings) are visible in the
   Hub UI/static report/YAML but not in the IDE; an MCP data layer closes
   that asymmetry for any MCP-capable client, not just the Red Hat
   extension.
2. **Solution-server tools**: solved examples + confidence (making
   `kai_mcp_solution_server`'s memory reachable from any client).
3. **Rules tools**: generate/validate custom rule YAML via MCP (community
   pattern is proven), tied to the 8.2 rule validation.

**Packaging/governance** (relevant when this graduates beyond
konveyor-ecosystem):

- Package for the **RHOAI AI Hub MCP Catalog / MCP Lifecycle Operator** so
  admins deploy it as an `MCPServer` CR next to the hub (same pattern as
  `rhoai-mcp`).
- **Identity**: reuse the hub's Keycloak/OIDC for token exchange —
  delegated user identity, existing roles (administrator/architect/
  migrator) govern authorization. The bearer-token auth already in
  analyzer-mcp is compatible; hub-delegated OIDC is the enterprise tier.
- **Governance**: read-only tools broadly available, write tools (trigger
  analysis, accept solutions) restricted per role/tenant — the enterprise
  MCP Gateway (Red Hat Connectivity Link) is a natural screening point.
- **Operational parity** with the OpenShift MCP server: OTEL traces/metrics
  into OpenShift monitoring, read-only-by-default toolsets, audit
  user-agent marking for agent-initiated calls.

Question for maintainers: is the long-term intent a standalone server
binary, or MCP exposure embedded in tackle2-hub itself? The portfolio
toolset above works for either, but RBAC and identity reuse are much
simpler in the hub-embedded case.
```

---

## 6. konveyor/agentic-controller#256 — Spike: MCP servers as a first-class attachment on Agent

**Where to post:** https://github.com/konveyor/agentic-controller/issues/256 — comment on the existing issue

```markdown
Adding evaluation evidence from MTA 8.3.3 that supports this spike's
premise, plus one input on the declaration mechanism.

Evidence the gap is real, from a stock 8.3 instance: 15 agents implemented
as CRs, and the AI surface is already partially wired — `konveyor.io/
v1alpha1 Gateway` CRs exist (provider/model/contextWindow/tier). But the
bindings are invisible: **all 15 agents carry `gateways: null`** in their
specs (the UI renders "-"), so even the *existing* attachment class is
undeclared, and there is no cluster default gateway — every run dialog must
name one manually. Declared attachments would fix that visibility problem
for inference first, and this spike does the same for MCP servers.

On the mechanism, the spike's sketch (a field on `Agent`, transports stdio
+ remote, credentials via existing `credentialRef`/`envFrom`/`fileMounts`
rather than a new one, controller validates and wires) has our full
support — from the evaluation, three inputs:

1. **Credentials-at-the-controller is the security payoff**: MCP servers as
   declarations (not agent-image contents) keep credentials in the
   controller's scope — consistent with the sandbox/network-boundary
   direction (per-binary network policy, boundary-injected credentials,
   never in the sandbox).
2. **Per-run stamping falls out of declarations**: once attachments are
   declared, runs can be stamped (which MCP servers, which gateway, token
   totals) — the raw data exists in run status; declarations give it a
   source of truth. Adjacent evidence: run status today shows context-window
   usage but no totals/stamps (being addressed in #341's persistence work).
3. **Hub-side MCP tools and auth**: when agents attach to hub-side MCP
   servers (inventory/triage tools), auth should ride the hub's existing
   PAT/OIDC model — the hub's 366 `resource:verb` scopes map cleanly onto
   MCP tool authorization, no new scheme needed.

Happy to write up the spike's evaluation questions as a doc if useful.
```

---

## 7. konveyor/tackle2-ui#3694 — Use case: plan migration waves from declared application dependencies

**Where to post:** https://github.com/konveyor/tackle2-ui/issues/3694 — comment on the existing issue

```markdown
Direct answer to the question this use case asks ("worth covering before
anyone builds anything?"): **yes** — and the strongest argument is already
in this issue: `POST /hub/adoptionplans` exists, topologically sorts by
declared dependencies, weights by review-effort estimates, and reports
cycles. The capability is built and then became invisible when the Reports
chart was removed in #3278. A portfolio-level audit makes the case for
going further than restoring a chart:

- Our audit instance: 100+ applications, effectively 1 analyzed — and wave
  composition is still manual. At the scale this use case describes (tens
  of thousands of repos), dependency-ordering is necessary but not
  sufficient: planners also balance risk, effort, team capacity, and
  business priority — by hand, from memory.
- The data for all of it already exists in MTA: inventory dependencies,
  assessment risk/complexity, analysis effort per application.

What turns the existing sort into a planner (design drafted as a KEP +
UI notes; happy to contribute):

1. **Strategies, not a single answer**: risk-first, quick-wins-first,
   dependency-driven — planners compare alternatives instead of receiving
   one black-box composition. (MTA-8044/8045/8261's dependency-based
   archetype criteria are a natural data source here.)
2. **Advisory + human-in-the-loop**: suggestions are proposals; dragging an
   application between waves continuously re-validates (dependency-order
   violations flagged inline — the adoptionplans cycle-reporting becomes
   interactive feedback).
3. **What-if simulation**: moving an application shows impact (violated
   ordering, changed wave effort/risk profile, affected dependents) before
   commit.
4. **Traceable rationale** per placement ("X in wave 3: depends on Y
   (wave 2); 45 SP; critical CVE exposure; archetype EAP 6→8") — this is
   what makes plans defensible to stakeholders.
5. **Risk should mean both dimensions** once available: assessment risk
   *and* analysis incidents/coverage — today an application can be "green"
   by assessment inheritance while carrying 500 mandatory incidents, and no
   view reveals the discrepancy (combined risk view drafted as a sibling
   proposal).

One implementation note from the Hub side: the grouping/effort/risk
aggregation the planner UI needs should be **server-side** (a
`/report/effort?groupBy=…`-style endpoint with the wave planner as first
consumer) — client-side aggregation over tens of thousands of applications
won't stay responsive, and other consumers (portfolio rollups, trend views)
need the same endpoint.
```

---

## 8. konveyor/enhancements#110 — [RFE] Multi-tenancy: Expand RBAC controls

**Where to post:** https://github.com/konveyor/proposals/issues/110 — comment on the existing RFE (open since 2023-03, `stale`-labeled; the comment both revives it and broadens it beyond app-visibility RBAC)

```markdown
Reviving this RFE — it's been open since 2023-03 and remains untriaged, but
the use case has only grown: large modernization programs run MTA as a
**central instance** shared across teams, and the governance features
(portfolio rollup, combined risk reporting, wave planning) are precisely
the value of it being shared. Without visibility isolation, that sharing
isn't safe: every authenticated user sees every application — including
other teams' task records, wave plans, and **tracker credentials
(identities) stored in the Hub**.

We'd like to (a) add field context that strengthens the original ask, and
(b) propose that the scope be framed as **multi-tenancy**, not just
application-visibility RBAC:

1. **Application-visibility ACLs** (this issue's original core): owner /
   stakeholder / contributor / reader per application, enforced in the Hub
   API — every list endpoint, the task queue, and the static report — not
   just filtered in the UI.
2. **Team scoping mapped onto existing structures.** Teams don't need a
   new tenancy primitive: membership rules over business services /
   archetypes (the grouping the Hub already has) and Keycloak groups (the
   identity source in 8.x deployments) cover the model.
3. **Team-scoped secrets.** Identities (tracker credentials, git tokens)
   should be readable only within the team boundary — today any user with
   API access can retrieve another team's Jira credentials.
4. **Scoped execution and reporting.** Wave plans, assessment workflows,
   and per-team usage attribution (team-labeled Prometheus metrics) within
   the membership boundary; administrators keep the cross-team view.
5. **An admin model** — team admins manage their own membership; a
   documented shared-instance posture replaces the implicit
   "one namespace per team" story.

On the workaround in the thread (install into multiple namespaces, since
tackle2-operator#203): it works for hard separation, but it costs N
instances to operate, duplicated configuration, and — decisive for the
central-instance use case — **no shared portfolio reporting**, which is
the reason organizations run one instance in the first place.

We've drafted a full design (suggestion write-up with the data-model and
enforcement surface: membership over existing entities, ACL enforcement
points across API/tasks/reporting, admin delegation) and are happy to
contribute it as a KEP per the standard process if maintainers agree this
should move forward — per @shawn-hurley's 2023 note, this is table stakes
for any managed or internal-platform offering.
```

---

## 9. konveyor/enhancements#266 — Long-lived API key mechanism for Konveyor Hub

**Where to post:** https://github.com/konveyor/proposals/issues/266 — comment on the existing issue (its body explicitly asks *"How should API key usage be audited/logged?"* — the comment answers that question and proposes the general facility it belongs in)

```markdown
This issue's open question — *"How should API key usage be
audited/logged?"* — points at a gap that is bigger than API keys, and we'd
like to propose the facility that answers it: **an append-only audit log
in the Hub**, of which API-key events are the first beneficiary rather
than the scope.

Context for why this has become urgent:

- **Service accounts landed** (tackle2-hub#1105): mutations now come from
  humans *and* non-human actors, and nothing distinguishes them after the
  fact. The Hub keeps current state only — there is no record of who
  changed what application, identity, tracker, wave plan, or admin
  resource, when, or from where.
- **Identities hold live credentials** (tracker passwords, git tokens).
  Any user with API access can read them today — with no record that the
  access happened. For shared/central instances this is the sharpest edge:
  credential access should itself be an audited event.
- **Governed enterprises cannot adopt** a platform whose administrative
  history is unprovable; the agentic governance work (sandbox boundaries,
  runtime policies) presumes an audit record beneath it that doesn't yet
  exist.
- **The surrounding machinery already exists.** The console's User
  management surface ships a Tokens tab with issue, expiration/lifespan
  display, and revocation (verified in the console source, 2026-11).
  Extending that toward API keys — longer-lived kinds bound to service
  accounts, with audit integration per point 3 below — is incremental
  extension of existing machinery, not a new build.

**Proposed shape (briefly):**

1. Append-only audit log covering state-changing operations (mutations on
   applications, identities, trackers, wave plans, profiles, admin
   resources) plus sensitive reads (identity/credential fetches) and
   task/agent-run triggers.
2. Every record carries actor (user or service account), auth method
   (OIDC / PAT / API key), source address, timestamp, action, resource,
   and a before/after reference — not full payloads.
3. API keys integrate naturally: key creation, use, and revocation are
   audit events, and the key's identity is the actor on every request it
   authenticates — directly answering this issue's open question.
4. Retention config plus export (syslog/CEF or OTel) so enterprises can
   ship records to their SIEM; query API with the same authorization as
   the underlying resource.
5. Distinct from the webhooks/events work: webhooks are opt-in
   integration signals; the audit log is a server-side record of record —
   completeness over convenience.

On the management-UX half of the same mechanism: the console's token
page has the right skeleton (issue, revoke, scope display) but three
gaps that matter at API-key scale — the lifespan field's server default
is ~10 years with no guidance or cap (the "unrealistic duration" display
problem is already recorded in editor-extensions#1451; the hub-side
lifespan data not reaching the page is tracked in tackle2-hub#1082),
there is no last-used signal (hygiene revocation is impossible without
it — and last-used is one of the audit events point 3 above already
proposes), and no expiry warning on the list. Long-lived keys and
long-lived key *management* need to land together.

We have a fuller write-up of the design (enforcement points, storage,
export surface, team-scoped visibility in multi-tenant setups) and are
happy to contribute it as a KEP per the standard process if maintainers
agree it belongs in the roadmap — it composes naturally with the API-key
mechanism proposed here.
```

---

## 10. konveyor/tackle2-ui#3704 — Use case: discover applications from a GitHub organisation

**Where to post:** https://github.com/konveyor/tackle2-ui/issues/3704 — comment on the existing issue (its sibling [tackle2-hub#1177](https://github.com/konveyor/tackle2-hub/issues/1177) carries the per-application validation half; the comment addresses both and keeps the boundary the two issues already draw)

```markdown
Strong use case — and the failure modes it would prevent are not
hypothetical. We hit them in a portfolio-scale field deployment (100+
applications, 2026-11), and they map exactly onto the gap between this
issue (discovery at scale) and its sibling tackle2-hub#1177 (per-
application validation):

1. **The branch typo class is real and expensive.** With the branch as
   free text, a run planned against the recorded sources analyzed the
   repository's *default branch* instead — the results only made sense
   once we discovered the tree mismatch. #1177's `git ls-remote`
   resolution would have caught it at form time for one API call.
2. **URL scheme errors surface one hop later than the form.** An
   `ssh://` repository URL passed import without complaint and broke at
   the agentic harness's clone step (HTTP-basic-auth-only git transport;
   tracked as konveyor/agentic-controller#240). An import-time scheme
   check — or harness-compatibility validation at record time — moves
   the failure from mid-run to the form.
3. **Credential attachment is the multi-stop step this issue describes.**
   Create credential → create application → Manage credentials → attach.
   At org-discovery scale (#3704's core), per-repo credential matching by
   host/path pattern would collapse that to one decision.

Two additions to the use case as written:

- **Discovery should carry validation.** However applications arrive —
  org scan, CSV, or manual — the same post-create validation gate should
  run (URL resolvable, scheme supported, branch exists, credential
  testable). #1177 provides the branch half; the other three are small
  additions to the same check.
- **Feed what's discovered into the analysis suggestion path.** The
  tech-discovery tags the Hub already computes per application are the
  natural input for a "suggested first analysis" (source/target labels
  from discovered technologies) — so onboarding ends with an analysis
  request, not just an inventory row.

We've drafted the import flow as a validating wizard (per-step checks
with resume/skip, exiting into the normal detail view) and would be happy
to contribute the design here or as its own issue — it composes with both
this and #1177 rather than overlapping either.
```

---

## 11. konveyor/tackle2-ui#2749 — Import questionnaire: Report questionnaire validation errors

**Where to post:** https://github.com/konveyor/tackle2-ui/issues/2749 — comment on the existing issue (open; the hub-side validation half landed via PR #931, its backport #933 still open — the comment addresses the reporting half this issue tracks and keeps that boundary)

```markdown
Confirming this from a full-console audit (8.3.3) — and one datapoint
from the history: #3115 recorded the previous behavior ("wrong
notification" on invalid import), so this issue is the second pass on
the same UX. Worth fixing at the contract level so it stays fixed:

1. **Surface the hub's error payload, not the HTTP status.** PR #931's
   validation returns structured errors (YAML location, rule); the UI
   should render *that* — per-error lines with path/line references —
   not a generic "HTTP 400" notification. The old behavior (#3115) came
   precisely from the UI improvising around an unstructured failure.
2. **Keep the import form mounted and annotated.** A failed import
   should return the user to the form with the errors attached to the
   file/control that caused them (the template's shape is known, so
   field-level mapping is feasible for the common failure classes:
   schema-version mismatch, unknown category, threshold gaps).
3. **Validate before upload where the schema allows.** The client
   already ships the questionnaire template; a client-side pre-flight
   (schema + version check) catches the coarse failures offline and
   reserves the hub round-trip for the semantic ones.

Adjacent, for whoever picks this up: the same import surface has two
beyond-this-issue gaps we hit in the audit — an invalid-YAML import and
a *valid-but-unassignable* questionnaire (wrong category structure) are
indistinguishable until assignment time; and an authored questionnaire
cannot be exported back out for promotion to another environment, so
import is a one-way door. Happy to detail those in their own issues if
useful rather than stretching this one.
```

---

## 12. konveyor/tackle2-ui#2566 — Source platforms: display connection status

**Where to post:** https://github.com/konveyor/tackle2-ui/issues/2566 — comment on the existing issue (open, Major, since 2025-08; sibling gap: [enhancements#293](https://github.com/konveyor/proposals/issues/293), offline discovery UI — the comment cross-links it and keeps the boundary)

```markdown
Adding field context for why this matters beyond parity with other
admin surfaces: the Source platforms view's entire value is the
Discover Applications wizard, and discovery runs as Hub tasks — so a
platform with an expired credential or a moved URL looks healthy right
up until a discovery task fails, and nothing on the view says why. The
connection is load-bearing for the feature, not cosmetic.

Three suggestions for the shape of it:

1. **Server-side status with a last-verified timestamp** — the same
   treatment trackers need: a connection check the Hub actually
   performs, a timestamp on the row, and stale-after-interval marking
   (client-side "is connected" booleans flicker: the tracker view's
   error-then-connected flash is the cautionary example,
   tackle2-ui#1092).
2. **Show it in the detail drawer, next to what it gates.** The drawer
   already carries the discovered-applications table — the status
   belongs beside it, with the failing condition named (auth rejected /
   unreachable / TLS), so a failed discovery task and a failed platform
   connection are distinguishable at a glance.
3. **Surface the status at wizard time too.** The Discover Applications
   wizard should refuse to run (or warn) against a platform whose last
   check failed, rather than discovering the failure mid-task.

Sibling gap, same surface: kantra already supports offline Cloud
Foundry discovery (`kantra discover cloud-foundry`), and the UI has no
path to it — tracked as konveyor/enhancements#293. Air-gapped
environments currently can't use platform-awareness onboarding at all;
worth keeping in mind together since both are about the view being
trustworthy beyond the happy path.
```

---

## 13. konveyor/tackle2-ui#2498 — Generators: add support for defining parameters on generators

**Where to post:** https://github.com/konveyor/tackle2-ui/issues/2498 — comment on the existing issue (open, since 2025-07; the UI half was removed in #2595 pending this — the comment addresses the schema-parameters design this issue proposes and keeps that boundary)

```markdown
Supporting the JSON-schema direction here — with field evidence for why
parameters are the generator's *contract*, not a nice-to-have, and two
design notes from auditing the current state (8.3.3):

1. **The current state is a half-removed feature.** #2595 took the
   parameters handling out of the UI pending this issue, and the model
   still carries `params` — the detail drawer's parameters table is
   commented out in the source. Until this lands, generators are
   configured only through free-form `values`, which can't express
   types, required-ness, or defaults — so every consuming workflow
   (target profiles, the generate-assets run) inherits an unvalidated
   contract. Restoring parameters is what turns a generator from a
   script into a usable component.
2. **Schema-defined parameters should feed validation and the run, not
   just the form.** Once `parameters` is a JSON schema document, the
   same document can drive: form generation (the `SchemaDefinedFields`
   technique this issue proposes), save-time validation of `values`
   against the schema (the Maven/general settings views show the cost
   of unvalidated config), and the addon's variable injection
   (tackle2-addon-platform#5) — one contract, three consumers.
3. **Secret-bearing values need an escape hatch.** Some generator
   values are credentials-adjacent (API keys, tokens for the target
   platform). Rendering those as plain text inputs puts secrets into a
   generator record; the form should allow marking a value as
   identity-backed (the same identity attachment the generator's
   repository section already has) rather than storing the secret
   inline.

Cluster note for whoever picks this up: three open issues land on the
same surface — #2567 (tooltips for values/parameters: largely solved by
rendering the schema's descriptions), #2565 (generator order within
target profiles, with hub#885), and #2544 (Provider column). Sequencing
#2498 first gives #2567 its data source for free.
```

---

## After posting

- Log each posted comment URL in the design doc §6.4 filing-status table.
- Link proposal ② from the #279 thread once the sibling-KEP question is
  answered — the answer determines whether ② is filed as a standalone KEP or
  folded into #279's PR series.
- If a maintainer asks for a KEP instead of a comment (hub#335 metrics,
  agentic-controller#341 bundle schema), the drafts exist — file at the
  `provisional` milestone per the standard process.
- Note: agentic-controller#256 is authored by @djzager (active upstream,
  2026-11) — relevant input when settling the reviewer list for proposals.
- Note: enhancements#110 has been open and `stale`-labeled since 2023-03 —
  comment 8 is written to revive it (field context + broadened scope).
  If maintainers prefer a fresh issue instead, Suggestion 41's write-up
  converts directly; link both threads either way.
- Note: enhancements#266 carries the open audit-logging question — comment 9
  answers it with Suggestion 42's design; if maintainers want a standalone
  KEP, the write-up converts directly.
- Note: comment 10 (tackle2-ui#3704 + tackle2-hub#1177) carries the
  field-validated import-failure evidence; the wizard design it offers is
  Route 2 issue 12 / Suggestion 44 — cross-link both threads when posting.
- Note: comment 11 (tackle2-ui#2749, open) carries the questionnaire
  import-error evidence (#3115's wrong-notification history); the
  beyond-this-issue gaps it mentions (assignability validation,
  export/promotion) live in #33 item 11 — cross-link when posting.
- Note: comment 12 (tackle2-ui#2566, open) carries the trustworthy-
  status pattern from Route 2 issue 17 (server-side check, last-verified
  timestamp) into the Source platforms view; cross-link issue 17 and
  enhancements#293 when posting.
- Note: comment 13 (tackle2-ui#2498, open) carries the generators
  parameters evidence (the #2595 removal, the commented-out drawer
  table); its schema-as-contract argument generalizes #33 item 11's
  settings manifest — cross-link when posting.
