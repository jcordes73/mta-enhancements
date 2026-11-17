# Route 3 — Waves 2–5: fileable use-case issues now, deferred register for the rest

The five drafted proposals and the Route 1/2 actions cover Waves 0–1 and the
six build-on clusters — plus, with Suggestions 41–42 (v0.5), two more:
**enhancements#110** (the multi-tenancy RFE, revived by Route 1 comment 8)
and **enhancements#266** (the API-key enhancement whose open audit question
Route 1 comment 9 answers). Comment 10 extends the pairing
**tackle2-ui#3704 + tackle2-hub#1177** (repo-linking/onboarding validation)
with the same field evidence. Twelve suggestions across Waves 2–5 remain — plus
Suggestions 37–39 (added v0.5 from field evidence):
#38 landed as a Route 2 Wave-0 issue text, #37 and #39 are Tier A entries
A8/A9 below. Suggestion 40 (also v0.5: pluggable tracker SPI) joins the
Tier B register below — it rides the #34 KEP and files after it.
Suggestions 43–44 (v0.5: in-console help, onboarding wizards) likewise
landed as Route 2 Wave-0 issue texts 11/12, as did the repo-link ask
(Suggestion 26's lightweight handoff tier) as issue 13, the General
Configuration workup (#33 item 11 + #42) as issue 14, and the
Credentials workup (#33 item 9 + #41) as issue 15; the Git view workup
folded its one-switch evidence (Git/SVN pages, `git.insecure.enabled`)
into issue 14; the Subversion workup added nothing new upstream and
folded its consolidation delta (Git/SVN/Maven → one manifest-driven
"Repository access" entry) into #26's Administration-hub blueprint; the
Maven workup filed nothing new and folded into issue 14 (toggle
inconsistency, #1190's no-op history, the half-wired forced-update
setting) and #30 item 2 (cache effectiveness, kantra#808); the Proxy
workup is Route 2 issue 16 (scope display, exclusions, reachability
test), and the Jira/Tracker workup is Route 2 issue 17 (sync-outcome
visibility, trustworthy connection status, guarded lifecycle), and the
Assessment questionnaires workup is Route 1 comment 11 (#2749) with
fold-ins into #45 item 5 and #33 item 11, the Source platforms
workup is Route 1 comment 12 (#2566, the trustworthy-status pattern),
and the Generators workup is Route 1 comment 13 (#2498, the
parameters keystone); the Task Manager workup was an honesty pass —
no new artifact, partially-delivered findings marked in §3.1/#36/#30,
#2543 cross-linked; the Users workup filed nothing new and folded into
#36 (directory split, ID-desc) and comment 9 (Tokens-tab evidence); the
Tokens workup folded its management-UX asks into comment 9's
management-UX clause (hub#1082, #1451) plus checklist twin-links
(hub#1082, #3418↔MTA-7152); the Roles workup folded into #36 item 2
(scope-picker admin half) and #33 item 9 (role consumers); the Scopes
workup folded its registry finding into #36 item 2's data-source
framing.
Suggestion 45 (v0.5: archetype lifecycle) is Tier A entry A10 below
(Wave 3; downstream anchor MTA-8172). Suggestion 46 (v0.5: wave execution
tracking) is Tier A entry A11 — the execution half of the #3694 planning
thread (comment 7). Suggestion 47 (verification & integration testing)
is Tier A entry A12 — the evidence half of the same loop, riding #16's
sandboxed run machinery and feeding #46's gates.
Suggestions 48–49 (added 2026-11-16 from the Hub-API/agentic work) join the
**Tier B register** below — #48's contract is the substrate #49 composes
into, and #49 rides the #34 KEP. Suggestions 51–53 (console-platform
features catalogued from the UI-mock work) are **Tier A entries A13–A15**
(Wave 5; #52/#53 as plain feature issues — no KEP needed).
This file handles its items in two tiers:

- **Tier A** — evidence-backed asks that can be filed **now** as use-case /
  feature issues (the discovery format upstream itself uses, e.g.
  tackle2-ui#3694). Filing an issue costs upstream nothing and starts the
  conversation; *implementation* still follows the wave sequence (§5.1).
- **Tier B** — architecture-level asks that must stay **design-first**
  (§18.4 flags Waves 2–5 detail depth as the program's deepest gap). Filed
  prematurely, these would be noise; their trigger is ADR closure plus each
  wave's landing.

Conventions (verified 2026-11): `analyzer-lsp` and `kantra` have only a
`bug.yaml` template — these are **feature** asks, filed as plain issues;
`editor-extensions` and `asset-generation` have no templates. Labels are
maintainer-applied; don't set them at filing. Complete the template's
existing-issue search for bugs; for features, search titles first.

---

# Tier A — file now (15 use-case/feature issues)

## A1. konveyor/analyzer-lsp — Resolve dependency graphs from manifests, not builds

**Where to file:** https://github.com/konveyor/analyzer-lsp/issues/new
**Suggestion:** #23 · **Design seed:** design doc §5 (Wave 2) · **Wave:** 2

```markdown
## Use case: dependency-derived results should not depend on the application building

**Problem.** In `source+dependencies` mode, the dependency picture depends on
the application actually building. Consequences observed in the field and in
a live MTA 8.3.3 instance:

- Effort and results differ by buildability (MTA-3225) — unbuildable legacy
  applications, precisely the common migration case, get systematically
  different (and less complete) numbers.
- Internal-repo applications complete with errors (MTA-5156); expected
  issues go missing with custom Maven settings (MTA-4994); some non-Java
  providers fail outright (MTA-4791, Python).
- The Maven search index used for binary classification is "frequently
  unavailable"; the fallback misclassifies internal/external artifacts.
- Live evidence: an analysis without a build recorded **2 dependencies**
  for a full Jakarta EE application (both `indirect`, surfaced only via
  RHDA CVE matching) — presented silently, with no "incomplete" signal.

**Proposed direction.**

1. Parse build manifests (pom.xml, Gradle, package.json, go.mod,
   requirements.txt/pyproject.toml) and resolve the transitive graph
   directly against configured repositories — a successful build only
   *enriches* (classpath proof), never gates.
2. First-class per-project repository configuration (Nexus/Artifactory/npm/
   PyPI/Go proxies), integrated with existing credentials and proxy support.
3. **Deterministic effort parity** as a design principle: identical
   manifests → identical dependency-derived incidents and effort,
   buildable or not (resolving MTA-3225 at the design level).
4. Disconnected operation building on 8.0's pre-generated bundled Maven
   index.
5. Explicit `resolutionIncomplete` markers for unresolvable subtrees
   instead of silent degradation.
6. Byproduct: complete, build-independent SBOMs per application.

**Related upstream work:** MTA-8155 (dependency-resolution parity vs
Maven/Gradle oracles — Dev Complete) establishes the correctness oracle this
would build on; tackle2-hub#1141 and analyzer-lsp#1196/#1192 (closed)
covered the internal-repo CA part of the problem; MTA-8184 (GAV
normalization) consumes the cleaner graph.

**Question:** is manifest-first resolution something this repo's providers
should own (per-provider manifest parsing), and is the parity oracle from
MTA-8155 the right acceptance harness?
```

---

## A2. konveyor/tackle2-hub — Rule result transparency

**Where to file:** https://github.com/konveyor/tackle2-hub/issues/new (cross-link from tackle2-ui for the display side)
**Suggestion:** #8 · **Design seed:** design doc §5 (Wave 2) · **Wave:** 2

```markdown
## Use case: show *why* a rule fired — at configuration time and run time

**Problem.** Incidents show affected files and effort, but not *why* the
rule fired. Users reverse-engineer rule YAML in upstream repos to judge
whether an incident is a hard requirement, a heuristic, or a likely false
positive. The opacity starts before analysis runs — observed on 8.3.3:

- The Analysis Profiles wizard selects targets and free-form source/target
  labels but **no step previews which rules will match** — no "N rules
  will be included", no per-label counts.
- The profile list shows Name | Description only — no targets, mode, rule
  count, or usage; profiles are not links.
- The "Custom migration targets" cards don't reveal what a target
  activates — no ruleset list, no rule count, no label detail — and
  bundled targets offer no "duplicate as custom" fork-and-tune path.
- "Retrieve from a repository" for custom rules has no sync semantics
  (one-time fetch vs live reference, no last-synced stamp or pinning).

**Proposed.**

1. Per incident: rule ID, matched condition in human-readable form, link
   to rule source, producing analysis mode, and the rule's message/links —
   with a stable deep-link so docs and AI-assisted remediation reference
   the same anchor.
2. Configuration-time preview: "N rules will be included" per profile
   (per-label rule counts before running).
3. Target/profile transparency: ruleset list and rule count on target
   cards; "duplicate as custom" for bundled targets.
4. Sync semantics for repository-retrieved rules (refresh, stamp, pin).

**Acceptance:** an incident answers "why did this fire?" without leaving
the UI; a profile can be judged before running it.
```

---

## A3. konveyor/kantra — Published rule coverage matrix per source→target path

**Where to file:** https://github.com/konveyor/kantra/issues/new (cross-link from analyzer-lsp; the data emitter is CLI-side)
**Suggestion:** #9 · **Design seed:** design doc §5 (Wave 2) · **Wave:** 2

```markdown
## Use case: see how well covered a source→target path is *before* migrating

**Problem.** Before starting a migration there is no way to see how well
covered a path is (WebLogic → EAP 8, Spring Boot → Quarkus, CF →
OpenShift). Teams discover coverage gaps mid-migration; today's workaround
is trial analyses on representative applications.

**Proposed.** A published, queryable matrix of bundled rules per source and
target — rule counts, last-update recency, known gaps — in the Hub and/or
documentation. The CLI is the natural emitter: `kantra` (post-8.3
`rules` commands) could produce machine-readable coverage data that powers
both the docs page and a Hub view.

**Acceptance:** a planner can answer "is path X covered well enough to
scope a project, or do we need custom rules?" without running trial
analyses.
```

---

## A4. konveyor/tackle2-ui — Saved, shareable filtered views

**Where to file:** https://github.com/konveyor/tackle2-ui/issues/new
**Suggestion:** #2 · **Design seed:** design doc §5 (Wave 3/5 notes) · **Wave:** 3

```markdown
## Use case: recurring triage queries shouldn't be re-entered by every team member every session

**Problem.** Filters in the Issues and Applications views are ephemeral.
Recurring queries ("all mandatory, effort ≥ 5, target EAP 8") are re-entered
manually by each member per session; the team's triage conventions live in
a wiki instead of the tool.

**Proposed.** Save the current filter set as a named view — scoped to
user, project, or organization — listed in a sidebar and shareable across
the team; optionally link a saved view to an archetype.

**Related:** tackle2-ui#3523 / MTA-7482 (server-side filter chips) are the
filter-infrastructure precedent — saved views are the persistence layer on
top of that work. URL-state for views (shareable links) would be a
low-cost v1.
```

---

## A5. konveyor/editor-extensions — Two-way Hub integration (triage sync, rules round-trip, SSO)

**Where to file:** https://github.com/konveyor/editor-extensions/issues/new
**Suggestion:** #26 · **Design seed:** design doc §5 (Wave 4) · **Wave:** 4

```markdown
## Use case: the IDE is where remediation happens, but it's disconnected from the Hub

**Problem.** The extension's Hub connection is one-directional and
configuration-only: profiles and rules flow down to `.konveyor/profiles`;
results, decisions, and knowledge created in the IDE never flow back.
Triage actions die locally; false positives observed by developers have no
channel; locally run analyses are invisible in the Hub's analysis history.
Related evidence: MTA-7445 (Hub↔IDE divergence) and editor-extensions#1482
(analysis assertion failing silently since July — exactly the trust this
integration needs to fix first).

**Proposed (phased).**

1. **Two-way triage sync** — IDE decisions (resolved / not applicable /
   deferred) sync to the Hub, so portfolio and run-diff views reflect
   reality. Depends on the Hub-side triage store (proposal drafted;
   complements konveyor/enhancements#279).
2. **False-positive reporting from the IDE** — right-click an incident →
   report into the same pipeline as Hub-side reports.
3. **Rules round-trip** — author/adjust a rule in the IDE, validate with
   the 8.2 validation engine, publish to a Hub ruleset (architect
   approval).
4. **Local analyses in Hub history** — optionally publish IDE-run analyses
   as first-class analyses (trend/diff views include them).
5. **SSO** — replace username/password Hub auth with the Hub's
   OIDC/Keycloak identity chain.
6. **Application auto-registration and wave/assignment context** —
   register not-yet-inventoried apps from the IDE; show wave and assigned
   issues in the IDE.

The MCP data-access work (konveyor/enhancements#259) is the natural
transport for several of these — triage sync and result publishing could
ride the same surface rather than bespoke endpoints.
```

---

## A6. konveyor/tackle2-ui — Role-adaptive navigation (persona-based workspaces)

**Where to file:** https://github.com/konveyor/tackle2-ui/issues/new
**Suggestion:** #36 · **Design seed:** design doc §5 (Wave 5) · **Wave:** 5

```markdown
## Use case: 31 top-level views serve four personas equally badly

**Problem.** The 8.3 sidebar maps API resources — 17 Migration + 14
Administration views plus a mode switch — instead of the migration
lifecycle. Every persona (architect, PM, migrator, admin) sees the same
flat list. tackle2-ui#3048 (closed) delivered nav *grouping*; the
persona-adaptive layer it anticipated doesn't exist. Audit evidence of the
cost: fragmented registries (Agents/Skills/Workflows as three views with
no detail level), duplicated surfaces (Issues' "Single application" tab),
and Administration sprawl.

**Proposed direction** (full blueprint drafted, available on request):
reorganize the same functionality into ~8 work views + one Administration
hub — Home (role-adaptive landing), Applications, Findings (issues +
insights + triage states), Plan (waves + tickets), Work ("my work" for
migrators + IDE/Dev Spaces handoff), Automation (unified Runs + Catalog),
Reports (aggregates + exports), Administration (Analysis / Organization /
Platform / Access sections).

**Mechanics that make it tractable:**

- Visibility derived from the existing 366 `resource:verb` scopes — no new
  RBAC model.
- Global search/command palette (jump to any application, issue, run —
  none exists today).
- Mode switch retired in favor of one nav with a collapsed Administration
  section; every view reachable ≤2 clicks from Home.

**Sequencing note:** this reorganization is deliberately last (Wave 5) —
it should consume the aggregates (server-side rollups), the unified
Findings model (issue types, triage states), and an automated a11y/
navigation regression gate so the reshuffle can't regress either
accessibility or deep links.
```

---

## A7. konveyor/asset-generation — Organization-level generator customization

**Where to file:** https://github.com/konveyor/asset-generation/issues/new
**Suggestion:** #17 · **Design seed:** design doc §5 (Wave 5) · **Wave:** 5

```markdown
## Use case: generated stacks should land compliant with platform standards on day one

**Problem.** The 8.3 Helm-based generators (OpenShift Pipelines/Tekton,
OpenShift GitOps/Argo CD, Java Service) produce fixed templates. Enterprise
platform teams standardize on their own CI/CD and GitOps conventions
(registry hosts, RBAC patterns, namespace layout, pipeline steps); a fixed
generated stack means every team hand-adjusts the output — defeating the
"repeatable destination pattern" purpose.

**Proposed.** Organization-level overrides and extensions of generated
assets, versioned and associated with archetypes (consistent with the
existing archetype/target-profile model):

1. Custom values overlays per archetype.
2. Additional pipeline steps injected into generated pipelines.
3. Fully custom generator templates shipped alongside the built-in ones.

**Acceptance:** a platform team can encode its standards once; generated
output for an archetype-compliant application needs no manual adjustment.
```

---

---

## A8. konveyor/tackle2-hub — Ticket status sync broken against live Jira Cloud

**Where to file:** https://github.com/konveyor/tackle2-hub/issues/new
**Suggestion:** #37 · **Design seed:** design doc §6 (filing plan note) · **Wave:** 2

```markdown
## Use case: ticket status sync must survive Jira Cloud's API deprecations

**Problem.** The Hub's embedded Jira client still uses REST API v2
endpoints, and Atlassian has removed `/rest/api/2/search` (developer
changelog CHANGE-2046) — exactly the endpoint the ticket status refresh
calls. Against a live Jira Cloud site, ticket creation, the connection
test (`/rest/api/2/myself`), and project browsing still work — but
**status synchronization silently stops**: the tracker reads `connected`,
tickets get created, and their statuses never refresh. The only working
deployment pattern is an in-cluster nginx rewriter that translates the
removed search path to `/rest/api/3/search/jql` and injects the
`fields=status` parameter the new endpoint requires.

**Proposed.**

1. Upgrade or replace the embedded Jira client so status refresh uses the
   supported `/rest/api/3/search/jql` endpoint (with the required `fields`
   parameter) — or an Atlassian-supported compatibility path.
2. Contract tests for the tracker integrations against live Jira Cloud
   (and Jira Server/DC) in CI, so endpoint deprecations are caught before
   release rather than in a customer's ticket flow.
3. Surface sync failures in the UI: a tracker that tests `connected` but
   fails its sync calls should show a degraded state with the underlying
   error, not silently stale statuses.
4. Document the tracker surface: supported kinds, the exact identity-kind
   spelling (`basic-auth` — other spellings fail with "unsupported
   identity kind"), the required `name` field on tracker POST, and the
   background connectivity tester's 10 s/60 s cycles.

**Acceptance:** ticket status refresh works against live Jira Cloud with
no intermediate infrastructure; a deliberate v2-endpoint removal in CI
fails the build; a sync failure is visible on the tracker in the UI.
```

---

## A9. konveyor/agentic-controller — Harness production-readiness for enterprise repositories

**Where to file:** https://github.com/konveyor/agentic-controller/issues/new
**Suggestion:** #39 · **Design seed:** design doc §6 (filing plan note) · **Wave:** 4

```markdown
## Use case: agentic runs must behave predictably against monorepos, branch-pinned applications, and SSH-only git

**Problem.** The harness works against single-application repositories on
default branches, but enterprise portfolio realities break it — all
verified live on MTA 8.3.3:

1. **The clone ignores the application record's branch metadata.** The
   harness clones the repository's *default branch*; a run planned against
   the recorded `7.4.x` sources actually analyzed the default `8.1.x`
   tree. Results only make sense once you discover the mismatch.
2. **No repository scoping.** The harness clones the *entire* repository
   of the application's Hub record and clears the `HUB_*` environment
   before the agent starts — on a monorepo holding a 100+-application
   portfolio, every run drags in the whole estate. Scoping today is only
   achievable by convention: workflow parameters, instruction text, or an
   image-side wrapper that reads the Hub record's repository path while
   the `HUB_*` env is still set.
3. **HTTPS basic auth only.** The harness clones and pushes in-process
   with a git library whose only auth method is HTTP basic auth —
   `ssh://` repository URLs fail at the clone step, SSH-key identities
   are ignored by runs, and application records with SSH URLs break
   silently at run time (the analyzer's clone is unaffected; only the
   harness path breaks).
4. **CRD/REST binding drift.** The `AgentWorkflowRun` CRD supports
   `fileMounts`, but the deployed Hub's REST binding predates the field
   and rejects it (`json: unknown field "fileMounts"`) — forcing the
   `MAVEN_SETTINGS_XML` environment-variable workaround, because a CR
   applied directly (whose admission would accept the field) has no
   Hub-minted token and fails `401` under Hub authentication.
5. **Stale-workflow runs silently ignore parameters.** Rebuilding the
   agent image does not update the workflow CR; a run launched against a
   stale CR runs without the new parameters — observed: a `test_kind` run
   that silently executed the wrong lane because the live CR's
   `spec.params` lacked the field.
6. **The run-creation contract is undocumented.** Runs must be created
   through the Hub API (the Hub mints the scoped API-token Secret and
   injects `HUB_BASE_URL` server-side); a directly applied CR fails `401`
   at the first Hub call. Correct behavior — but a cluster operator
   applying the CR as with every other resource gets a confusing failure.

**Proposed.**

1. Honor the record's branch and repository-path metadata in the clone —
   or surface a loud warning when the run's tree differs from the record.
2. First-class repository-path scoping driven by the Hub record, making
   monorepos the supported case.
3. SSH support (or validate at record time that the URL scheme is
   harness-compatible) so the failure happens at import, not mid-run.
4. Keep the Hub REST binding in sync with the CRD (or version them) so
   CRD features like `fileMounts` are usable through the supported API.
5. Detect stale workflow references (resource-generation or checksum
   check) and reject or warn on runs against outdated CRs.
6. Document the contract: Hub-minted tokens, required `APP_ID`/
   `TARGET_BRANCH` env, `params` as `{name, value}` pairs.

**Acceptance:** a run on a branch-pinned application in a monorepo via an
SSH-authenticated git server produces results for the recorded branch and
scoped path — or fails loudly at launch with the reason.
```

---

## A10. konveyor/tackle2-ui — Archetypes as administered groups (membership, provenance, dashboard)

**Where to file:** https://github.com/konveyor/tackle2-ui/issues/new (use-case discovery framing, following #3694's pattern; the membership-rules engine itself lands in `tackle2-hub`)
**Suggestion:** #45 · **Design seed:** design doc §6 (filing plan note) · **Wave:** 3

```markdown
## Use case: archetypes should be administered groups, not just labels

**Problem.** Archetypes are MTA's grouping construct for everything
governance-shaped — assessment cascades, risk, generators, wave planning —
but the archetype view falls short in ways that undermine everything built
on it (all observed on 8.3.3; membership item also tracked downstream as
MTA-8172):

1. **Membership cannot be managed in the UI** (MTA-8172: catalog
   membership is unmanageable and confused with operator ownership).
2. **Membership is manual and drifts** — no matching rules, no impact
   preview, no auto-update on import/re-analysis; group composition
   silently diverges from reality, and the assessment cascade, wave
   planning, and generators inherit the drift.
3. **Risk inheritance is invisible** — one archetype assessment made all
   100+ member applications display `assessed=true, risk=red`; inherited
   risk is indistinguishable from an own assessment.
4. **No group dashboard** — member count, assessment/analysis coverage,
   risk distribution, effort, wave spread exist only as portfolio
   aggregates, not on the group itself.
5. **The assessment lifecycle is invisible** — assigned questionnaires,
   `required` flags, stakeholder inheritance, thresholds, and
   change-propagation effects are not rendered.
6. **Multi-archetype membership is silent** — no precedence, conflicts,
   or effective-target-profile display for generation.

**Proposed.**

1. Membership management in the UI (bulk assignment via the batch API;
   clear operator- vs user-owned distinction).
2. Membership rules: criteria by label, tag, platform, business service,
   and dependencies (the dependency-based matching work: MTA-8044/
   8045/8261, MTA-8184); dry-run impact preview before applying;
   auto-apply on import and re-analysis.
3. Risk provenance on every risk display: inherited (with drill-down to
   the producing group assessment) / own / unassessed.
4. A group dashboard per archetype composed from the existing data.
5. An assessment-lifecycle panel with change-propagation warnings.
6. Multi-archetype precedence with effective-target-profile display.

**Acceptance:** membership can be fully managed from the archetype view;
matching rules keep composition accurate as the portfolio changes (with a
preview before applying); a viewer can always tell whether an
application's risk is its own or inherited and from which group
assessment; the archetype view answers "how is this group doing?" without
leaving the page.
```

---

## A11. konveyor/tackle2-ui — Wave execution: progress, gates, timeline, and actuals

**Where to file:** https://github.com/konveyor/tackle2-ui/issues/new (use-case discovery framing; extends the planning thread tackle2-ui#3694 — cross-link it)
**Suggestion:** #46 · **Design seed:** design doc §6 (filing plan note) · **Wave:** 3

```markdown
## Use case: a wave needs an execution view, not just a composition

**Problem.** The Migration Waves view is a static list plus dates — the
endpoint of the wave-planning use case (#3694) and the start of nothing.
Once a wave enters its window, nothing tracks it (all observed on 8.3.3):

1. **No progress.** Whether a wave is 20% or 90% done is reconstructable
   only by opening every member — ticket states live in the tracker
   (the Hub syncs them but the view doesn't render them), per-member
   analysis/run state exists in the API but isn't surfaced.
2. **No definition-of-done** — "is wave 3 finished?" is tribal knowledge.
3. **No timeline** — waves render as a table with RFC3339 dates (the API
   requires RFC3339; date-only entry fails with a confusing parse
   error), with inter-wave dependencies and overdue states invisible.
4. **No capacity vs. effort check** — effort totals exist; over-committed
   waves are never flagged.
5. **No planned-vs-actual** — actual completion isn't recorded; slippage
   is invisible and can't feed trend reporting, so planning never learns
   from execution.
6. **Composition changes don't propagate** — membership-rule changes
   (dependency-based archetype criteria: MTA-8044/8045/8261) silently
   alter wave composition.

**Proposed.**

1. Per-wave progress rollup from member ticket states and analysis/run
   state.
2. Per-wave gates: an editable definition-of-done (default: all tickets
   closed, zero blocking incidents, no quota-blocked tasks) with an
   automatic done/at-risk/blocked badge naming the failing conditions.
3. A timeline rendering (waves as windows, dependency edges from the
   member graph, overdue marking) and plain-date entry.
4. Optional team-days-per-window input with over-commitment flags.
5. Planned-vs-actual recording, shown inline and exported as a trend.
6. "Composition changed by rule R" flags with a one-click re-validate
   (reusing #3694's dependency-check machinery).
7. Cleanup affordances for empty waves and orphaned tickets.

**Acceptance:** a wave's completion fraction and gate status are visible
without opening any member; a blocked wave names its failing conditions;
actual completion dates are recorded and appear in trend reporting;
membership-rule changes surface as re-validate actions on affected waves.
```

---

## A12. konveyor/tackle2-ui (+ tackle2-hub) — Verification: integration-test scoping, execution, and wave-gate evidence

**Where to file:** https://github.com/konveyor/tackle2-ui/issues/new (use-case discovery framing; extends the wave-execution thread — cross-link A11/tackle2-ui#3694; also references the archived tackle-test-generator's unanswered interface question #83)
**Suggestion:** #47 · **Design seed:** design doc §6 (filing plan note) · **Wave:** 4

```markdown
## Use case: a migration isn't done when its tickets close — it's done when the application works

**Problem.** MTA's lifecycle ends at transformation recommendations:
there is no verification phase — no test-surface awareness, no test
execution, no evidence artifact. Waves complete on ticket states alone,
and the agentic layer already runs sandboxed workspaces that commit to
branches (it even ships a citrus test agent and plan/execute/verify
stage triplets) — but test results land nowhere: not on the
application, not on the wave, not in any report. Meanwhile the one
dedicated test-generation path (tackle-test-generator-cli) was archived
in 2026-01 with its interface question (#83: how to interface from
Tackle Inventory) unanswered.

**Proposed.**

1. **Test charter per application:** an integration-surface report
   (databases, APIs, queues, messaging) derived from the application's
   dependency graph — the checklist a verification suite must cover.
2. **Test-suite attachment and execution:** applications and waves
   accept references to user-provided suites (repo path, CI job, or
   container image); execution rides the existing sandboxed task/run
   machinery; results land as evidence artifacts on the run.
3. **Verification as a wave-gate condition:** "integration tests green"
   joins the wave definition-of-done as a first-class, per-member
   condition with pass/fail visibility.
4. **Verification in reporting:** pass rate per application and per
   wave in combined risk and trend reporting.
5. **Test generation as a plugin point:** the archived generator's use
   case revived as a plugin contract (generation against MTA's
   rule/target knowledge), not a bespoke addon.

**Acceptance:** an application page shows its integration-surface
charter; a wave can carry test suites and show per-member verification
state; a wave gate can require green tests; test results appear as
run artifacts and in reporting.
```

## A13. konveyor/tackle2-ui — Multi-lingual console UI (string catalog + language switcher)

**Where to file:** https://github.com/konveyor/tackle2-ui/issues/new
**Suggestion:** #51 · **Design seed:** working 8-locale demonstration in the workspace UI mock (incl. RTL Arabic + per-locale currency) · **Wave:** 5

```markdown
## Use case: the console is English-only, and the migration workforce often isn't

**Problem.** Every console string is hardcoded English — no string catalog,
no language switcher, no locale handling for dates, numbers, or currency.
Migration teams operate across geographies (the same portfolio is triaged by
teams in different countries), and the platform's own data — effort
estimates, spend showback — is locale-sensitive yet renders one way for
everyone.

**Proposed direction** (demonstrated end-to-end in the workspace UI mock):

1. **String catalog + switcher:** extract UI strings into a catalog behind a
   single lookup (exact keys → per-language rules → phrase pass), with a
   masthead language switcher persisted per user server-side — not browser
   localStorage, so the preference follows the account.
2. **Locale-aware rendering:** dates, currency, and numerals localize per
   language; currency is locale-derived with an explicit override.
3. **RTL as a first-class case:** Arabic (and any future RTL locale) flips
   the layout via logical CSS properties — one RTL pass proves the pattern
   and its pitfalls (icon/flag-free switcher, mixed-language data cells stay
   data).
4. **English stays byte-exact:** the catalog must not mutate EN strings —
   the default experience is unchanged.

**Acceptance:** a user-selected language persists across sessions; all
chrome (not data) translates; RTL locales mirror layout without breaking
tables or deep links; EN output is byte-identical to today's.
```

---

## A14. konveyor/tackle2-ui — Light/dark color scheme (persisted, deep-linkable)

**Where to file:** https://github.com/konveyor/tackle2-ui/issues/new
**Suggestion:** #52 · **Design seed:** dark-scheme implementation in the workspace UI mock (PatternFly 6 theming + Red Hat crayon-token remap) · **Wave:** 5

```markdown
## Use case: operators work in dark rooms; the console has one scheme

**Problem.** The console ships light-only. Dark-scheme support is table
stakes for console products (adjacent Red Hat consoles offer it), and ad-hoc
dark CSS tends to *violate* contrast rules rather than solve them —
status colors, label and card pseudo-element backgrounds, and inverse
surfaces all break independently.

**Proposed direction** (demonstrated in the workspace UI mock):

1. Follow the Red Hat theming model: a binary light/dark scheme — not
   free-form "themes" — toggled in the masthead, persisted per user, and
   deep-linkable (`&scheme=`) like every other piece of console state.
2. Implement on PatternFly 6's dark scheme token set; remap only the
   product-specific palette (status and informational colors) against the
   Red Hat crayon tokens so WCAG contrast holds in both schemes. Surfaces
   that must stay dark in both schemes (masthead, tooltips) are pinned, not
   scheme-relative.
3. Risk is never encoded in color alone — the dark remap must preserve the
   non-color risk indicators (icons, labels).

**Acceptance:** the toggle persists and deep-links; a contrast audit passes
in both schemes (including label/card pseudo-element backgrounds and
disabled controls); no raw hex colors; the light scheme is byte-identical
to today's.
```

---

## A15. konveyor/tackle2-ui — Collapsible navigation sidebar (per-user preference)

**Where to file:** https://github.com/konveyor/tackle2-ui/issues/new
**Suggestion:** #53 · **Design seed:** collapse implementation in the workspace UI mock (masthead ☰ toggle) · **Wave:** 5

```markdown
## Use case: the sidebar consumes width the work area needs

**Problem.** The 230px navigation sidebar is permanent. On smaller laptops —
or whenever a wide table, diff view, or right drawer is open — users cannot
reclaim that space: there is no collapse affordance and no per-user
preference.

**Proposed direction** (demonstrated in the workspace UI mock):

1. A masthead ☰ toggle collapses the sidebar, with the content area
   expanding to reclaim the grid track — including the layout pitfall: when
   a grid sibling is hidden, the remaining item needs an explicit column
   placement or it lands in the 0-width track.
2. The collapsed state persists per user (server-side preference, not
   localStorage) and survives deep links.
3. Keyboard reachable: the toggle is a real button with `aria-expanded`,
   and collapsed navigation items keep accessible names (icon-only via
   tooltip/`aria-label`).

**Acceptance:** toggle collapses/expands from the keyboard; the preference
persists across sessions; no layout regression at any console width; all
views remain reachable while collapsed.
```

---
---

# Tier B — deferred register (design-first; file nothing yet)

These eight are architecture-level: they need the §5 design notes promoted to
full KEPs (per §18.4) before any upstream filing, and §5.1's sequencing
deliberately gates them. **Trigger for each: the named wave's entry, after
ADR closure (§18.3) and re-validation of the agentic surface against
upstream main (§7 risk 6).**

| # | Suggestion | Seed design (design doc §5) | Upstream anchors | Wave-entry trigger | Planned vehicle |
|---|---|---|---|---|---|
| #20 | MaaS as governed inference layer | Gateway CRD exists (verified 8.3.3): add default-gateway, fallback chains, per-run model stamping, token/cost into `mta_ai_*` | agentic-controller#192, MTA-8100, MTA-8049 (in flight) | Wave 4 — after observability baseline (#30, Route 1 comment) | KEP → `agentic-controller` (+operator for CRD) |
| #28 | Versioned prompt templates | Prompt templates as versioned artifacts; candidate homes: Apicurio registry (#27) or OCI SkillCard packaging (machinery exists in agentic-controller) | none filed | Wave 4 — after #16 run-record persistence lands (Route 1 comment on #341) | KEP → `agentic-controller` |
| #29 | Guardrails & adversarial evals | NeMo Guardrails at tool-call boundaries; Garak/EvalHub suites in CI; results rendered per run (#16's evaluation hook) | none filed | Wave 4 — after #20 and #28; platform floor K8s 1.33+/OCP 4.20+ (§7 risk 4) | KEP → `agentic-controller` |
| #27 | Apicurio Registry integration | Registry-backed types for prompts/skills/rules; pairs with #28's candidate-home decision | none filed | Wave 5 — decided jointly with #28's ADR | KEP → integration repo TBD |
| #34 | Specification-first plugin architecture | Catalog the extension points *proven* in Waves 2–4 (data providers, inference, exporters, trackers); conformance tests; ≥2 implementations per point | none filed — but see the crane plugin KEPs below (naming space is free) | Wave 5 — by definition formalizes what earlier waves prove | KEP → `konveyor/enhancements` |
| #40 | Pluggable issue-tracker integrations (tracker SPI) | Tracker SPI riding #34's plugin points: create/refresh/state-mapping + capability manifest + declared identity kinds; Jira ported as first plugin (#37's fix = proof of concept + conformance suite); candidates ranked by popularity (Jira → GitHub Issues → Azure DevOps Boards → GitLab → Linear → YouTrack → Asana/Monday/ClickUp → self-hosted OSS → ServiceNow-class ITSM) | none filed — cite #37's CHANGE-2046 breakage as the cost of a built-in client; naming space free (same crane-KEP disambiguation as #34) | Wave 5 — gated on #34's SPI landing; file jointly with or immediately after the #34 KEP | KEP → `konveyor/enhancements` (adjacent to #34's) |
| #48 | Hub API as a supported contract (versioned, documented, deprecation-policy'd — not an internal surface) | Contract v2.1 drafted *and implemented as a reference*: implementation.md §9 (API contracts & RBAC, §9.3 versioning & deprecation) + the `deliverables/hub-backend` run docs; OpenAPI kept release-accurate | MTA-5128 (stale published OpenAPI spec); #49 and every addon/machine consumer depend on it | Wave 1 entry — early: the contract underpins every later wave | Enhancement → `konveyor/tackle2-hub` (contract + versioning policy) |
| #49 | Workflow authoring — compose, version, and share migration workflows from registered agents | Workflow definitions as versioned Hub resources (`/workflows`) whose stages reference registered agents (A2A cards), into the #48 contract from day one; composer UI seeded by the mock's workflow registry | rides the #34 plugin-architecture KEP; agentic-controller#341's run-record persistence is the substrate | Wave 4 — gated on #34's ADR closure (same trigger as #27/#40) | KEP → `konveyor/agentic-controller` (+ tackle2-hub resources), jointly with the #34 KEP |


**Register maintenance:** when a Tier B item's trigger fires, promote its
seed to a full draft (same KEP template as ①–⑤), move it into
`proposals/`, and update the README status table. Nothing in Tier B is
"lost" — each row's seed lives in design doc §5.

**Prior art to cite when drafting #34 (verified in the upstream tree
2026-11):** `konveyor/enhancements` carries plugin KEPs from the **Crane
lineage**, all unrelated to MTA's integration boundaries —
`proposals/plugin-manager-improvements/` (2022, `implementable`; crane
plugin-manager install-path behavior) and five archived
`proposals/crane-2.0-archived/plugin-*/` KEPs (plugin-management,
plugin-release, plugin-passthrough-info, transform-plugin-priority) — plus
the adjacent-but-different `proposals/distributed-language-extensions/`
(language-provider extensions) and closed issue #27 ("Plugins Passthrough
Information"). Implications for the future KEP:

1. **The naming space is free** — no existing KEP proposes a unified
   extension model for MTA; there is no conflict, only a terminology trap.
2. **The KEP must disambiguate up front**: one sentence in the Summary
   distinguishing MTA's plugin architecture from the archived crane
   plugin-manager work ("crane's plugin-manager operates on *transform
   plugins for the crane CLI*; this proposal specifies MTA's product
   integration boundaries") — maintainers who remember the crane era will
   otherwise assume a revival.
3. **Cite, don't inherit**: the crane KEPs' lifecycle decisions (OCI
   packaging, install/upgrade, conformance) are worth referencing as prior
   art where the ideas transfer, while stating explicitly what was
   crane-specific and is not reused.

---

## Relationship to the other routes

- **Route 1** (comments on existing issues): covers the build-on
  clusters, which span Waves 1–3.
- **Route 2** (Wave-0 repo issues): quick wins, fileable immediately.
- **Route 3 Tier A** (this file): Waves 2–5 asks that are evidence-backed
  enough to open the conversation now — with the explicit framing that
  implementation follows the wave sequence.
- **Route 3 Tier B**: the design-first backlog — deliberately not filed.

After filing Tier A, log URLs in design doc §6.4 and flip the README status
rows, same as Routes 1–2.
