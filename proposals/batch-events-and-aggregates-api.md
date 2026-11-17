---
title: batch-events-and-aggregates-api
authors:
  - "@jcordes73"
reviewers:
  - "@jortel"
  - TBD # tackle2-ui maintainer
approvers:
  - "@jwmatthews"
creation-date: 2026-11-09
last-updated: 2026-11-09
status: provisional
see-also:
  - "/proposals/triage-store-and-run-comparison.md"
replaces: []
superseded-by: []
---

# Batch, Events, and Aggregates API

## Release Signoff Checklist

- [ ] Enhancement is `implementable`
- [ ] Design details are appropriately documented from clear requirements
- [ ] Test plan is defined
- [ ] User-facing documentation is created

## Open Questions

> 1. Delivery semantics: v1 ships at-most-once (single attempt + delivery
>    log + manual replay). Is that honest floor acceptable at first, or do
>    reviewers require at-least-once with exponential backoff from day one?
>    The log-and-replay design was chosen to keep the first version small
>    and auditable; adding retries later is additive.
> 2. Is the delivery worker in-process (a Hub worker goroutine pool, like
>    existing background work) or a separate deployment the operator
>    scales? In-process is proposed for v1; a dedicated worker changes the
>    operator surface and should be a deliberate second step.
> 3. Batch size caps: what is the maximum applications per batch analysis
>    call (queue-flooding guard)? Proposed: a configurable setting, default
>    100, with per-application results regardless — but the default needs
>    input from deployments running 100+ application portfolios.
> 4. Aggregate `groupBy` taxonomy: the proposed enum
>    (`archetype`, `businessService`, `wave`, `tagCategory`) covers today's
>    grouping constructs. Should tag *category* selection be a parameter
>    (groupBy a specific category) or should the response nest all
>    categories?

## Summary

The Hub API is broad — roughly 143 paths of CRUD over the full inventory,
task management for addons, analysis reports, and CSV imports — but it is
shaped for interactive UI use, not automation. Walking the API against the
actual migration workflow exposes four systematic gaps. **Bulk operations**
exist only for tags and tickets (`/batch/tags`, `/batch/tickets`): there is
no way to start analyses across a hundred applications, or to assign waves
and archetypes in bulk, so onboarding a portfolio means 100+ individual
calls. **Outbound events** do not exist: automation must poll task state
because there is no subscription mechanism for "analysis completed" or
"task failed." **Aggregations** are computed client-side: portfolio effort
rollups require fetching every analysis and summing in the consumer, which
is why dashboards are slow and inconsistent. And **tag usage** is not
queryable — no endpoint maps a tag to the applications carrying it, so even
the API cannot answer "what breaks if I retire this tag?"

This enhancement fills those four gaps in the Hub's own idioms: a
generalized batch API (analyses, applications, wave/archetype assignment)
extending the verified `/batch/*` pattern; webhook subscriptions — a
`Webhook` resource with HMAC-signed, metadata-only payloads, a delivery
log, and manual replay; server-side aggregate endpoints (`/report/effort`,
`/report/issues` grouped by archetype, business service, wave, or tag
category); and the tag-usage lookup. Together they turn the Hub from a
UI-backend into the automation platform the migration workflow needs: CI
pipelines, IDE extensions, GitOps tooling, and dashboards drive the full
analyze → triage → plan → remediate loop through the API instead of
polling, scraping, and re-computing.

## Motivation

Deployment evidence from 100+ application portfolios makes these the
binding constraints on MTA as an automation platform. Onboarding is the
clearest case: application import exists, but starting a source-and-
dependencies analysis across the portfolio one call at a time — then
polling every task — is the documented workaround. The API is verified to
have no webhook or event resource anywhere in its 143-path OpenAPI spec,
so every CI/CD integration is a polling loop against task state, with
latency and load that grow with the fleet. Portfolio reporting is the
third gap: the UI's Reports implementation aggregates client-side because
the Hub offers no flattened rollup endpoint, so every dashboard consumer
re-fetches and re-sums the same analysis data — N+1 fetches, no caching,
and numbers that differ between consumers. And the small gaps bite too:
`GET /tags/{id}/applications` returns 404 today (verified), leaving tag
taxonomy cleanup — a real task at 434 seeded tags and 38 categories —
unguided even for API consumers.

Upstream movement confirms the direction: the newest UI work includes
server-side application/archetype filter chips on the Runs pages
(MTA-7482 / konveyor/tackle2-ui#3523) — the first server-side filtering
move — and MTA-8247 (adding `tasks:GET` to the Keycloak scopes) shows task
API automation already bumping against the current RBAC surface. Like the
export-standards cluster, this territory is unfiled: searches found no
existing webhook, batch-analysis, or aggregate-endpoint work in the
Konveyor org or MTA project. The triage-store enhancement (see-also)
provides the `triage.changed` event's consumer side and shares the
"additive, versioned, documented-in-PR" API discipline.

### Goals

- Generalized batch API: `POST /batch/analyses` (start analysis on N
  applications with one profile), `POST /batch/applications` (bulk
  create/update), and bulk wave/archetype assignment — extending the
  existing `/batch/tags`/`/batch/tickets` pattern.
- Webhook subscriptions: `Webhook` resource CRUD (HTTPS URL, secret,
  enabled, event filters), events `task.completed`, `analysis.completed`,
  `triage.changed`, `application.changed`; HMAC-SHA256-signed,
  timestamped, metadata-only payloads; a delivery log with manual replay.
- Server-side aggregates: `GET /report/effort?groupBy=…` and
  `GET /report/issues?groupBy=…` returning per-group effort,
  application counts, and issue counts, with filters matching the UI's.
- Tag usage: `GET /tags/{id}/applications` (the verified 404 becomes a
  list).
- RBAC that fits the existing model: one new scope (`webhooks:manage`,
  admin-only); batch under existing create/update scopes; aggregates and
  tag usage under existing read scopes.
- Every endpoint documented in the OpenAPI spec in the same PR, with
  examples, per the Hub's documentation discipline.

### Non-Goals

- Retry-with-backoff delivery (v1 is single-attempt + log + replay;
  backoff is an additive v2, see Open Question 1).
- SSE or streaming event delivery, and message-bus integration (Kafka et
  al.) — v1 webhooks only; a bus is a deployment dependency far beyond
  this scope.
- Inbound events / bi-directional sync (no external system can *push*
  into the Hub through this mechanism).
- New report visualizations — the UI consumes the aggregates; the
  dashboards themselves are separate work (Suggestions 4, 14, 32).
- A general plugin or event-framework abstraction (that is the later
  extensibility wave; this ships four concrete, high-value mechanisms).
- Bulk triage (follow-up to the triage-store enhancement once
  per-incident triage is proven).

## Proposal

### User Stories

#### Story 1: Onboarding engineer analyzes a portfolio in one call

As an onboarding engineer, I import 120 applications from CSV and then
issue one `POST /batch/analyses` for all of them with the standard
source-and-dependencies profile. I get a taskgroup reference back, watch it
in the Task Manager, and my one polling loop (or one webhook) tracks the
whole batch — not 120 ad-hoc tasks and 120 pollers.

#### Story 2: DevOps wires completion events instead of polling

As a DevOps engineer, I register a webhook for `analysis.completed` and
`task.failed`. My provisioning pipeline starts when the analysis actually
finishes — within seconds, not at the next poll interval — and my systems
generate a fraction of the API load they did while polling.

#### Story 3: Dashboard builder gets numbers from the server

As a dashboards builder, I call `GET /report/effort?groupBy=businessService`
and render the response. One request, one consistent definition of the
rollup, cached server-side — instead of fetching every analysis and
re-implementing the aggregation, which is why my previous dashboard
disagreed with the UI's numbers.

#### Story 4: Admin recovers from a consumer outage

As an administrator, I return from a weekend outage to find the delivery
log showing every webhook delivery that failed while the consumer was
down. I fix the consumer and replay the log entries with one call each —
no events were silently lost, and no pipeline backfill scripts were
written.

#### Story 5: Tag curator retires tags safely

As a tag curator, `GET /tags/{id}/applications` tells me which tags are
unused across the portfolio (cleanup candidates) and which are load-bearing
(do not touch). At 434 seeded tags, this is the difference between a
governed taxonomy and archaeology.

### Implementation Details/Notes/Constraints

**1. Batch API.** The Hub already has a batch idiom (`/batch/tags`,
`/batch/tickets` — verified) and a taskgroup entity for multi-application
work (verified in the task model). The extension follows both:

```yaml
POST /batch/analyses:   {applicationIds[], profileId} → taskgroupRef
POST /batch/applications:  {applications[]} → created/updated refs
PATCH /archetypes/{id}/applications:  {applicationIds[]}   # bulk assignment
PATCH /waves/{id}/applications:       {applicationIds[]}
```

Per-application results are returned even for mixed success (each
application's acceptance/rejection with reason), so a bad application does
not poison the batch. Batch size is capped by a configurable setting
(default 100, Open Question 3) as a queue-flooding guard — a batch that
overshoots is rejected whole with the cap stated, never silently
truncated. Batch operations are idempotent where the underlying operation
is (bulk assignment), and the analysis batch creates exactly one
taskgroup regardless of retries with the same parameters.

**2. Webhooks.** Resource and delivery-log model:

```yaml
Webhook:
  id, url (https required), secretRef (write-only, never returned),
  enabled, events[] ∈ {task.completed, analysis.completed,
                       triage.changed, application.changed},
  createdAt, createdBy
WebhookDelivery:
  id, webhookId, eventId, payloadRef (bucket), 
  status (pending | delivered | failed),
  attempts, lastAttemptAt, responseCode, durationMs
```

Delivery contract: payloads are **metadata only** — resource IDs, kinds,
states, and timestamps; never source code, analysis content, or transcript
material — so a webhook can be safely received by systems with weaker
isolation than the Hub. Signatures are HMAC-SHA256 over the body with a
timestamp header (replay-window check documented for consumers). Delivery
dispatches within 10 s of the event (single in-process worker, Open
Question 2); v1 makes exactly one attempt, records the outcome in the
delivery log, and exposes `POST /webhooks/{id}/deliveries/{deliveryId}/replay`
for manual re-delivery. URL validation rejects non-HTTPS and private/
loopback targets (SSRF guard) unless an operator setting explicitly
allows internal endpoints — webhook receivers inside the cluster are a
legitimate topology that needs an opt-in, not a ban.

**3. Aggregates.**

```yaml
GET /report/effort?groupBy=archetype|businessService|wave|tagCategory&filters…
  → {groups: [{key, effort, applicationCount, issueCounts}]}
GET /report/issues?groupBy=…  → same shape over issue categories
```

Filters mirror the UI's application filters (business service, archetype,
wave, tag). The rollup must be **consistent with the UI's numbers** — the
acceptance test is parity between the endpoint and the UI rollup on a
fixture portfolio, so there is one definition of "effort by wave," not
two. Implementation is straightforward SQL aggregation over the analysis
model with supporting indexes; the non-functional target is p95 ≤ 500 ms
at 1,000 applications / 10,000 analyses — eight times the largest
surveyed deployment's portfolio.

**4. Tag usage.** `GET /tags/{id}/applications` — a join endpoint; also
its inverse companion in the OpenAPI examples (list tags with zero
applications) to make taxonomy cleanup a two-query exercise.

**5. RBAC.**

| Endpoint | Scope | New? | Roles |
|---|---|---|---|
| `/webhooks*` | `webhooks:manage` | **new** | admin |
| `/batch/analyses` | `analyses:create` + `applications:update` | existing | migrator, admin |
| bulk assignments | `applications:update` | existing | migrator, admin |
| `/report/*` | `reports:read` | existing | architect, admin |
| `/tags/{id}/applications` | `applications:read` | existing | all |

The new scope is packaged in the Keycloak realm by the operator like all
existing scopes; MTA-8247 (`tasks:GET` scope gap) is the adjacent RBAC fix
and should land with this work so automated task-watching is fully
scope-correct.

**Repo impact.** `tackle2-hub` carries essentially all of it (batch
endpoints, webhook resource + delivery worker + log, aggregate queries,
tag usage, OpenAPI); `tackle2-ui` consumes aggregates for Reports (replacing
client-side aggregation incrementally); `operator` ships no new surfaces in
v1 (dashboards/alerts for webhook health are natural follow-ons from the
observability work).

### Security, Risks, and Mitigations

- **Webhooks are a new outbound surface for the Hub.** Risks and
  mitigations, deliberately conservative v1: SSRF guarded by HTTPS-only +
  private-network rejection (with explicit operator opt-in for internal
  receivers); secrets write-only and never returned by the API; payloads
  metadata-only so no source code or transcripts leave via a webhook;
  HMAC + timestamp defeats replay; the delivery log makes every delivery
  auditable. This is the smallest viable webhook system, chosen precisely
  to bound the new operational surface.
- **At-most-once semantics can surprise.** A consumer that assumes
  retries will silently miss events during transient failures. Mitigation:
  the delivery log + replay is the documented recovery path, the semantics
  are stated in the OpenAPI description and docs, and the failed-delivery
  state is visible in the UI (admin view).
- **Batch is an amplification surface.** A mis-scoped or buggy client can
  enqueue work at fleet scale. Mitigation: batch caps (configurable),
  scope checks per underlying operation, per-application results, and the
  queue-health metrics from the observability work making flooding visible
  immediately.
- **Aggregates enable inference.** Effort-by-group data is business-
  sensitive (it reveals portfolio risk shape); it sits behind
  `reports:read`, the same scope that governs report reads today — no
  new exposure class, but the endpoint makes bulk exfiltration easier for
  an authorized reader. Accepted: the same reader can already page through
  analyses; this changes convenience, not privilege.
- **Delivery-log retention.** Delivery records accumulate; default
  retention (30 days) with operator configuration, documented.

## Design Details

### Test Plan

- **Unit:** HMAC signature generation/verification (including the
  timestamp window); payload serialization (metadata-only asserted — a
  test walks every event type's payload schema and fails on any
  non-whitelisted field); batch cap enforcement; per-application result
  assembly for mixed-success batches.
- **Integration:** delivery worker against a mock consumer — 2xx logged
  delivered, non-2xx logged failed with response code, consumer-down
  logged failed, replay re-delivers; webhook CRUD with secret
  write-only-ness asserted; aggregate endpoints vs. a fixture portfolio
  (parity with the UI rollup is the acceptance test); batch analysis
  creating exactly one taskgroup; RBAC tests on every endpoint including
  the new scope.
- **E2E / acceptance:** CI demo — analysis completes → registered webhook
  receives a signed `analysis.completed` payload (the design's acceptance
  criterion); onboarding demo — CSV import → batch analysis → aggregate
  query returns numbers matching the UI for the same portfolio; tag-usage
  endpoint returns correct application sets for seeded tags.
- **NFR:** aggregate p95 ≤ 500 ms at 1,000 applications / 10,000 analyses
  (nightly load test); webhook dispatch ≤ 10 s after event (fault
  injection: slow consumer does not delay event processing).

Tricky cases called out: event ordering when a webhook fires for an entity
that changes twice in quick succession (deliveries carry the event ID and
timestamp; consumers deduplicate); batch containing an application already
being analyzed (reported per-application, not batch-fatal); aggregate over
applications with zero analyses (group present with zero counts, not
omitted); webhook deleted while deliveries pending (pending deliveries
marked cancelled, logged).

### Upgrade / Downgrade Strategy

- **Upgrade:** additive — new endpoints, two new tables (webhook,
  webhook_delivery), one new scope, settings keys for caps and retention.
  Webhooks ship disabled by default (`webhooks.enabled` setting, ops
  opt-in) so no deployment gains an outbound-surface change it did not ask
  for. Existing clients are untouched.
- **Downgrade:** older Hub versions lack the endpoints; webhook and
  delivery tables are simply unused (additive). In-flight deliveries at
  downgrade time are lost and discoverable only after re-upgrade from the
  log's absence — documented, and one more argument for the conservative
  single-attempt design.
- **Version skew:** UI newer than Hub renders the webhook admin view as
  unavailable (setting absent) rather than broken; external consumers get
  clean 404s, which the documented behavior explains as
  "webhooks require Hub ≥ X."

## Implementation History

- 2026-11-09: proposed (provisional). Covers items 3–6 of Suggestion 33
  (items 1–2 — triage and diff — are the companion
  `triage-store-and-run-comparison.md`). Grounded in verified Hub-API
  facts (`/batch/tags` and `/batch/tickets` as the only batch endpoints;
  no webhook/event resources; `/tags/{id}/applications` 404; Reports
  aggregating client-side) and upstream movement (MTA-7482 /
  tackle2-ui#3523 server-side filter chips; MTA-8247 tasks:GET scope gap).
  JIRA and GitHub searches found no prior webhook/batch/aggregate work in
  the Konveyor org or MTA project.
- 2026-11-09: filing status — **new filing**; the empty-search result is
  itself the novelty evidence and should lead the PR description. Related
  consumer-side moves (MTA-7482 / tackle2-ui#3523, MTA-8247) are linked as
  adjacent work, not prior proposals.

## Drawbacks

- **Webhooks are forever.** Once external systems depend on deliveries,
  the payload schema, signature scheme, and event set become compatibility
  surfaces that constrain every future change — the same freezing cost as
  the incident identity, paid on the integration edge where consumers are
  least visible to the maintainers.
- **Single-attempt delivery under-delivers on the name.** Users hear
  "webhooks" and assume managed-queue semantics; the gap between
  expectation and the log-and-replay reality will generate support
  conversations until retries land in v2.
- **New operational surface.** Outbound network calls from the Hub are a
  new failure domain (slow consumers, egress restrictions, DNS) with new
  support questions; even the minimal v1 has this, and the in-process
  worker (Open Question 2) puts it inside the Hub's own resource
  envelope.
- **Aggregates freeze the rollup definitions.** "Effort by wave" encoded
  in an endpoint becomes the definition every dashboard relies on; getting
  it wrong initially is worse than not having it, because it will be
  everywhere at once.
- **Batch + queue interaction.** Bulk analysis makes it trivial to enqueue
  hundreds of analyses; without the cap and without the observability
  work's queue metrics, this converts a convenience into an outage tool.

## Alternatives

- **Status quo (polling + client-side aggregation).** Rejected by the
  evidence: polling loops against task state are the documented workaround,
  client-side aggregation is why dashboards disagree with the UI, and the
  load grows linearly with the fleet.
- **SSE instead of webhooks.** Rejected for v1: persistent connections
  across load balancers and proxies, reconnect/replay semantics, and
  client-library spread make SSE a bigger surface than webhooks for the
  same events; webhooks also work for non-browser consumers, which is the
  audience here. SSE remains viable for a future UI-notify feature.
- **Message-bus integration (Kafka/AMQP) as the event system.** Rejected
  for v1: a broker is a new deployment dependency for every MTA
  installation, far beyond the smallest viable version. A bus adapter can
  be added later by a consumer webhook-to-bridge without Hub changes.
- **Aggregates as a materialized/reporting database** (separate rollup
  store refreshed by a job). Rejected for v1 as premature: SQL aggregation
  meets the NFR at 10× the surveyed scale; a rollup store adds a
  consistency problem (stale numbers) that the parity acceptance test
  would have to police.
- **Generic "subscriptions" API** (arbitrary filters over arbitrary
  resources). Rejected: the four concrete events cover the verified
  automation needs; a general subscription language is the extensibility
  wave's problem and would delay this by design-debate quarters.
- **Batch via repeated individual calls documented as a pattern.**
  Rejected: 120 calls with 120 failure modes is not automation, it is
  scripting with extra steps; the taskgroup entity already exists to
  represent the batch.

## Infrastructure Needed

- None beyond the Hub's existing Postgres, bucket, and worker machinery.
  The delivery worker is in-process in v1 (Open Question 2); if a later
  version extracts it to a separate deployment, that becomes an operator
  CR field and belongs in the deployment-customization proposal's scope.
