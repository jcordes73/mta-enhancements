# Socialization scripts — for the five enhancement proposals

*Companion to the five proposals in `proposals/`. Each script has a
30-second elevator version (Slack / hallway / PR description opener) and a
5-minute meeting version (SIG slot). Venues and audiences follow §18.2 of
the design document. Every script ends with an explicit ask — the decision
or commitment the conversation must produce.*

**Shared program context** (30 seconds, use once per audience): We work a
100+ application Java-EE migration portfolio on MTA/Konveyor, in every role.
We audited MTA 8.3.3 end to end, filed our findings as 53 suggestions and a
design program, and distilled five enhancement proposals that are ready for
`provisional` filing — four of them cover territory that JIRA and GitHub
searches show nobody has filed. Together they are ≈ 50 engineer-weeks, and
they all queue behind the same reviewers, which is why we are socializing
before filing.

---

## Proposal ① — Deterministic analyses and incident identity

**Venue:** Analyzers SIG · **People:** `@shawn-hurley`, kai maintainers ·
**Full proposal:** `proposals/deterministic-analyses-and-incident-identity.md`

### Elevator (30 s)

Re-running the same analysis on the same app with the same config produces
different numbers. Red Hat's own JIRA proves it — including Hub-vs-IDE
divergence on a synced profile (MTA-7445) — and editor-extensions#1482 has
an analysis assertion failing *silently since July* because nothing
distinguishes drift from change. We propose digest-pinned toolchain
manifests, deterministic ordering, a stable incident identity key, a
`--strict` mode, and a nightly double-run release gate. Without the
identity key, triage, diffing, and effort deltas are all impossible. It's
the keystone of the program, and we need two design decisions from this
room.

### Meeting version (5 min)

**The evidence.** MTA-5170: effort counts vary between runs on the same
Node.js app. MTA-5179: different rules fire between MTA versions on the
same app. MTA-7445: *different rules fire between Hub and IDE with the same
synced profile* — the cross-surface case. editor-extensions#1482: an
assertion failing since July 2025 because no gate catches it. Every one of
these erodes trust in the numbers that migrations are planned on.

**The proposal.** Four parts. (1) Every analysis records a toolchain
manifest — analyzer image *digest* (tags resolved at task creation), rule
bundle digests, provider versions, effective-settings fingerprint — rendered
in Hub, CLI, and static report. Pre-manifest analyses render as
"pre-determinism runs", no backfill. (2) analyzer-lsp emits incidents in a
defined sort order with no timestamps or UUIDs in payloads. (3) Every
incident gets an identity key — `sha256(rule | normalized path | line |
snippet hash)` — with exact/fuzzy/re-ask triage carry-over tiers.
(4) `--strict` fails instead of silently degrading, and a nightly
double-run harness requires seven consecutive zero-diff nights before a
release.

**Why now.** Everything else in our program — triage carry-over, run diff,
effort deltas — consumes the identity function. And the fix is mostly
discipline, not novelty: digest pinning, sorting, a hash.

**The ask.** Two decisions: (a) does `line` participate in the *exact*
identity key or only the fuzzy tier — and with it, where the identity
function lives (hub-owned and mirrored in kai, vs. emitted by
analyzer-lsp)? (b) Reviewer commitment from `@shawn-hurley` and the kai
side, because the kai incident-storage model must agree with this key.

---

## Proposal ② — Triage store and run comparison

**Venue:** Core SIG · **People:** `@jortel`, plus `@fabianvf` and
`@abrugaro` (#279) · **Full proposal:**
`proposals/triage-store-and-run-comparison.md`

### Elevator (30 s)

Analysis results are GET-only. When your team marks something false
positive, that decision lives nowhere — it doesn't sync to the IDE, doesn't
survive re-analysis, and doesn't reach kai. So every analysis cycle, the
same CVEs and false positives get re-litigated. We propose a durable,
auditable triage store in the Hub keyed by stable incident identity, plus a
server-side run-diff endpoint. It's the write surface the analysis API has
never had — and it's a complement to #279, not a competitor: #279 stages
solved examples for kai; we store portfolio decisions in the Hub.

### Meeting version (5 min)

**The evidence.** The 143-path OpenAPI spec has no triage write anywhere.
Recurring false-positive reports (MTA-8244, Verified, plus four siblings)
and MTA-5973 — users triaging dependency-driven findings with nowhere to
record it. Run comparison is done in spreadsheets, from static reports,
per run, per person.

**The proposal.** A `triage` table keyed by the incident identity key from
proposal ①, with five states, comments, author, and a full history table.
Carry-over across re-analyses: exact matches carry silently, fuzzy matches
(line drift ≤ 10) carry flagged for re-confirmation, weaker matches are
offered, never auto-applied. Four endpoints, one new scope
(`triage:write`), and a diff endpoint returning added/resolved/changed,
effort delta, and carry-over summary. One mechanism for every surface:
Hub UI, static report, and IDE through the kai MCP solution server — not
three divergent stores.

**Why now — and the #279 relationship.** #279 stages solved examples for
kai's fix generation; we store triage as portfolio data the Hub owns. Both
consume the same identity key and the same MCP surface. Triaged
false positives are exactly what kai should stop re-suggesting — our store
is upstream of that. We deliberately did *not* put triage in the solution
server: it must outlive any AI component, be reportable without the AI
stack, and respect Hub RBAC.

**The ask.** Three: (a) agreement from `@fabianvf` and `@abrugaro` that
this is a complement to #279; (b) closure of the authorization model —
`triage:write` scope plus a business-service membership rule for
non-admins; (c) reviewer commitment from `@jortel`. ≈ 12.5 engineer-weeks,
the largest proposal in the set.

---

## Proposal ③ — SARIF and CycloneDX export

**Venue:** Analyzers + Core SIGs · **People:** `@jortel`,
`@shawn-hurley` · **Full proposal:**
`proposals/sarif-and-cyclonedx-export.md`

### Elevator (30 s)

MTA's findings speak MTA; every security dashboard, CI gate, and compliance
pipeline speaks SARIF and CycloneDX. Today the bridge is a bespoke parser
per consumer, each one drifting. We propose two export endpoints —
`/export/sarif` and `/export/cyclonedx` — plus CLI flags and a UI menu,
validated in CI against the published schemas and smoke-tested against real
consumers. Nothing filed upstream exists. It's the smallest proposal in the
program — about five engineer-weeks — and the easiest yes.

### Meeting version (5 min)

**The evidence.** Machine-readable output today is CSV behind a settings
flag and the Hub JSON API — both MTA-specific. Teams copy figures from HTML
reports into spreadsheets. The dependency inventory already carries GAV
coordinates and direct/indirect flags — a CycloneDX SBOM is a mapping, not
a project. And the Cyber Resilience Act era makes "SBOM per shipped
application" a near-term compliance expectation; Red Hat's own RHDA
already generates CycloneDX for actively developed apps.

**The proposal.** SARIF 2.1.0: incidents as `results`, rules as
`tool.driver.rules` with `id = ruleset/rule`, effort and category in
`properties["konveyor/…"]` — and the incident identity key from proposal ① as
the SARIF `partialFingerprints` value, so GitHub code scanning deduplicates
across runs *exactly the way MTA's triage carry-over does*. CycloneDX 1.5:
one component per dependency with purl, the application as
`metadata.component`. Same serializers from Hub, CLI (`kantra
--export-sarif`), and UI. Schema validation plus consumer smoke tests in CI.

**Why now.** Small, standalone, high ecosystem visibility — the right first
implementation to build review muscle on the program. The only coupling to
proposal ① is the fingerprint, and it's deferrable.

**The ask.** Sign-off on two mapping decisions (SARIF `level` mapping from
category; CycloneDX scope handling for direct/indirect), reviewer
commitment, and agreement that this lands first.

---

## Proposal ④ — Batch, events, and aggregates API

**Venue:** Core SIG · **People:** `@jortel`, tackle2-ui maintainer (TBD) ·
**Full proposal:** `proposals/batch-events-and-aggregates-api.md`

### Elevator (30 s)

The Hub API is shaped for clicks, not automation. Bulk operations exist for
tags and tickets but not analyses — onboarding 100+ applications means 100+
calls. There are no outbound events, so every CI integration polls.
Portfolio rollups are computed client-side, which is why dashboards
disagree with the UI. We propose generalized batch endpoints, HMAC-signed
metadata-only webhooks with a delivery log, and server-side aggregate
endpoints. Same territory: searches show nobody has filed it.

### Meeting version (5 min)

**The evidence.** Verified: `/batch/tags` and `/batch/tickets` are the only
batch endpoints; no webhook or event resource exists in the 143-path spec;
`/tags/{id}/applications` is a 404; the UI's Reports aggregate client-side
because there's no rollup endpoint. The newest upstream work — server-side
filter chips on Runs pages (MTA-7482) — is the community's own first step
in this direction.

**The proposal.** `POST /batch/analyses` (one call, one taskgroup, per-
application results), bulk wave/archetype assignment. A `Webhook` resource
with HMAC-SHA256-signed, timestamped, *metadata-only* payloads, a delivery
log, and manual replay — deliberately the smallest viable webhook system:
one attempt, full audit, SSRF-guarded. `GET /report/effort?groupBy=…` and
`/report/issues?groupBy=…` with a parity acceptance test against the UI
rollup — one definition of "effort by wave", not two. One new scope
(`webhooks:manage`, admin); everything else reuses existing scopes.

**Why now.** Every later wave consumes these: wave planning needs
aggregates, triage needs `triage.changed` events, CI integration needs
events. It's the automation foundation.

**The ask.** The honesty question: v1 ships *at-most-once* delivery
(single attempt + log + replay) — is that an acceptable floor, with
backoff as an additive v2? Plus the batch-cap default (proposed: 100) and
a tackle2-ui reviewer for the webhook admin view. ≈ 10 engineer-weeks.

---

## Proposal ⑤ — Vulnerability and coverage issue types

**Venue:** Core SIG + RHDA/RHTPA team · **People:** `@jortel`, UI + SCA
reviewers (TBD) · **Full proposal:**
`proposals/vulnerability-and-coverage-issue-types.md`

### Elevator (30 s)

Right now, in a stock MTA 8.3, a CVE shows up in analysis results as a
"potential" finding worth 5 story points — counted into migration effort,
with no CVSS, no CVE ID, no fixed-in version, no advisory link anywhere. A
Log4j fix is not a migration story point. We propose a first-class issue
type taxonomy — migration, vulnerability, test debt — with CVEs excluded
from effort totals everywhere, coverage ingestion so reports can say
"19 of the 47 files this wave touches have zero test coverage", and
triage-on-a-CVE doubling as a VEX-style statement via the triage store.

### Meeting version (5 min)

**The evidence.** Observed live in 8.3.3: CVEs arrive through the bundled
`rhda` ruleset as ordinary insights — category "potential", effort 5 each.
The Issues view renders three columns that are meaningless for security
findings (`Source: None`, `Target(s): None`) while severity, CVE ID,
fixed-in, and advisory link appear nowhere; the remediation hint is buried
in a truncated title. And the dependency picture they ride on can be
silently incomplete (we watched an analysis report two dependencies for a
full Jakarta EE app). Meanwhile Red Hat's own RHDA 1.0 and RHTPA 3.x cover
sourcing end to end, including air-gapped.

**The proposal.** A `type` field defaulting to `migration` (existing data
byte-identical), with versioned payload schemas per type: vulnerability
(CVE/OSV ID, CVSS, component purl, fixed-in, advisory, source) and
test-debt (coverage source, covered/uncovered). Migration effort totals
exclude non-migration types — one definition change, parity-tested across
every surface, flagged for one release. Vulnerability identity uses a key
variant (`cve | purl | version`), so triage carry-over works across version
bumps — and a triaged "not affected, justification" on a CVE *is* a VEX
statement, with the triage store's audit trail behind it. Three sourcing
tiers: the existing `rhda` ruleset re-typed (zero-integration floor), an
Exhort addon (the first-party worked example for custom import tasks), and
RHTPA SBOM registration for continuous updates without re-analysis.

**Why now.** The data already arrives; only the semantics are missing.
This is the last unfiled High-impact cluster in our program.

**The ask.** (a) Sign-off that effort-exclusion is the intended behavior
change, release-noted and flagged — the numbers will move and support
should know why; (b) an RHDA/RHTPA-facing reviewer to validate the
sourcing paths; (c) agreement that CycloneDX `vulnerabilities` export
follows as a contract change after the exporters land. ≈ 11 engineer-weeks.

---

## Cross-proposal sequencing note (state in every meeting)

Landing order is `tackle2-hub`-shaped: identity (①) → triage (②) →
aggregates/batch (④) → exports (③, parallel-friendly) → issue types (⑤).
The program needs roughly 3–4 calendar months with a 3–4 person team, and
the reviewers being socialized here are the same small group for all five —
which is why we're asking for decisions in one round rather than five.
