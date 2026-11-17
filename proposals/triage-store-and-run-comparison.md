---
title: triage-store-and-run-comparison
authors:
  - "@jcordes73"
reviewers:
  - "@jortel"
  - "@fabianvf"
  - "@abrugaro"
approvers:
  - "@jwmatthews"
creation-date: 2026-11-09
last-updated: 2026-11-09
status: provisional
see-also:
  - "/proposals/deterministic-analyses-and-incident-identity.md"
  - "https://github.com/konveyor/proposals/issues/279"
replaces: []
superseded-by: []
---

# Triage Store and Run Comparison

## Release Signoff Checklist

- [ ] Enhancement is `implementable`
- [ ] Design details are appropriately documented from clear requirements
- [ ] Test plan is defined
- [ ] User-facing documentation is created

## Open Questions

> 1. Path shape: should triage be addressed by incident identity key
>    (`PUT /incidents/{incidentKey}/triage` — stable across runs) or by
>    per-analysis incident ID (`POST /analyses/incidents/{id}/triage` —
>    matches today's resources)? This proposal exposes both, keyed access
>    being the one external tooling should rely on; reviewers may prefer one.
> 2. Should triage apply to *incidents* only, or also to *insights* (rule
>    hits without a location)? Insights-level triage would let a team dismiss
>    an entire noisy rule family in one action, but complicates carry-over.
> 3. Does the `triage.changed` notification ride this proposal's webhook
>    milestone or land with the separate events/webhooks enhancement? This
>    proposal only *emits* the event; delivery infrastructure is out of
>    scope here.

## Summary

Analysis results in Konveyor are read-only: the Hub API exposes incidents
and insights via GET only, so triage decisions — false positive, not an
issue, resolved, deferred, confirmed — live nowhere durable. Today they are
UI-local state at best and tribal memory at worst: nothing syncs to the IDE,
nothing survives re-analysis, nothing feeds back into reporting or into the
AI-assisted fix flow's understanding of what the team has already dismissed.
At the same time, each re-analysis replaces the previous results, so there
is no first-class way to answer "what changed between two runs?" — the
question every migration team asks after a remediation sprint, and the
question management asks every steering meeting. Teams work around both
gaps with spreadsheets and manual static-report diffing.

This enhancement adds two related capabilities to the Hub. First, a
**triage store**: a durable, auditable triage record attached to incidents
by stable identity key (defined in the deterministic-analyses enhancement),
carried forward across re-analyses under defined exact, fuzzy, and re-ask
tiers, writable via API and surfaced in the Hub UI, the static report, and
the IDE through a single mechanism (the existing kai MCP solution server
surface). Second, a **run-comparison endpoint**: a server-side diff between
two analyses of an application returning added, resolved, and changed
incidents, the effort delta, and the triage carry-over summary — turning
"what changed" from a manual export-and-spreadsheet exercise into an API
call and a UI view.

## Motivation

Triage is the step where analysis becomes decisions, and it is currently
the least supported step in the product. The false-positive problem is
well documented in Red Hat MTA JIRA — recurring false-positive rule hits
(MTA-8244, Verified; MTA-5879; MTA-5792; MTA-5780; MTA-5750) and the open
RFE that issues triggered by indirect dependencies look like false positives
(MTA-5973) — yet the product offers no way to record "we assessed this and
it does not apply," so the same findings are re-litigated every analysis
cycle. For a 100+ application portfolio this is a standing tax on every
migration team. The Hub API walkthrough confirms the structural gap:
`/analyses/incidents` and `/analyses/insights` are GET-only in the 143-path
OpenAPI spec, and no diff endpoint exists anywhere.

Run comparison is the reporting twin of the same problem. Suggestion
evidence across large deployments shows progress tracking done externally
in spreadsheets because the product cannot express "resolved since last
run." A server-side diff also protects correctness: client-side diffs built
by every consumer will each re-implement matching logic (and each get it
slightly wrong), while the Hub — which owns incident identity — can compute
the comparison once, correctly, and include the triage carry-over summary
that no external consumer could reconstruct.

This proposal complements konveyor/enhancements#279 (REST frontend and rule
candidate staging for the Kai Solution Server): #279 stages solved examples
for kai's fix generation; this proposal stores triage decisions as
portfolio data in the Hub. They share the incident-identity keystone and
the kai MCP surface, but the stores are distinct — see Alternatives for why
triage does not live in the solution server.

### Goals

- Durable, auditable triage records on incidents, writable via API with
  states `confirmed`, `false_positive`, `not_an_issue`, `resolved`, and
  `deferred`, plus a free-text comment and recorded author.
- Automatic triage carry-over across re-analyses: exact identity-key match
  carries silently; fuzzy match (same rule + file, line drift within
  tolerance) carries flagged for re-confirmation; weaker matches are
  offered, never auto-applied.
- One triage mechanism for all surfaces: Hub UI, static report, and IDE via
  the existing `kai_mcp_solution_server` MCP tools — not three divergent
  stores.
- A first-class diff endpoint comparing two analyses of one application:
  added, resolved, changed incidents, effort delta, triage carry-over
  summary.
- A triage history (audit trail) queryable per incident.
- RBAC that fits the existing scope model: a new `triage:write` scope;
  reads covered by existing analysis-read scopes.

### Non-Goals

- Webhook/event delivery infrastructure (this proposal only emits
  `triage.changed`; delivery is a separate events enhancement).
- Batch triage of whole rule families or archetype-level triage policies
  (candidate follow-up once per-incident triage is proven).
- Confidence weighting of triage data into effort estimates (Solution
  Server metrics promotion is a separate work item).
- Fixing rule correctness — triage records *decisions about* findings, it
  does not change them.
- Re-implementing the solution server's solved-example staging (#279).

## Proposal

### User Stories

#### Story 1: Migrator triages in the IDE, decisions persist in the Hub

As a migrator working in VS Code, I mark an incident false positive with a
comment "javax.xml is provided by the target runtime." The extension writes
the triage through the Hub API. When a colleague opens the same application
in the Hub UI, the finding shows the same triage state, comment, and author
— one store, every surface.

#### Story 2: Architect shows remediation progress

As an architect, I select two analyses of the application (before and after
the remediation sprint) and get: 14 resolved incidents, 3 new, effort down
from 210 to 165, and a note that 41 triage decisions carried over. This is
the steering-meeting slide, generated in one click instead of an afternoon
of spreadsheet work.

#### Story 3: Team survives re-analysis churn

As a team lead, an upstream framework upgrade shifts line numbers across
the codebase, and the next analysis moves dozens of incidents. Triage
carries: exact matches silently, shifted ones flagged "carried — please
re-confirm" in the UI. Nothing my team decided is silently lost, and
nothing stale is silently applied.

#### Story 4: Automation reads and writes triage

As a CI operator, my pipeline starts an analysis, waits for the diff
against the previous run, and fails the build if any *new* incident has
effort ≥ 5 without an existing `not_an_issue` triage — a policy gate built
entirely on API calls that today would require scraping the UI.

#### Story 5: kai learns from triage, not from tribal memory

As a developer using AI-assisted fixes, the kai solution server sees the
team's triage history: incidents marked false positive are not re-suggested,
and confirmed incidents rank first. Triage becomes training signal instead
of a sticky note.

### Implementation Details/Notes/Constraints

**1. Triage store (tackle2-hub, Postgres).** One row per incident identity
key per application (upsert); a history table appends on every change:

```sql
CREATE TABLE triage (
  id             BIGSERIAL PRIMARY KEY,
  incident_key   TEXT        NOT NULL,     -- sha256 identity from the
                                           -- deterministic-analyses KEP
  application_id BIGINT       NOT NULL REFERENCES application(id),
  state          TEXT         NOT NULL CHECK (state IN
                   ('confirmed','false_positive','not_an_issue',
                    'resolved','deferred')),
  comment        TEXT,
  author         TEXT         NOT NULL,    -- Hub username
  carried        TEXT,                     -- NULL | 'exact' | 'fuzzy'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX triage_incident_key_idx ON triage (incident_key);
CREATE INDEX triage_application_idx  ON triage (application_id);
-- triage_history: (triage_id, old_state, new_state, actor, at)
```

`carried` records how the triage arrived on this incident (fresh write,
exact carry, fuzzy carry) — the audit surface for the fuzzy tier.

**2. API (additive, versioned, following existing Hub JSON conventions).**

```yaml
PUT /incidents/{incidentKey}/triage:
  body: {state, comment}
  responses: {"200": triageView, "403": noTriageWrite}
GET  /analyses/{id}/triage:            # triage state joined onto a run's incidents
GET  /incidents/{incidentKey}/triage/history:
GET /applications/{id}/analysis/diff:
  params: {from: taskId, to: taskId}
  responses: {"200": {added[], resolved[], changed[], effortDelta,
                      triageCarryover}}
```

`incidentKey` is the identity defined in the deterministic-analyses
enhancement; per-run numeric incident IDs continue to work for
same-run access. Diff semantics: incidents compared by identity key across
the two runs; `changed` means state-affecting fields differed (severity,
effort, message); runs with *different* toolchain manifests are diffable
but annotated with both manifests so consumers can attribute variance.

**3. Carry-over execution.** On analysis completion the Hub classifies each
new incident against stored triage rows using the shared tier rules (exact /
fuzzy ≤ 10-line drift / re-ask / new) and writes `carried` accordingly.
The function lives in `tackle2-hub/shared`, mirrored in kai, contract-tested
on both sides — the same shared function this proposal depends on from the
deterministic-analyses work.

**4. Surface integration.** Hub UI: triage badges on incident lists, an
edit affordance with state/comment, history on demand, and a
"carried — re-confirm" prompt for fuzzy carries. Static report: triage
state rendered in the incident listing (the report is generated from Hub
data, so parity is free once the model exists). IDE: editor-extensions
consumes triage through the existing kai MCP solution server tools so the
extension surfaces and writes the same records — one mechanism, not a
parallel API. The Hub emits a `triage.changed` event on every write for
downstream consumers (delivery infrastructure out of scope, see Open
Question 3).

**5. RBAC.** A new `triage:write` scope granted to migrator, architect, and
admin; triage reads ride existing analysis-read scopes. For non-admin
roles, write additionally requires membership in the application's business
service (configurable rule); every write appends to `triage_history` with
the acting username. The operator packages the new scope in the Keycloak
realm as with all existing scopes.

**Repo impact.** `tackle2-hub` (schema, endpoints, carry-over, event
emission) is primary; `tackle2-ui` (badges, edit affordance, diff view,
re-confirm prompt); `kai` (MCP tool exposure of triage read/write);
`editor-extensions` (consume the MCP surface); `static-report` (render
triage state).

### Security, Risks, and Mitigations

- **First write surface on analysis data.** The analysis API has been
  read-only; adding writes introduces a mutation path into previously
  read-only resources. Mitigation: new scope (`triage:write`), business-
  service membership rule for non-admins, full audit trail, and enum-
  validated states; comment length capped to bound abuse.
- **Triage as an LLM-injection surface.** Triage comments and states feed
  downstream weighting in kai (#10's confidence loop); a malicious or
  careless comment could steer fix suggestions. Mitigation: states are
  enum-checked server-side, comments are treated as untrusted text (length-
  capped, rendered safely in all surfaces), and kai consumes triage state —
  not raw comment text — for weighting.
- **Fuzzy carries can mis-apply decisions.** A wrong fuzzy carry silently
  teaches the wrong lesson downstream. Mitigation: fuzzy carries are
  flagged, require explicit re-confirmation, and are distinguishable in the
  audit trail (`carried: fuzzy`).
- **Multi-tenancy.** Triage rows are scoped by application and business
  service; the membership rule prevents cross-team writes in shared
  instances, consistent with existing application-level authorization.
- **Privacy.** Triage comments are free text — same classification as
  existing application metadata; no source code is stored in triage
  records. Access review is ordinary PR review by hub maintainers; no new
  privilege boundaries beyond the new scope.

## Design Details

### Test Plan

- **Unit:** carry-over classification over synthetic before/after incident
  sets covering all four tiers and the negative cases — an incident that
  vanishes on re-analysis (its triage is retained in history, not deleted),
  a rule that disappears entirely (triage orphaned, visible in history),
  and a comment at the length cap. Diff computation: added/resolved/changed
  classification, effort-delta arithmetic, differing-manifest annotation.
- **Integration:** OpenAPI-validated contract tests for every endpoint
  (spec examples embedded in the PR, per Hub convention); RBAC tests —
  `triage:write` honored, business-service rule enforced for non-admins,
  audit rows written on every mutation; carry-over executed on real
  re-analysis within a taskgroup.
- **E2E / acceptance:** the full round-trip — triage written via the IDE
  (editor-extensions Playwright) is visible in the Hub UI and the static
  report; re-analysis carries it with the correct tier; the diff endpoint
  returns the carry-over summary; a `triage.changed` event is emitted.
  Acceptance criterion from the design: triage via API is visible in UI and
  IDE and preserved across re-analysis under the same incident key.
- **Cross-component:** hub-owned normalization vs. kai's mirrored
  implementation agree on the shared case vector (inherited from the
  deterministic-analyses contract tests, extended with triage payloads).

Tricky cases called out: concurrent triage writes to the same key
(last-write-wins with history preserved); diffing runs where one predates
the toolchain manifest (pre-determinism annotation, diff still served);
triage on an incident whose snippet changed but line did not (re-ask tier).

### Upgrade / Downgrade Strategy

- **Upgrade:** purely additive schema (new tables, no alteration of
  existing ones); no data migration. Existing analyses are diffable — runs
  without toolchain manifests are annotated, not rejected. New scope
  appears in the Keycloak realm via operator upgrade; until UI support
  lands, the API is the interface of record.
- **Downgrade:** older Hub versions ignore the triage tables (additive);
  triage data is retained but not served. Because carry-over tiers are
  recorded on rows (`carried`), no state becomes inconsistent on downgrade.
- **Version skew:** an old kai/extension that is unaware of triage
  continues to work — triage is invisible to it, not breaking. An
  extension that writes triage against an old Hub receives a clean 404,
  which the extension surfaces as "triage requires Hub version ≥ X."

## Implementation History

- 2026-11-09: proposed (provisional). Companion to
  `deterministic-analyses-and-incident-identity.md` (dependency: incident
  identity); complements konveyor/enhancements#279. Grounded in Red Hat MTA
  JIRA evidence (MTA-8244, MTA-5879, MTA-5792, MTA-5780, MTA-5750, MTA-5973)
  and the verified read-only state of `/analyses/*` in the Hub OpenAPI spec.
- 2026-11-09: filing status — **new filing**; no existing proposal covers
  the triage store. Adjacent upstream item: konveyor/enhancements#279
  (solved-example staging for kai) — a complement, not a duplicate (see
  Alternatives); coordinate at filing time with a cross-reference comment
  on #279.

## Drawbacks

- **New write surface and authorization on a previously read-only API.**
  Every write path is a new audit, validation, and abuse surface, and RBAC
  grows a scope that must be packaged, documented, and understood.
- **Carry-over logic is judgment encoded in code.** The tier thresholds
  (line drift ≤ 10, snippet window ± 3) are defensible defaults, not
  truths; wrong thresholds either lose triage (too strict) or mis-apply it
  (too loose), and tuning will generate feedback for years.
- **The diff endpoint freezes comparison semantics.** Once consumers build
  on `added/resolved/changed`, redefining any category becomes a
  compatibility event — the same freezing cost as the identity key, paid
  again.
- **Storage and review cost of free-text comments** at portfolio scale
  (100+ applications, thousands of incidents), most of it low-value text.

## Alternatives

- **Client-side triage** (persist in the IDE/UI locally, sync opportunistically).
  Rejected in the Hub↔IDE integration analysis: opportunistic sync never
  converges — it produced the divergences users already report, and it
  leaves reports, static reports, and other consumers blind to triage.
- **Store triage in the kai solution server** (alongside solved examples).
  Rejected: triage is portfolio decision data owned by the Hub — it must
  outlive any single AI component, be reportable without the AI stack, and
  respect Hub RBAC. The solution server should *consume* triage (and does,
  via #279's REST frontend), not own it.
- **File-level or rule-level triage only** (no incident granularity).
  Rejected as the sole mechanism: it cannot express "this specific finding
  is real, that one is not" — but note Open Question 2: insights-level
  triage may be a worthwhile *addition* later.
- **Diff computed client-side from two exported result sets.** Rejected:
  every consumer re-implements matching (and each diverges); the Hub
  already owns identity and can diff once, correctly, including triage
  state no external consumer can see.
- **Do nothing; keep triage in external trackers.** Rejected by the
  evidence: MTA-5973-class confusion and repeated re-triage are exactly the
  failure mode of externalizing this state.

## Infrastructure Needed

- None beyond the Hub's existing Postgres and migration machinery. The
  `triage.changed` event presumes the events/webhooks enhancement lands
  eventually, but this proposal is deliverable and testable without it.
