# Suggested design: Agentic run observability and a persistent event log

**Status**: proposal · **Scope**: Konveyor AI / MTA agentic platform (agentic-controller,
tackle2-hub, tackle2-ui, in-pod harness) · **Date**: 2026-11

## 1. Problem statement

The current agentic architecture (ADR 0002 as amended by ADR 0008, client contract in
[agentic-controller #22](https://github.com/konveyor/agentic-controller/issues/22)) has
two structural observability gaps:

1. **No observation without a connected client.** The run's ACP stream is teed by the
   in-pod harness only to *attached viewers*. When nobody watches — the normal case for
   batch playbook runs — nothing captures what the agent did.
2. **No persisted state.** Goose's per-connection agent instances and the pod-local
   SQLite store die with the sandbox. The replay ring in the harness covers only
   late-attaching viewers. There is no way to review a run afterwards, and no data from
   which to derive insights: token/cost effectiveness per migration, tool failure rates,
   skill-version comparisons, or HITL friction.

Consequences today: a failed or expensive run cannot be audited after the fact; skill
and tool improvements are driven by anecdote; token spend is invisible; and the only
durable artifacts are the git diff and `.konveyor/result.json`.

Upstream work has started to address parts of this — transcript persistence
([#341](https://github.com/konveyor/agentic-controller/issues/341)), usage accounting
research ([#192](https://github.com/konveyor/agentic-controller/issues/192)), and a
run-level usage telemetry ADR ([#282](https://github.com/konveyor/agentic-controller/issues/282)).
This proposal builds on and converges with them; §13 maps the overlap and the deltas.

## 2. Proposal in one paragraph

Make the **Hub the primary contact** for agent events: the in-pod harness keeps driving
the run (it remains the only ACP client), but its tee **pushes the event stream up to
the Hub** over an outbound, hub-token-authenticated WebSocket. The Hub normalizes and
**persists the event log in its existing PostgreSQL database**, serves live subscribers
and retrospective replay from that store, and exposes aggregates for analytics. The
browser keeps exactly one credential (the hub token); the per-run ACP key never leaves
the pod; the controller stays stateless.

## 3. Goals and non-goals

**Goals**

- G1 — Every run is fully observed whether or not anyone is watching (always-on capture).
- G2 — The event stream outlives the pod and workspace; runs can be reviewed
  retrospectively with the same fidelity as a live view.
- G3 — Token usage, tool usage, and HITL interactions are captured in one normalized
  schema and queryable per run, stage, application, agent, and skill version.
- G4 — Cost effectiveness can be measured (tokens/cost per migrated artifact) and fed
  back into skill/tool improvements.
- G5 — Operational footprint stays compatible with disconnected OpenShift clusters: no
  new always-on infrastructure beyond the existing Hub database.

**Non-goals**

- Moving run *driving* (session/prompt issuance, git lifecycle, playbook stage
  execution) out of the harness — that stays pod-side (see §4, Variant B rejected).
- Real-time policy enforcement on agent traffic (a possible future use of the same tap).
- Streaming metrics into an external observability stack (Prometheus/OTel export can be
  layered on later from the same event store).

## 4. Architecture

### 4.1 Variant decision

| Variant | Description | Verdict |
|---|---|---|
| **A — Hub as recorder/broker (chosen)** | Harness keeps driving the run; its tee pushes events to the Hub; Hub persists, fans out, replays | Meets G1–G5; run model untouched |
| B — Hub as driver | Hub holds the ACP client connection and issues `session/prompt` | Rejected: breaks the harness-owned git lifecycle, batch playbook execution, fail-closed HITL, and the controller's sandbox-lifecycle reconciliation model |

### 4.2 Target topology

```
Browser (tackle2-ui, hub token only)
   │  REST /agent/… (as today)      │  WS /agent/agentruns/:name/stream   (new)
   ▼                                ▼
Hub (tackle2-hub)
   │  REST CRUD + RBAC              │  session registry: fan-out to N subscribers,
   │  event ingestion API           │  replay API, rollups, cost enrichment
   ▲                                │  PostgreSQL: run_events / run_usage_rollups
   │  outbound WS uplink (hub token, cursor-resumable)
   │
Sandbox pod
   harness = ACP client (run connection) ──▶ goose (127.0.0.1:4001)
   tee on :4000 (ADR 0008) ── normalizes + records ALWAYS ── uplink ▲
```

Key property: **one capture point, one schema, three consumers** (live view, review,
analytics). The Hub needs frame *awareness* for normalization but not a full ACP client
implementation — the only ACP client in the system remains the harness.

### 4.3 What this changes in the current design

| Current (ADR 0008 + #22 contract) | New |
|---|---|
| Hub dials `pod:4000/acp`, swaps hub token for `X-Secret-Key` | Removed. The pod dials *out* to the Hub; the per-run key never needs to be readable by the Hub at all |
| Tee fans out only to attached viewers | Tee records always; uplink is one of its consumers |
| Replay via harness ring + goose `session/load` | Replay from Hub DB; survives pod teardown |
| Hub R2 = dumb byte pipe, stateless | Hub = stateful recorder/broker (amends ADR 0002/0008 rationale) |
| Single-writer enforced pod-side (`kperm-<n>` first-answer-wins) | Stays pod-side for the run connection; Hub enforces one *steering writer* among subscribers |
| Fail-closed HITL timers in harness | **Unchanged and non-negotiable**: if the uplink drops, asks still time out to *deny* pod-side (`HARNESS_HITL_TIMEOUT_SECONDS`) |

### 4.4 Capture topology: harness uplink vs. silent recorder client

Two viable capture topologies exist. This document chooses **A1**, but everything
downstream — schema (§5), persistence (§6), API (§7), analytics (§10) — is
topology-independent, so the choice can be revisited without redesign.

- **A1 — Harness uplink (chosen here)**: the tee normalizes and pushes events
  outbound to the Hub (§4.2).
- **A2 — Silent recorder client (the [#341](https://github.com/konveyor/agentic-controller/issues/341)
  prototype)**: an independent recorder dials the sandbox's tee on `:4000` with the
  run's per-run key (`initialize` + `session/new`), records raw ACP frames plus
  container logs into bucket storage (`transcript.jsonl`, `agent.log`, `meta.json`
  with gaps and status), with controller-owned TTL and pluggable upload destinations.
  Works **without any harness change** — it is a viewer of today's tee.

| Concern | A1 — harness uplink | A2 — silent client (#341) |
|---|---|---|
| Harness change | Required (normalizer + uplink) | **None** — shippable against today's tee |
| Pod reachability | Outbound only; Hub never dials the pod; per-run key never leaves the pod | Recorder must dial the pod (headless service, key discovery via `status.secretKeyRef`) — the mechanism A1 removes |
| Per-connection cost | One outbound stream per run | One always-on viewer connection per run + pod-log follow |
| What it sees | Everything, including HITL asks/answers, steering, and the `skill.loaded`/stage markers only the harness can emit | Only what the tee emits to a viewer; #341's prototype **gates off `approve`-mode/`askUser` runs entirely** (recording must not change fail-fast semantics) — so exactly the HITL runs go unrecorded |
| Storage shape | Normalized events in PostgreSQL (§6) — queryable joins with Hub inventory | Raw frames in bucket/object storage — replay-grade, but analytics need a later normalization pass |
| Ownership | Hub-side recorder | #341 proposes controller-owned capture/upload/retention behind a storage interface, decoupled from tackle2-hub |
| Failure semantics | Hub outage → harness buffers, resumes by cursor | Recorder reconnect via `meta.json` gaps |

**Convergence path**: adopt #341's recording-store concepts — per-run directories,
`meta.json` gap tracking, TTL/retention ownership, the never-alter-fail-fast gate, and
pod-log capture — regardless of topology. The open question for an upstream ADR is the
capture vantage: if the tee gains `skill.loaded` markers and normalized emission (our
§5), A2 loses its main drawback (no harness change) becomes less decisive, and A1's
"no pod dial, no key exposure, HITL runs recorded" properties favor it. A pragmatic
landing: A2 first (works today), A1 as the follow-up that replaces dialing with the
outbound uplink and adds the harness-only events.

## 5. Event schema

Normalized at capture time (in the harness tee) into an append-only, `seq`-ordered log.
One event = one row. Raw vendor frames are kept optionally (sampled, short retention)
for debugging normalizer drift; normalized events are the primary record.

```jsonc
// run lifecycle (harness synthetic frames — already emitted today)
{ "seq": 1, "t": "2026-11-16T10:02:11Z", "run": "jdk17-run-42", "stage": "execute",
  "type": "run.started", "agent": "jdk17-migrate-agent", "workflow": "openjdk8-to-17" }

// tool usage — from ACP session/update tool_call / tool_call_update
{ "seq": 37, "type": "tool.started",  "tool": "edit_file", "kind": "edit",
  "callId": "tc_0192", "input": { "path": "src/main/java/.../Order.java" } }
{ "seq": 41, "type": "tool.finished", "callId": "tc_0192", "status": "completed",
  "durationMs": 1840, "outputSummary": "+34 -12 lines" }

// HITL — from session/request_permission + reply
{ "seq": 52, "type": "permission.requested", "callId": "tc_0201", "kind": "edit",
  "path": "pom.xml" }
{ "seq": 55, "type": "permission.granted", "callId": "tc_0201", "by": "user:admin",
  "latencyMs": 41200, "channel": "console" }   // or denied / timeout / harness-fail-closed

// token usage — goose _goose/unstable usage_update today; _konveyor/usage extension
// and gateway metering later (see §9)
{ "seq": 63, "type": "usage", "turnId": "turn-7", "model": "claude-sonnet-4-5",
  "inputTokens": 18432, "cachedInputTokens": 12004, "outputTokens": 812,
  "reasoningTokens": 340, "costUsd": null }     // cost enriched Hub-side

// skills — the one thing ACP cannot know; the harness assembles the prompt (ADR 0014),
// so only it can emit these markers
{ "seq": 5,  "type": "skill.loaded", "skill": "javaee-to-quarkus", "version": "0.0.1",
  "skillcard": "javaee-to-quarkus" }

// steering / interactivity — viewer-initiated writes relayed through the tee
{ "seq": 71, "type": "steer", "by": "user:admin", "summary": "focus on pom.xml first" }
```

Event types: `run.started`, `run.stage.started`, `run.stage.finished`, `run.finished`,
`message.chunk`, `tool.started`, `tool.finished`, `permission.requested`,
`permission.granted`, `permission.denied`, `steer`, `usage`, `skill.loaded`,
`error`. `schemaVersion` on every event; unknown types are stored, not rejected
(forward compatibility).

**Attribution rules**: tool usage is attributable directly from ACP. Token-to-skill
attribution is *not* possible from ACP — the `skill.loaded` markers and stage boundaries
emitted by the harness are the join key. This is why capture stays in the harness even
with the Hub as recorder.

## 6. Persistence design (PostgreSQL)

The Hub's existing PostgreSQL instance; no new datastore (rationale: scale is ~10⁴–10⁵
events / few MB per run, GBs per portfolio; the query pattern is per-run point lookups
*and* joins against Hub inventory — applications, runs, skillcards, gateways — which
only a co-located relational store provides; disconnected clusters already operate this
PostgreSQL via the operator).

```sql
-- append-only, idempotent ingest (ON CONFLICT DO NOTHING)
CREATE TABLE run_events (
  run_id    TEXT        NOT NULL,
  seq       BIGINT      NOT NULL,           -- harness-assigned, gap-detectable
  stage     TEXT,
  type      TEXT        NOT NULL,
  ts        TIMESTAMPTZ NOT NULL,
  schema_v  INT         NOT NULL DEFAULT 1,
  payload   JSONB       NOT NULL,
  PRIMARY KEY (run_id, seq)
) PARTITION BY RANGE (ts);                   -- monthly partitions → cheap retention

CREATE INDEX ON run_events (ts);
CREATE INDEX ON run_events (type, ts);
CREATE INDEX ON run_events USING GIN (payload jsonb_path_ops);

-- derived at run completion; kept forever; the analytics surface
CREATE TABLE run_usage_rollups (
  run_id TEXT NOT NULL, stage TEXT NOT NULL, model TEXT NOT NULL,
  input_tokens BIGINT NOT NULL DEFAULT 0,
  cached_input_tokens BIGINT NOT NULL DEFAULT 0,
  output_tokens BIGINT NOT NULL DEFAULT 0,
  reasoning_tokens BIGINT NOT NULL DEFAULT 0,
  tool_calls INT NOT NULL DEFAULT 0,
  tool_failures INT NOT NULL DEFAULT 0,
  permissions_asked INT NOT NULL DEFAULT 0,
  permissions_denied INT NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12,4),
  PRIMARY KEY (run_id, stage, model)
);
```

- **Append-only**: insert-only, never updated — required for audit value.
- **Idempotent replay**: `ON CONFLICT (run_id, seq) DO NOTHING` makes the harness's
  cursor-based reconnect safe for free.
- **Retention**: full events for N months (default 6; monthly partitions dropped);
  rollups forever; optional per-run "audit bundle" (JSONL export) as an artifact for
  runs that must be reviewable long-term. Deliberately *not* committed to the
  migration branch.
- **Cost enrichment**: `costUsd` is filled Hub-side by joining `model` with a pricing
  table keyed by the Gateway's resolved provider/model — the Hub is the only layer that
  knows it.

## 7. API design

| Route | Direction | Purpose |
|---|---|---|
| `WS /agent/agentruns/:name/uplink` | pod → Hub | Harness uplink. Auth: scoped harness hub token (already Secret-mounted). Frames: normalized events, duplex write-back for permission answers/steering. Resume via `?since=<seq>` |
| `POST /agent/agentruns/:name/events:batch` | pod → Hub | Fallback flush for buffered events if WS unavailable (same auth) |
| `WS /agent/agentruns/:name/stream` | browser → Hub | Live view + replay-on-connect for UI subscribers. Auth: existing single-use nonce carrier (browsers cannot set `Authorization` on upgrade). Read-only |
| `GET /agent/agentruns/:name/events?since=<seq>&types=` | browser → Hub | Retrospective replay / pagination |
| `GET /agent/agentruns/:name/usage` | browser → Hub | Rollup aggregate for the run |
| `GET /agent/usage?application=&skillcard=&model=&from=&to=` | browser → Hub | Cross-run analytics |

RBAC: read scopes follow the existing architect/migrator scoping; a new write scope for
ingestion; steering writes additionally gated by the existing
`AGENTIC_STEER_ENABLED` posture.

## 8. Component changes

### 8.1 Harness (in-pod entry point) — the only capture change

- Tee (ADR 0008) records the run connection **always**, not only for attached viewers.
- Normalizes frames → event schema (§5); assigns monotonic `seq`; buffers with a
  bounded ring (e.g. last 24 h or 50 MB, spill to workspace disk).
- Starts the uplink at workspace prep; reconnects with `since=<seq>`; flushes the tail
  via the batch endpoint before the final git push / completion report.
- Emits the ACP-invisible events: stage boundaries, `skill.loaded` markers (it assembles
  the prompt), run outcome.
- **Unchanged**: fail-closed permission timers, git lifecycle, playbook stage
  execution, run-driving ACP client role.

### 8.2 Hub (tackle2-hub) — becomes stateful (the main lift)

- Session registry: accept one uplink per active run; fan out to N UI subscribers;
  per-subscriber cursors.
- Ingestion + persistence (§6); normalizer versioning; cost enrichment.
- Serving: stream/replay/aggregates (§7).
- **HA**: uplinks pin to one replica; subscribers on other replicas need internal
  pub/sub (or sticky routing via the existing OpenShift router). This is the largest
  new piece of machinery and the main operational delta vs. the stateless Hub.
- Graceful degradation: Hub outage must never stall a running agent — the harness
  buffers and resumes (batch runs lose nothing; interactive HITL fails closed pod-side
  as today).

### 8.3 Controller — unchanged

Stays a stateless reconciler outside ACP (ADR 0002). Optional later: a short usage
summary on AgentRun `status` for `kubectl` visibility, sourced from the Hub or the
completion report — not from etcd event storage.

> Under the alternative A2 topology (§4.4, #341), capture/upload/retention move
> controller-side behind a storage interface instead; §6/§7 then become downstream
> consumers of the recording store rather than of a harness uplink.

### 8.4 Console (tackle2-ui)

- Live session panel switches its transport to `WS /agent/agentruns/:name/stream`
  (rendering logic unchanged — same normalized `session/update`-derived events).
- Run detail gains a **review mode**: scrub through the stored stream — transcript,
  tool-call timeline (kind/status/duration as a Gantt strip), permission round-trips
  with diffs, per-turn usage curve. Same code path as the live view, sourced from the
  replay API.
- New analytics views over the aggregate API: tokens/cost per run/stage/application,
  tool reliability table, permission friction, skill-version comparison.

### 8.5 Records to amend

- ADR 0002 (clients use the pod endpoint) — superseded for the observability path.
- ADR 0008 (tee topology) — tee survives, gains uplink; Hub-facing viewer dial retired.
- Client contract #22, R2 section — "the one thing browsers can't do" rationale
  dissolves when the pod dials out.

## 9. Token-usage sourcing (three-stage maturity)

1. **Today (goose only)**: tee the `_goose/unstable/session/update` `usage_update`
   frames (already enabled via the `customNotifications` capability). Treat as
   best-effort; the channel is unstable and Konveyor pins a goose fork. Upstream
   [#282](https://github.com/konveyor/agentic-controller/issues/282) (ADR 0021)
   proposes the adjacent stopgap — a run-level `usage` object in the harness
   `terminationData` contract surfaced as `status.usage` — which this schema's
   `usage` events should ingest as their run-level fallback.
2. **Next**: a `_konveyor/usage` extension notification with a normalized shape
   (turn-scoped input/cached/reasoning/output tokens, model, requestId) emitted at turn
   boundaries; per-agent adapters as more ACP agents (OpenCode, Claude Code, Gemini CLI)
   are supported.
3. **Authoritative**: run-id injection at the Gateway (harness env → request header)
   with metering at the LLM boundary; reconcile gateway counts against agent-reported
   usage — they will disagree (the gateway sees retries and abandoned turns the agent
   may not report). Gateway is authoritative for tokens; ACP is authoritative for what
   the agent *did* with them.

Long term: upstream an ACP RFD for standardized usage reporting — the same argument
that made HITL diff previews work without a protocol extension cuts the other way here;
token usage genuinely needs a protocol addition.

## 10. Analytics (G4)

Measured **per successful outcome, not per run** (raw tokens per run mostly measures
application size):

| Question | Query |
|---|---|
| Token cost per migration | `usage` summed per run/stage/app, priced via model; cached-input ratio shows whether skills keep context stable |
| Which tools dominate cost/latency | tool events by tool/kind: count, duration, token deltas around the call |
| Tool reliability | `tool.finished` status rate per tool — a 40 %-failure tool is a skill-instruction bug (wrong args/order) |
| Skill effectiveness | runs with/without a skillcard, or version A vs B: stage success rate, tokens per successful file migrated, permission friction |
| HITL friction | permission events: count per run, grant latency, denial rate by path/kind |
| Run-away detection | turn counts and usage deltas per prompt; same tool+args repeated with flat diff progress = loop |
| Regression tracking | compare across archetypes and skill/ruleset releases — did the new skill version reduce cost per finding? |

## 11. Implementation phases

| Phase | Content | Delivers |
|---|---|---|
| 1 | Harness: always-on recorder + `skill.loaded`/stage markers + JSONL in workspace; flush in completion report | G1 without any Hub change; immediate post-hoc debugging |
| 2 | Hub: ingestion endpoints + `run_events`/rollups + stream/replay/aggregate APIs + RBAC | G2, G3 (review possible even after workspace loss) |
| 3 | Console: review mode + usage panels | G2/G3 UX |
| 4 | Uplink WS replaces batch flush as primary; live fan-out moves Hub-side; retire the pod-dial R2 path | Full Variant A; single-writer/steering at Hub |
| 5 | Analytics views + skill-version A/B tooling | G4 |
| 6 | `_konveyor/usage` extension; gateway metering + reconciliation; optional ACP RFD | Token-accuracy maturity (§9) |

Phases 1–2 are independently valuable and can land before any console change; phase 4
is the only one that amends the live interactive path. If upstream lands the #341
recorder first (A2, §4.4), phase 1's always-on capture and phase 2's normalized store
remain unchanged — only the capture vantage differs.

## 12. Risks and open questions

- **Hub statefulness/HA** (§8.2): the biggest engineering cost; needs a design spike on
  pub/sub vs. sticky routing vs. accepting single-replica subscriber affinity per run.
- **Uplink failure semantics**: buffer bounds (disk-backed?) for long Hub outages on
  long-running playbook stages; document the discard policy.
- **Event volume control**: `message.chunk` events can dominate; aggregate chunk
  events per turn into `message.completed` in the persisted log (raw chunks stay
  live-only), keeping the durable log at tool/turn/decision granularity.
- **Multi-tenancy**: event payloads may contain code snippets; read scopes must respect
  application ownership.
- **Schema governance**: `schemaVersion` + forward-compatible readers; who owns the
  normalized schema (Hub team vs. controller team) needs an explicit ADR.
- **goose fork coupling**: usage fields come from the pinned fork's unstable channel
  until stage 6 of §9.

## 13. Related upstream proposals

This is not a green-field proposal; three open upstream threads cover overlapping
ground. This document's positioning: **schema, relational persistence, skill
attribution, and analytics are the novel contributions — capture topology, retention
semantics, and run-level usage reporting should converge with the existing threads.**

| Upstream item | State | Overlap | What it lacks (this document adds) |
|---|---|---|---|
| [agentic-controller #341](https://github.com/konveyor/agentic-controller/issues/341) — persist and visualize AgentRun transcripts and pod logs | Open RFE **with a working prototype** (MigTools hub/UI forks, deployed on a live cluster) | G1/G2: always-on recording store (per-run directory, `transcript.jsonl`, `meta.json` with gaps, TTL, pluggable bucket upload), UI visualization | Normalized/queryable events (raw frames only); no token/tool accounting; analytics; `skill.loaded` attribution; **records no `approve`-mode/`askUser` runs** — exactly the HITL interactions of interest |
| [agentic-controller #192](https://github.com/konveyor/agentic-controller/issues/192) — agent usage accounting, activity telemetry, runaway-run containment | Open, `ready-for-human` research thread (Sept 2026 design discussion) | G3/G4: harness-side OTel reporting, service-owned durable history, independent accounting API, 30-day retention, best-effort delivery, async export, containment | Normalized event log unifying usage with tool/HITL/skill events; relational analytics (§10); skill attribution; convergence with transcript persistence |
| [agentic-controller #282](https://github.com/konveyor/agentic-controller/issues/282) — ADR 0021: usage telemetry on AgentRun/AgentWorkflowRun | Open, proposed/deferred ADR | §9 stage 1: harness `usage` object → `status.usage`, per-stage console display, peak context, compactions | Per-turn usage (explicitly out of scope there), cache tokens, gateway pricing, skill attribution, cross-run analytics |

Adjacent: the [llm-proxy enhancement](https://github.com/konveyor/enhancements/blob/main/enhancements/llm-proxy/README.md)
defers usage dashboards to "later" (its Gateway is the metering point for §9 stage 3),
and [editor-extensions #540](https://github.com/konveyor/editor-extensions/issues/540)
targets IDE-side token display.

**Recommended convergence**: take #341's recording-store and retention/gate semantics,
#192's delivery/retention/export contract (and its containment scope, which this
document deliberately excludes), and #282's usage contract as inputs; contribute this
document's normalized schema, PostgreSQL store, and analytics layer as the shared
downstream that all three currently lack. The capture-vantage decision (A1 vs. A2,
§4.4) should be settled in an upstream ADR together with #341's reviewers.
