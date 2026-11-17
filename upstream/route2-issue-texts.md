# Route 2 — Issue texts (Wave-0 friction items, plain repo issues)

Ready-to-file issue texts for the Wave-0 items that deliberately skip the
Konveyor enhancement process — bug reports, small UX gaps, and docs work.
File each as a normal issue in the repo noted; no KEP needed. Every body is
self-contained GitHub Markdown in a fenced block.

**Do not file** — already tracked upstream:

- MTA-7957 / MTA-7958 / MTA-7959 (failed agent-run UX bugs — New). Action is
  to **link** them to konveyor/agentic-controller#341 (see
  `route1-issue-comments.md`, comment 4), not to file new issues.
- MTA-6140 (missing build file) — referenced by issue 3 below as a known-error
  case, already tracked.

**Not filed on the konveyor org:** issue 9 (`mta-ops`) is Red Hat
downstream-only — file in the internal tracker; text included for
completeness.

**Where to file:** each issue's **Where** line gives the exact target —
`https://github.com/konveyor/<repo>/issues/new` for the konveyor-org repos
(all verified to exist 2026-11). **Repo conventions (verified against the
live repos and templates 2026-11):**

- `tackle2-hub` and `tackle2-ui` have **only a bug template** (`.github/
  ISSUE_TEMPLATE/bug.yaml`): title prefix `[BUG]`, required fields —
  existing-issue search checkbox, **Konveyor version** (answer: 8.3.3),
  **Priority** dropdown, **How Reproducible** dropdown — and the labels
  (`kind/bug`, `needs-triage`) are **applied by the template**; filers
  cannot set labels.
- There is **no feature template** in either repo: feature issues are plain
  issues (see tackle2-ui#3694's "Use case: …" format), and maintainers add
  `kind/feature` / `needs-triage` / `needs-priority` afterwards. Don't ask
  for labels in the title; optionally use the `:sparkles:` prefix the Hub
  repo uses for features (e.g. tackle2-hub#335).
- The other repos (`static-report`, `tackle2-addon`) have no templates —
  plain issues.
- Before filing, complete the template's existing-issue search yourself —
  the statuses below were verified 2026-11 but issues move.

---

## 1. konveyor/tackle2-hub — Task list API filters

**Where to file:** https://github.com/konveyor/tackle2-hub/issues/new

**Suggested title:** `GET /tasks` supports ID lookup only — add `state`, `kind`, `application`, `createdBefore` filters
**Kind:** feature (no template — plain issue)
**Labels:** `kind/feature` if maintainers apply; suggest in first comment
**Suggestion:** #3 · **Design:** design doc §3.2 (item 3)

```markdown
**Observed on MTA 8.3.3:** `GET /tasks` can filter by ID only. With hundreds
of tasks in mixed states (in our audit: 460 of 494 discovery tasks stuck
across Created/Ready/Postponed), there is no API way to answer "all Failed
tasks for application X created before date Y" — clients must list
everything and filter client-side.

**Proposed filters** (all map to existing task fields):

- `state` (Created, Ready, Running, Postponed, Succeeded, Failed, QuotaBlocked)
- `kind`
- `application`
- `createdBefore` / `createdAfter`

**Why now:** the UI's task toolbar (state/kind selects with counts) and every
automation consumer of the Hub API need this; it is a prerequisite for
structured task-failure diagnostics on the UI side.

**Acceptance:** filtered queries return consistent result sets with the
unfiltered list; unknown filter values return 400 rather than empty
results.
```

---

## 2. konveyor/tackle2-hub — 401 instead of 302 for unauthenticated requests

**Where to file:** https://github.com/konveyor/tackle2-hub/issues/new

**Suggested title:** `[BUG]` Unauthenticated `/hub/*` API requests return 302 → SPA instead of `401` + `WWW-Authenticate: Bearer`
**Labels:** template-applied (`kind/bug`, `needs-triage`) · **Priority:** Major · **How reproducible:** Always
**Filing note:** this is a **bug** — file via the `bug.yaml` template (the only template in the repo); the fields above map to its required inputs
**Suggestion:** #5 · **Design:** design doc §3.4

```markdown
**Observed on MTA 8.3.3:** unauthenticated requests to `/hub/*` API
endpoints are redirected (302) to the SPA rather than answered with
`401 Unauthorized` and a `WWW-Authenticate: Bearer` challenge. Browsers
tolerate this; machine clients cannot — a plain `curl` gets HTML, and API
consumers must hard-code redirect suppression to even discover that auth is
the problem.

**Proposed behavior:**

- API routes (`/hub/*`): `401` + `WWW-Authenticate: Bearer` — standard,
  machine-discoverable.
- SPA routes: keep the redirect to the login flow.

**Impact:** this small fix unblocks every machine-client feature built on
the Hub API — PAT-based automation, MCP tool access, export tooling — all of
which currently start by fighting the redirect.

**Acceptance:** `curl -i /hub/tasks` without credentials returns
`401` with a `WWW-Authenticate: Bearer` header; browser login flow
unchanged.
```

---

## 3. konveyor/tackle2-ui — Task failure diagnostics

**Where to file:** https://github.com/konveyor/tackle2-ui/issues/new

**Suggested title:** Task views: render `errors[]`/`events[]` as alerts + timeline, add Reason column, deep-link to pod logs
**Kind:** feature (no template — plain issue)
**Labels:** suggest `kind/feature` in first comment
**Suggestion:** #3 · **Design:** design doc §3.2

```markdown
**Observed on MTA 8.3.3:** the task resource already carries everything
needed for failure diagnostics — `errors[]` (severity/description),
`events[]` (kind/count/reason/last), and `pod` — but the UI surfaces almost
none of it: diagnosing a failed task means reading raw YAML, the task list
has no reason column, and known failure modes (e.g. MTA-6140's missing build
file) render as opaque errors.

**Proposed** (data exists; this is presentation + one filter dependency):

1. Task detail: `errors[]` as PatternFly danger alerts; `events[]` as a
   timeline; raw YAML/JSON behind "Technical details" (keep it — good admin
   transparency).
2. Task list: **Reason column** (first error description) for Failed tasks.
3. Toolbar: state/kind selects with counts — depends on the Hub task filters
   (separate tackle2-hub issue, same program).
4. Pod-log deep link into the OpenShift console (task CR carries `pod`).
5. Curated hint map for known error cases (MTA-6140: "no build file found —
   check the application's build configuration") — a static map, not new
   infrastructure.
6. QuotaBlocked tasks: derive the violated quota from task events and link
   to the configuration.

**Acceptance:** a PVC-permission failure renders its message as an alert
without opening YAML; state/kind filters work; known errors render a hint.
```

---

## 4. konveyor/tackle2-ui — Agents, Skills, and Workflows detail views

**Where to file:** https://github.com/konveyor/tackle2-ui/issues/new

**Suggested title:** Agents/Skills/Workflows lists have no detail views — names not clickable, no drill-down anywhere
**Kind:** feature (no template — plain issue)
**Labels:** suggest `kind/feature` in first comment
**Suggestion:** #16 (observed findings) · **Design:** design doc §5 (Wave 4 notes)

```markdown
**Observed on MTA 8.3.3** (15 agents, 24 skills, 8 workflows):

- **Agents view**: agent names are not links. An agent's purpose,
  parameters, image digest, gateway/model binding, run history, success
  rate, and guardrail configuration cannot be inspected anywhere. The list
  shows mutable tags (`:latest`) with no digest pinning, and the Gateways
  column is "-" for every agent (`gateways: null` in all 15 specs).
- **Skills view**: skill names are styled as links but are not clickable —
  no SKILL.md content, version, license, parameters, or usage examples.
  All 24 skills show an "Unverified" badge with no verification workflow or
  explanation, and there is no reverse linkage showing which agents/runs
  use a skill.
- **Workflows view**: workflow names not links; the table compensates by
  dumping each workflow's entire guide into a cell as unrendered plain text
  (raw markdown asterisks visible); stages are a text string
  ("3: plan → author → verify") with no linkage to the executing agents —
  even though the `AgentWorkflowRun` CR carries `agentRef` and per-stage
  instructions.
- **Positive exception to copy**: the Run dialog (documented parameters,
  inline help) and the Workflow-runs detail view (stage timeline with
  per-stage "Open run" links).

**Proposed:** detail views/drawers for all three list views, backed by data
the CRs already carry: agent spec + run history + success rate; skill
source (the agentic-controller already supports skills from OCI, git, or
inline — the UI only surfaces image-sourced), version, usage; workflow
stages rendered from `instructions` with agent links. On the Agents list:
show digests instead of mutable tags, and surface the CR's reasoned
conditions (the Gateways view's Ready badge hides an "Endpoint … reachable
(HTTP 200)" condition that is more informative).

**Acceptance:** every name in the three lists opens a detail view; skills
show source and usage; workflow stages link to agents.
```

---

## 5. konveyor/tackle2-hub + static-report — UI vs. static report parity contract test

**Where to file:** https://github.com/konveyor/static-report/issues/new (primary) — cross-link from https://github.com/konveyor/tackle2-hub/issues/new

**Suggested title:** CI contract test: Hub API report data vs. static-report `output.js` must agree per issue
**Kind:** feature (no template in either repo)
**Labels:** suggest `kind/feature` in first comment
**Suggestion:** #11 · **Design:** design doc §3.5 · File in `static-report` (cross-link from `tackle2-hub`)

```markdown
**Upstream fact:** the static report is produced via
`analyzer YAML → analyzer-output-parser → public/output.js`, while the Hub
UI reads the Hub API — two renderers over two data paths with nothing
enforcing agreement. Any drift shows up as "the report says X, the Hub says
Y" in front of auditors, discovered by hand.

**Proposed:** a three-way contract test in CI:

1. Fixture analyzer output → (a) Hub API JSON, (b) `output.js` extraction.
2. Compare per issue: name, target, effort, incident count; plus
   dependencies.
3. Drift fails the release; intentional divergences are labeled in the
   report (e.g. "Hub-only filters") instead of being silent.

**Acceptance:** contract test runs in `static-report` (and/or
`tackle2-hub`) CI; a deliberately introduced divergence fails the build;
divergence labeling shipped.
```

---

## 6. konveyor/tackle2-addon (docs) — Import-time custom tasks documentation + worked SCA example

**Where to file:** https://github.com/konveyor/tackle2-addon/issues/new

**Suggested title:** Document how custom tasks run on application import (task CR contract) — worked example: SCA/dependency-analysis addon
**Kind:** docs issue (plain issue)
**Labels:** suggest `documentation` in first comment
**Suggestion:** #21 · **Design:** design doc §3.6

```markdown
Custom tasks on application import are a powerful extension point that is
effectively undocumented: which CR fields an addon receives, what the
contract is, and how results flow back are discoverable only by reading
source.

**Proposed docs page:**

1. The verified task CR contract: `data`, `errors`, `events`, `reported`,
   `bucket` — with a minimal runnable addon example per field.
2. A **worked example**: an import-time SCA (software-composition-analysis)
   addon that reads the application's dependency manifest and writes
   findings — this doubles as the reference pattern for a community/RHDA-
   style vulnerability integration.
3. Structured addon errors: recommend addons emit `code`, `severity`,
   `description`, `hint` (aligning with the task-diagnostics work in the
   Hub/UI) so failures are actionable.

**Acceptance:** a developer can write an import-time addon from the docs
alone; the SCA example runs against a stock instance.
```

---

## 7. konveyor/tackle2-hub — PAT UX and SPA security headers

**Where to file:** https://github.com/konveyor/tackle2-hub/issues/new

**Suggested title:** PAT creation lacks scope selection/expiry defaults; SPA responses carry no security headers
**Kind:** feature (no template — plain issue)
**Labels:** suggest `kind/feature` in first comment
**Suggestion:** #5 (remaining items after the 401 fix) · **Design:** design doc §3.4

```markdown
Two independent hardening gaps observed on MTA 8.3.3:

**1. PAT UX.** The Hub API already implements 366 `resource:verb` scopes,
but PAT creation doesn't expose scope selection or expiry defaults, and
there's no in-product way to test a token. Proposed: scope multi-select at
creation, sensible expiry default, curl test snippet rendered with the
fresh token.

**2. SPA security headers.** SPA HTTP responses carry no
`Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security`,
`X-Content-Type-Options`, or `Referrer-Policy` — while the co-located
Keycloak login page sets CSP and `X-Frame-Options`. Proposed: ship a CSP
baseline for the SPA (Keycloak's existing CSP is a starting template).

Related (separate decision, possibly operator-side): the instance serves
both the built-in OIDC provider (`/oidc`) and a legacy Keycloak realm
(`/auth/realms/mta`) — a transitional dual-provider state; the target SSO
state should be made explicit (note: `tackle-keycloak-theme` is archived,
so realm theming needs a revive-or-configure decision).

**Acceptance:** scoped PAT creatable and testable in-product; SPA
responses carry the security-header baseline.
```

---

## 8. konveyor/tackle2-hub (docs) — Effort estimation methodology

**Where to file:** https://github.com/konveyor/tackle2-hub/issues/new

**Suggested title:** Document the effort-estimation methodology (story points: source, scale, assumptions)
**Kind:** docs issue (plain issue)
**Labels:** suggest `documentation` in first comment
**Suggestion:** #13 · **Design:** design doc §3.6

```markdown
Story points appear throughout the product (per incident, per application,
portfolio totals) and drive real planning decisions, but their derivation —
what the number means, how mandatory/optional/potential incidents are
weighted, what the scale assumes about team familiarity — is undocumented.
Every consumer of effort data (spreadsheets, rollups, the wave-planning
discussions upstream) inherits the ambiguity.

**Proposed:** a docs page defining:

1. Where story points originate (rule metadata? defaults?) and whether
   they are user-overridable.
2. The mandatory/optional/potential distinction and its intended use.
3. Explicit assumptions and limits (e.g. what a "story point" presumes
   about the team) — so portfolio-level aggregation (upstream work on
   effort rollups / wave planning) can state its own error bars.

**Acceptance:** the methodology page exists, is linked from the UI's effort
tooltips, and every rule-bundle author can find how to set points.
```

---

## 9. Red Hat internal (downstream-only) — mta-ops pipeline ergonomics & safety

**Where to file:** Red Hat internal tracker (not public) — do **not** file on
github.com/konveyor; design doc [§3.3](../design/design.md#33-15--mta-ops-pipeline-ergonomics--safety-red-hat-downstream)
records mta-ops as downstream-only ("no konveyor org surface")

**Suggested title:** mta-ops: `--check` preflight, explicit `--overwrite`, replace-guards on `kubectl apply`
**Suggestion:** #15 · **Design:** design doc §3.3
**Note:** downstream-only (no konveyor org surface) — file in the internal
tracker; text below.

```markdown
**Problem:** re-running mta-ops pipeline steps against an existing namespace
overwrites or duplicates state without warning (overwrite conflicts
documented as MTA-7103, stage collisions as MTA-7234). Cutover-day safety
depends on runbook discipline instead of tooling.

**Proposed:**

1. `--check` preflight: prints a full create/replace/skip plan (namespace
   state, overwrite conflicts, stage collisions) and exits non-zero on
   conflicts.
2. Explicit `--overwrite` required for any replacing apply; replace-guards
   on all `kubectl apply` steps.
3. Runbook section: cutover procedure with the new flags.

**Acceptance:** re-run without `--overwrite` stops safely; `--check`
output matches what a subsequent real run would do.
```

---

## 10. konveyor/tackle2-hub — Task-queue resilience (reaping, quota accounting, retry)

**Suggested title:** Task scheduler wedges permanently: dead pods count against the pod quota and failed tasks cannot be re-queued
**Kind:** feature (plain issue) — the acute wedge symptom is bug-shaped and could equally be filed via the bug template
**Suggestion:** #38 · **Design:** design doc §6 (filing plan note) · **Wave:** 0

```markdown
**Observed live** (MTA 8.3.3, portfolio-scale run): three compounding
task-scheduler defects can wedge the queue permanently.

1. **The pod-quota accounting counts dead pods.** The scheduler enforces a
   task-pod limit counted over *existing* pods — including pods in `Error`
   or `Completed` state. The Hub reaps pods of *succeeded* tasks but never
   removes pods of *failed* tasks, so every failed task permanently
   consumes one quota slot.
2. **The wedge is silent and total.** With the quota exhausted, the
   scheduler logs `[task-scheduler] Task pods created. capacity=1
   created=0 quota=10/10 requested=100+ scheduled=0` and no task —
   including explicitly triggered analyses — is ever scheduled again;
   tasks pile up in `Ready`/`Postponed`/`QuotaBlocked`. The queued task
   records show `error: null` (the pods died before reporting), so the UI
   gives no hint of the cause.
3. **A failed task cannot be retried.** `PUT /tasks/:id/submit` returns
   204 but leaves the state untouched; the only recovery is creating a
   fresh task with the same `kind`/`application`/`data` — requiring
   API-level reconstruction of the task shape. An empty-body submit (or
   the UI's taskgroup submit without the object) fails silently or with
   `400 EOF`.

**Deployed workaround:** an hourly CronJob deleting task pods in terminal
states so the quota can never stay exhausted; manual task reconstruction
via the REST API for retries.

**Proposed:**

1. Reap task pods in terminal states (or exclude them from quota
   accounting) — the scheduler should never wedge on its own garbage.
2. Make the quota state visible: a task-queue metric (`quota`,
   `scheduled`, `requested` — natural fit for the Prometheus metrics
   surface) and a UI signal when the queue is quota-blocked, identifying
   the blocking pods.
3. Retry semantics: allow re-queuing a failed task (or a documented
   clone/retry endpoint); make submit endpoints validate the body and
   return meaningful errors instead of silent 204s / `400 EOF`.
4. Record the scheduler-level failure on tasks that cannot be scheduled
   (quota exhausted) instead of leaving `error: null`.

**Acceptance:** a failed task pod never reduces schedulable capacity;
failed tasks are retriable from UI and API; a quota-blocked queue is
visible in metrics and UI.
```

---

## 11. konveyor/tackle2-ui — In-console help system (help menu, contextual help, guided empty states)

**Suggested title:** Add an in-console help system: help menu, per-view docs links, and contextual help
**Kind:** feature (plain issue — `tackle2-ui` has no feature template)
**Suggestion:** #43 · **Design:** design doc §6 (filing plan note) · **Wave:** 0

```markdown
## Use case: the console should answer "what is this / what do I do next" in place

**Problem.** The MTA console has no help surface — its entire in-product
help is a single external documentation link, which has broken before
(#945, a 404 that lived in the UI until someone noticed). Everything else
a user needs to understand lives outside the product, and the console's
own affordances often raise questions they don't answer:

- Empty states quote raw API conditions ("No jira configuration
  available") instead of explaining what a tracker is or how to add one.
- The Skills view badges all 24 skills "Unverified" with no explanation
  of what verification means or how to verify.
- The Gateways view declares itself read-only ("managed cluster-side")
  without saying how or where management happens — no CRD name, no YAML
  sample, no docs link.
- The Workflows table compensates for missing detail views by dumping
  each workflow's multi-paragraph guide into a table cell as unrendered
  markdown.
- Tier chips ("premium"), columns ("Preemption" — reworded once in
  #2053), and concepts (archetype vs. application, business service) are
  shown unexplained.
- "Create agent" offers no guided onboarding (no Agent Card import, no
  skills-based scaffolding) — the user must already know the CR model.

**Proposed.**

1. **A masthead help menu** (the OpenShift console pattern): links to
   product documentation, support/feedback, release notes, and an About
   panel (version, build).
2. **Per-view documentation deep-links:** each sidebar view links its
   matching docs section — data-driven from a single source (a labels or
   config map), so a URL change can never silently 404 again (#945's
   lesson), ideally contract-tested.
3. **Contextual help** on the concepts that need it: explanatory
   popovers/tooltips for badges ("Unverified"), tier chips, and columns;
   help links in empty states alongside the next action (create tracker /
   configure identity), not raw API conditions.
4. **Read-only views point to the managing resource:** Gateways (and any
   future cluster-managed resource) link the CRD reference and a YAML
   sample.
5. **Guided onboarding for create flows:** "Create agent" with
   Agent Card/skills import and field-level help; the Workflow "Run"
   dialog's inline parameter help (already the console's best example)
   as the pattern to generalize.

**Acceptance:** every sidebar view has a working, tested docs link;
no empty state quotes a raw API condition without a next action; the
"Unverified" badge and tier chips are explained in place; the help menu
surfaces docs/support/about; a broken docs URL fails CI rather than
shipping.
```

---

## 12. konveyor/tackle2-ui — Wizard-driven onboarding for the high-friction flows

**Suggested title:** Add wizard-driven onboarding for import, tracker connection, and agentic run launch (with per-step validation)
**Kind:** feature (plain issue — `tackle2-ui` has no feature template)
**Suggestion:** #44 · **Design:** design doc §6 (filing plan note) · **Wave:** 0

```markdown
## Use case: onboarding flows should validate each step instead of failing silently later

**Problem.** The console's major flows are form-or-API-first and discover
their errors late — often silently. All of these are observed on 8.3.3:

- **Application import** accepts SSH repository URLs that the agentic
  harness later fails at the clone step (SSH basic-auth-only); branch and
  path metadata are never validated; re-imports create duplicate
  dependency edges and resolve application names by `LIKE` match.
- **Tracker connection** works only with an identity kind spelled exactly
  `basic-auth` (others fail with "unsupported identity kind"), requires a
  `name` field the form doesn't surface, and — against live Jira Cloud —
  reads `connected` while status sync silently stalls on a removed v2
  endpoint.
- **Archetype assessment** silently leaves a group unassessed when the
  completed questionnaire isn't marked `required: true` (risk derives
  only from required questionnaires).
- **Agentic run launch** requires an undocumented env contract
  (`APP_ID`/`TARGET_BRANCH`), takes `params` as unvalidated free text,
  and runs against stale workflow CRs without warning — silently dropping
  new parameters.

The console already proves the pattern works: the Workflow Run dialog
(documented parameters, inline gateway semantics, application scoping) is
exactly this shape — it should be the component base, not the exception.

**Proposed.** A small **wizard framework** (step model, per-step
validation hooks calling the existing API, resume/skip, exit into the
normal detail view) plus the highest-leverage flows first:

1. **Application import** — URL → identity → branch/path → business
   service → tags → review; each step validates before the next (URL
   scheme check, credential test, branch exists, path resolves).
2. **Tracker connection** — host → credential → test → project/issue-type
   mapping → a status round-trip that proves sync works (not just
   connectivity).
3. **Agentic run launch** — application → workflow → branch/path
   pre-filled from the record → gateway → params validated against the
   live workflow CR → optional dry-run → monitor.

Further flows once the framework lands: platform-readiness checklist,
LLM gateway setup, archetype & assessment (with live risk preview),
first analysis (suggested from discovered technologies), and wave
planning (dependency-ordered candidates with inline date validation).

**Acceptance:** importing an SSH-URL application warns at import time
(or the import wizard validates the scheme); connecting a tracker ends
with a verified status round-trip; run-launch params are validated
against the live workflow CR, and a stale-CR run is refused with the
reason; each wizard resumes after interruption and exits into the
resource's normal detail view.
```

---

## 13. konveyor/tackle2-ui — Clickable repository links (application source + run results)

**Suggested title:** Make application repository URLs and run commit references clickable deep links
**Kind:** feature (plain issue — `tackle2-ui` has no feature template)
**Suggestion:** #26 (item 9 — lightweight source handoff tier; severable from the Wave-4 IDE work) · **Wave:** 0

```markdown
## Use case: open an application's source in one click

**Problem.** The application record holds the repository URL and branch,
but the UI renders both as plain text — copying them into a browser is a
manual step for every application, every time. The same gap extends to
agent-run results: the UI says "any commits the agent made are on the
target branch … the branch may not exist" with nothing clickable (the
same bug class as MTA-7957/7958/7959, where run status points at a
branch the user must find by hand).

**Proposed.**

1. **Application detail and list:** render the repository URL as a link
   — repo root as the fallback, and a `/tree/<branch>` deep link when
   the branch is known. Branch resolution is landing in
   tackle2-hub#1177 (`git ls-remote` at add time), which makes the
   branch deep link reliable rather than a guess.
2. **Agent and workflow runs:** once run outcome artifacts record commit
   SHAs (the persistence RFE in agentic-controller#341), render them as
   forge links. Until then, show the target branch name with a
   copy-to-clipboard affordance instead of prose.
3. **No forge assumption:** link generation must handle GitLab,
   Bitbucket, and Gitea URLs — the commit feed's github.com-only
   limitation should not propagate to source links.

**Acceptance:** every application with a repository URL has a working
link (repo + branch when resolvable); an agent run that pushed results
links to the commit/branch; a run whose push failed explains why without
pretending a branch exists; link generation is forge-agnostic.
```

---

## 14. konveyor/tackle2-ui (+ tackle2-hub) — General Configuration view: self-documenting, validated, audited

**Suggested title:** General Configuration: describe and validate settings, record changes, and document their effect
**Kind:** feature (plain issue — the view/UX half lands in `tackle2-ui`, the validation/audit/export half in `tackle2-hub`)
**Suggestion:** folds into #33 (item 11) and #42 (settings as the concrete admin-resource audit case) · **Wave:** 0

```markdown
## Use case: the General Configuration view should explain, validate, and account for what it changes

**Problem.** The Administration view's General Configuration page (`/general`)
renders **exactly one setting** — `download.html.enabled` ("Allow reports
to be downloaded"), hardcoded in the component as a single switch. It has
no description of what enabling it exposes (the full static HTML report —
source-code-derived findings, dependency data, versions), who gets access,
or the data-exposal implication; flipping it mutates immediately with no
confirmation and no record of who changed what, when. The Hub's `/settings`
is an open key-value bag, but the view can't grow with it — new settings
require hand-written widgets, and none of the keys (this one included) are
documented in place: which settings exist is discoverable only by reading
Hub source. Further consequences observed on 8.3.3:

- Settings are **unvalidated at save time** — a wrong type or value
  persists fine and fails silently (or not at all) at behavior time.
- **Changes are unaudited** — these are administrative mutations (e.g.,
  enabling the report-download option, a data-exposal-relevant toggle),
  but nothing records who changed which setting, when, or from what.
- **No effect semantics** — the view doesn't say whether a change is
  hot-applied or requires task restart / re-analysis to take effect.
- **No export/import** — runtime settings can't be versioned or promoted
  between environments (unlike deployment configuration, which the
  Tackle CR covers).

Not an isolated case: the Administration view's Git and SVN pages
(`client/src/app/pages/repositories/Git.tsx`, `Svn.tsx`) are each also
a single hardcoded switch — `git.insecure.enabled` ("Consume insecure
Git repositories") and `svn.insecure.enabled` — and these are
**security-relevant** settings: they disable transport verification for
source ingestion, an MITM surface over the source code and the findings
derived from it. Same gaps, no mitigation: no description of what
"insecure" exposes, no confirmation on enable, no audit record, no
per-host scoping (it is all repositories or none). The
one-hand-written-widget-per-view pattern is systemic, which is exactly
what a settings manifest ends.

Maven is the third instance — and the instructive one. Its switch
(`mvn.insecure.enabled`, `client/src/app/pages/repositories/Mvn.tsx`) is
the only one of the three with a real tooltip ("allows repositories
using the 'http' protocol… the default is to require https") — the fix
pattern already exists in the codebase and was simply not propagated to
its siblings. Its history is the case for effect semantics:
analyzer-lsp#1190 (closed) found the option passed
`-Dmaven.wagon.http.ssl.insecure`, which Maven 3.9's native transport
ignores — a security-relevant switch that could be flipped, look
authoritative, and change nothing, with nothing on the view to reveal
it. The page also carries a dead setting: `mvn.dependencies.update.forced`
is served by the Hub but the UI never exposed it (a
`// TODO: Implement mvn forced setting` comment whose disabled code even
mutates the wrong key) — exactly the Hub↔UI drift a manifest, as the
single source of truth for which settings exist, prevents.

**Proposed.**

1. **Self-documenting settings:** render each setting with a
   human-readable name, description, type, default, and valid values,
   sourced from a machine-readable settings manifest in the Hub (key,
   description, type, default, since-version) — so the UI can't drift
   from the API.
2. **Save-time validation:** validate values against the manifest
   (type/range/enum) and reject with a meaningful error.
3. **Change audit:** settings mutations produce audit records (actor,
   auth method, timestamp, before/after) — the same facility proposed
   for the Hub's API-key question in enhancements#266.
4. **Effect semantics:** each setting declares whether it is hot-applied
   or requires task restart / re-analysis; the view shows this and
   warns when a change needs action.
5. **Export/import:** settings as a versionable JSON document (export,
   import with validation) for environment promotion and GitOps.
6. **A parity contract test:** keys rendered in the view ↔ keys served
   by `/settings` ↔ keys documented — a CI check in the same spirit as
   the UI-vs-static-report parity test.

**Acceptance:** every setting visible in the UI shows description,
default, and valid values; saving an invalid value fails with a
meaningful error; a settings change appears in the audit log with actor
and before/after; settings hot-restart semantics are displayed; settings
can be exported and re-imported into another instance.
```

---

## 15. konveyor/tackle2-ui (+ tackle2-hub) — Credentials view: usage visibility, effective-credential display, and a test action

**Suggested title:** Credentials: show what uses a credential, which credential applies to an application, and whether it works
**Kind:** feature (plain issue — list/UX half in `tackle2-ui`, reverse-relation and verify endpoints in `tackle2-hub`)
**Suggestion:** the view-level half of the Credentials workup; the API half is folded into #33 (item 9 — identity reverse relations), the scoping half into #41, the kind-form argument into issue 14 · **Wave:** 0

```markdown
## Use case: a credential page should show what uses a credential and whether it works

**Problem.** The Credentials view (the UI over the Hub's identities) is a
list plus four per-kind create/edit forms — and it answers none of the
questions that matter once credentials exist (all verified on 8.3.3 and
in the `tackle2-ui` source):

1. **No usage visibility.** The view cannot show which applications,
   trackers, or proxies use a credential. Deleting one that is in use
   silently breaks analyses and agent runs downstream — no warning, no
   reference list. The belongs-to-only relation shape makes "used by N
   applications" unrenderable today.
2. **Effective-credential resolution is invisible.** The client has a
   `useEffectiveSourceCredential` hook that decides which credential
   actually applies to an application (the per-kind default, with
   fallback) — but the resolution renders nowhere, on the application or
   here. Upstream tackle2-ui#3616 (open) is precisely about warning users
   when this resolution *fails* ("agent run that cannot push —
   application has no source credential"); the failure is discoverable
   only at run time.
3. **No credential test/health action.** A credential can look healthy
   and fail only in behavior: proxy identity credentials are never
   decrypted in the mirror path, so an authenticated proxy can never
   work (tackle2-hub#1181/#1166, open), and SSH-key source identities
   silently cannot clone via the agent harness (agentic-controller#240,
   open). There is no "verify against target" affordance that would
   surface either class immediately.
4. **No expiry/rotation concept.** The view treats every credential as
   immortal: no expiry metadata, no rotation tracking, no last-used or
   last-verified signal — while editor-extensions#1334 (open) shows LLM
   proxy tokens expiring in ~5 minutes with no refresh path.

**Proposed.**

1. **Usage column / drill-down:** render the consumers of each credential
   (applications, trackers, proxies) — the Hub needs a reverse relation
   (`GET /identities/{id}/consumers`), after which the list gains a
   "used by" count and the delete action gains a confirmation naming the
   affected resources.
2. **Effective-credential display:** on the application (and in the
   agent-run dialog), show which credential will actually be used and
   why (explicit assignment vs. per-kind default) — surfacing the
   resolution the client already computes, and turning #3616's
   run-time warning into a pre-run indicator.
3. **A "verify" action:** per credential, a test against its target
   (clone probe for source, tracker handshake, proxy check) with a
   pass/fail result and last-verified timestamp.
4. **Expiry/rotation fields (follow-up):** optional expiry metadata and
   a stale/soon-expired marker on the list.

The same pattern argument as the General Configuration view (see our
issue 14) applies to the four hardcoded per-kind forms: a kind registry
would let new credential kinds render without hand-written widgets.

**Acceptance:** deleting a credential in use is blocked or confirmed
with the affected resources named; an application page shows the
credential that will be used and its provenance; a failing credential
is diagnosable from the Credentials view without launching an analysis
or agent run.
```

---

## 16. konveyor/tackle2-ui (+ tackle2-hub) — Proxy configuration: show what it applies to, support exclusions, and verify reachability

**Suggested title:** Proxy configuration: scope display, exclusion list, and a reachability test
**Kind:** feature (plain issue — form/UX half in `tackle2-ui`, consumption routing and exclusion semantics in `tackle2-hub`)
**Suggestion:** the Proxy view workup — a real form (HTTP/HTTPS, host, port, identity-required toggle, `kind === "proxy"` identity select), not a one-switch page · **Wave:** 0

```markdown
## Use case: the proxy form should say what it controls, what it skips, and whether it works

**Problem.** The Administration view's Proxy page is a functioning form
(HTTP and HTTPS: enabled, host, port, identity-required toggle, identity
select) with client-side validation — but it answers none of the
questions that determine whether an enterprise deployment's egress
works:

1. **Scope of effect is invisible — and incomplete.** Nothing on the
   view says what the proxy applies to (task-pod clones? tracker sync?
   the LLM proxy?), so users configure it and assume it is universal.
   It isn't: tackle2-hub#420 (open) — a Jira Server/DataCenter instance
   reachable only through a proxy cannot be accessed, because tracker
   traffic does not route through the configured proxy. The first
   documented enterprise trial of this limitation is an open bug.
2. **No exclusion (NO_PROXY) support.** The form offers
   enabled/host/port/identity — no exclusion list. Every enterprise
   environment needs one (internal registries, artifact repositories,
   IdP endpoints); upstream friction exists even extension-side
   (editor-extensions#1415 — NO_PROXY not honored in proxy detection;
   #1502 — NO_PROXY resolved with different casing than the proxy URL).
3. **No verify action.** Failures surface only when analyses or tracker
   syncs fail en masse. This is the same configure-and-pray gap as the
   Credentials view (see our issue 15, whose verify action already names
   a proxy check) — and it is sharper here because the credential
   pipeline it depends on is itself broken: proxy identity credentials
   are never decrypted (tackle2-hub#1181/#1166, open), so an
   authenticated proxy silently cannot work.
4. **Validation checks syntax, not reachability.** The form's yup schema
   validates host/port shape; nothing confirms host:port answers before
   every downstream task discovers the misconfiguration at once.

**Proposed.**

1. **Scope display:** on the Proxy page, state (per consumer — task
   clones, tracker sync, LLM traffic) whether the proxy applies, and
   make tracker traffic honor the configuration (fixing #420) or the
   view say plainly that it does not.
2. **Exclusion list:** a NO_PROXY-style field per proxy kind (comma-
   separated hosts/CIDRs), passed through to task pods and tracker
   clients, with consistent casing semantics (#1502's class).
3. **A "test" action:** per proxy kind, a reachability probe (and, when
   an identity is set, an authenticated probe) with pass/fail and a
   timestamp — the same affordance proposed for credentials in issue 15.
4. **Consumer visibility:** once the Hub's reverse relations exist
   (#420's tracker case aside), show which consumers reference each
   proxy, so deleting or disabling one names what breaks.

**Acceptance:** the view states which traffic types the proxy governs;
tracker traffic either honors the proxy or the UI says so; an exclusion
list can be configured and reaches task pods and trackers; a
misconfigured or unreachable proxy is diagnosable from the Proxy page
without launching an analysis.
```

---

## 17. konveyor/tackle2-ui (+ tackle2-hub) — Tracker configuration: sync-outcome visibility, trustworthy connection status, and usage-safe management

**Suggested title:** Jira/Tracker configuration: show sync outcomes, make connection status trustworthy, and warn before breaking consumers
**Kind:** feature (plain issue — view/UX half in `tackle2-ui`, sync-state fields on the tracker resource in `tackle2-hub`)
**Suggestion:** the Jira view workup — the console's best-built configuration surface (connection-status column, per-kind credential filtering, HTTPS validation, create-oriented empty state), which makes its gaps more instructive · **Wave:** 0

```markdown
## Use case: a tracker's page should show whether tickets are actually moving

**Problem.** The Jira/Tracker configuration view renders connection
status with error detail in a popover — one of the console's better
surfaces — but it answers none of the questions that determine whether
the integration is *working*:

1. **Connection status is a client-side approximation.** The view fakes
   an "updating" spinner with an 8-second setTimeout expiry
   (`useUpdatingTrackerIds`); there is no last-checked timestamp, no
   staleness signal, and no real-time state — upstream tackle2-ui#1092
   (closed) shows the failure class: an error flashes briefly, then the
   row reads "connected". The most important datum — *when was this
   connection last verified?* — does not exist.
2. **Sync outcome is invisible.** The tracker's entire job is moving
   tickets, yet the view shows connection only: not last successful
   sync, tickets created/failed, or per-wave export outcomes. Upstream
   felt this — tackle2-ui#3111 (closed, "Jira ticket is not always
   reflected in the UI for exported applications") and #3224 (closed,
   "Inconsistent verification of issues created in Jira"). The protocol
   layer has an owner (REST v2 removal is tracked separately); the
   sync-outcome surface has none.
3. **No test-connection-on-save.** The form validates URL shape only;
   problems surface via post-create polling — or as raw Jira error
   strings (tackle2-ui#3116, closed, "not userfriendly error message
   when can't connect").
4. **"Enable insecure communication" is an undocumented security
   toggle** — the same class as the repository pages' insecure switches,
   but per-tracker: no description of the exposure, no confirmation, no
   audit record.
5. **No usage visibility.** Which applications/waves export to this
   tracker is unrenderable (belongs-to-only relations), so disabling or
   deleting one breaks exports silently — the same class as
   tackle2-ui#1028 (closed, non-descriptive warning when deleting a
   credential in use by a tracker).

**Proposed.**

1. **Sync-outcome column:** last successful sync, tickets created/
   updated/failed counts (recent window), and per-wave export status —
   hub-side fields on the tracker resource, rendered on the list and in
   a per-tracker detail. This is also the data wave-execution views
   need to render ticket states.
2. **Trustworthy status:** server-side connection check with a
   last-verified timestamp (stale after a configurable interval),
   replacing the client-side timer; test-connection-on-save before the
   tracker is created or updated.
3. **Guarded lifecycle:** disabling/deleting a tracker that consumers
   reference is blocked or confirmed with the affected resources named
   (riding the identity reverse relation proposed in our issue 15).
4. **Documented insecure toggle:** describe what "insecure
   communication" disables, confirm on enable, and include tracker
   mutations in the audit record (the facility proposed in
   konveyor/enhancements#266).

**Acceptance:** a tracker's page shows when its connection was last
verified and the outcome of its recent syncs without opening any
external system; a failing sync is distinguishable from a failing
connection; deleting a tracker that waves reference is blocked or
confirmed with those waves named; enabling insecure communication
requires confirmation and is audited.
```

---

## Filing checklist

- [ ] Post the thirteen Route 1 comments (`route1-issue-comments.md`)
- [ ] File issues 1–9 above in their repos; issues 10 (task-queue
      resilience), 11 (in-console help system), 12 (onboarding wizards),
      13 (clickable repository links), 14 (General Configuration
      view), 15 (Credentials usage/health), 16 (Proxy scope/
      exclusions/verify), and 17 (Tracker sync-outcome/status) alongside
      them — the wedge is field-verified and blocks every analysis until
      fixed; 11–17 cover the console's missing help, guidance,
      source-handoff, settings, credential, proxy, and tracker surfaces;
      issue 9 in the internal tracker
- [ ] Cross-link: issue 3 ↔ issue 1 (filters dependency); issue 5 ↔ Hub CI;
      issue 10 ↔ issue 3 (diagnostics) and the metrics work; issue 11 ↔
      issue 4 (detail views share the empty-state and onboarding gaps);
      issue 12 ↔ issue 4 (wizard exits into the detail views) and
      issue 11 (wizards reuse the docs links and empty states); issue 12
      ↔ upstream tackle2-ui#3704 + tackle2-hub#1177 (comment 10 carries
      the same validation evidence into those threads); issue 13 ↔
      tackle2-hub#1177 (branch resolution), MTA-7957/58/59 (the
      results-on-branch bug class), and issue 4 (detail-view pattern);
      issue 14 ↔ issue 5 (same parity-contract-test pattern) and the
      enhancements#266 thread (comment 9 — settings as the concrete
      audit-record case); issue 15 ↔ issue 14 (same hardcoded-widget
      pattern argument), #33 item 9 (the identity reverse relation),
      tackle2-ui#3616 (the effective-credential warning this makes
      pre-run), tackle2-hub#1181/#1166 and agentic-controller#240
      (the silent-failure classes the verify action surfaces); issue 16 ↔
      issue 15 (same verify-action pattern; its proxy check), #420
      (tracker traffic bypasses the proxy — the scope bug), #1181/#1166
      (proxy credentials never decrypted — the failure the test would
      surface), and #33 item 9 (consumer visibility); issue 17 ↔
      Suggestion 37 (the protocol-compatibility half of tracker sync)
      and Suggestion 46 (wave execution renders ticket states),
      tackle2-ui#3111/#3224 (the sync-outcome gap, upstream-observed),
      issues 15/16 (the same verify-action and guarded-delete patterns),
      and enhancements#266 (the audit record the insecure toggle needs);
      comment 12 ↔ issue 17 (the trustworthy-status pattern it carries)
      and the Source platforms discover wizard ↔ comment 10 (the
      validation gate) and issue 12 (the wizard pattern); comment 13 ↔
      #2567/#2565/#2544 (the same-view cluster), #34 (generators as the
      plugin-shaped surface), and #33 item 9 (generator↔profile usage
      visibility); tackle2-ui#2543 (Task Manager Platform column ↔ the
      Source platforms workup, comment 12 — the task dimension of
      platform-aware discovery); tackle2-hub#1082 (open lifespan bug ↔
      comment 9's management-UX clause) and tackle2-ui#3418 (link to
      MTA-7152 — twin "nav after token deletion" bug, referenced in #36)
- [ ] Link MTA-7957/58/59 to agentic-controller#341 (do **not** file new)
- [ ] Also file as a one-line bug (tackle2-ui): the Git view's "Consume
      insecure Git repositories" switch carries a copy-paste
      `aria-label="HTTP Proxy"` (`client/src/app/pages/repositories/Git.tsx`)
      — screen readers announce the wrong control; found during the Git
      view workup
- [ ] Record filed URLs in design doc §6.4 and flip the README status row
- [ ] Re-check each issue's repo for a prior duplicate before posting
      (statuses verified 2026-11, but issues move)
