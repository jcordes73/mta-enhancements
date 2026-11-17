---
title: sarif-and-cyclonedx-export
authors:
  - "@jcordes73"
reviewers:
  - "@jortel"
  - "@shawn-hurley"
approvers:
  - "@savitharaghunathan"
creation-date: 2026-11-09
last-updated: 2026-11-09
status: provisional
see-also:
  - "/proposals/deterministic-analyses-and-incident-identity.md"
replaces: []
superseded-by: []
---

# SARIF and CycloneDX Export

## Release Signoff Checklist

- [ ] Enhancement is `implementable`
- [ ] Design details are appropriately documented from clear requirements
- [ ] Test plan is defined
- [ ] User-facing documentation is created

## Open Questions

> 1. SARIF `level` mapping: MTA incidents carry a category (mandatory,
>    potential, optional) and an effort, but no severity that maps cleanly
>    onto SARIF's `error`/`warning`/`note`. Proposed: mandatory → `error`,
>    potential → `warning`, optional → `note`, with the full mapping
>    documented as part of the contract. Reviewers with code-scanning
>    consumer experience should confirm this does not create alert fatigue.
> 2. CycloneDX `scope`: the dependency inventory distinguishes direct from
>    indirect dependencies (verified in the API), but CycloneDX's `scope`
>    enum (`required`/`optional`/`excluded`) means "presence in the
>    distribution," not reachability. Proposed: record direct/indirect in
>    `properties["konveyor/direct"]` and leave `scope` at the default
>    `required`, rather than overloading `optional`. Is the property
>    extension acceptable to consumers, or should direct dependencies be
>    `required` and transitive ones also `required` with the graph deferred?
> 3. Where the serializers live: `tackle2-hub/shared` with kantra importing
>    the module, or a dedicated `konveyor/exporters` repository consumable
>    from both. The Hub and kantra are both Go today, which makes the shared
>    module the low-ceremony option; a separate repo is cleaner if a
>    non-Go consumer (IDE) ever needs the mapping.

## Summary

MTA's analysis output — the incident list, the dependency inventory, the
effort totals — is locked inside MTA-specific formats: the Hub's JSON API,
CSV downloads, and the static report's HTML. Every integration with the
wider tooling ecosystem therefore requires a bespoke parser: security
dashboards, CI policy gates, migration trackers, and data warehouses each
hand-roll conversion from MTA's shapes, and each conversion drifts as the
API evolves. Meanwhile the industry already standardized exactly these two
artifacts: SARIF 2.1.0 for static-analysis findings (natively consumed by
GitHub Code Scanning, Azure DevOps, and most security tooling) and
CycloneDX for software bills of materials (consumed by vulnerability
scanners and compliance processes, and increasingly a regulatory
expectation).

This enhancement adds standards-based export as a first-class output:
`GET /analyses/{id}/export/sarif` renders an analysis's incidents as a
SARIF 2.1.0 log with full rule metadata; `GET /applications/{id}/export/cyclonedx`
renders the dependency inventory as a CycloneDX 1.5 SBOM. Both are also
available from the CLI (`kantra`) and from the Hub UI next to the existing
CSV export. The mappings are validated in CI against the published schemas
and smoke-tested against real consumers, and the mappings themselves are
documented as a versioned contract — making these exporters the first
concrete boundary of the API-contract discipline this proposal ships
alongside. Nothing equivalent is filed upstream today; these exporters are
the ecosystem-facing face of the analysis data the deterministic-analyses
enhancement makes trustworthy.

## Motivation

The Hub's machine-readable output today is CSV (gated by the verified
`download.csv.enabled` setting) and the Hub JSON API itself — both
MTA-specific. Teams working 100+ application portfolios already run
security dashboards and SBOM pipelines: Red Hat's own Dependency Analytics
story generates CycloneDX SBOMs for actively developed applications, and
the EU Cyber Resilience Act makes SBOM availability a near-term compliance
requirement for shipped software. Migration analysis — arguably the moment
an application's dependency inventory and risk profile matter most — sits
outside all of it. The same is true on the findings side: a SARIF file
uploads directly into GitHub Code Scanning, where migration issues would
appear in the same triage surface as code-scanning alerts, with rules,
locations, and fingerprints already understood by the consumer.

Suggestion evidence from large deployments describes manually copying
figures from HTML reports into spreadsheets as the integration path of
record. The agentic workflows sharpen the need: kai and the IDE consume
structured findings, and SARIF is the one findings format every tool in
that chain already speaks. Searches of Red Hat MTA JIRA and the Konveyor
GitHub organizations found no existing work on SARIF or CycloneDX export —
this is genuinely unfiled territory, and the mappings are straightforward
because the underlying data (rule IDs, file paths, line numbers, GAV
coordinates, direct/indirect scope) already exists in the model.

### Goals

- SARIF 2.1.0 export of an analysis's incidents: every incident as a
  `result`, every loaded rule as a `tool.driver.rules` entry with
  `id = ruleset/rule`, effort and category preserved in
  `properties["konveyor/…"]`, and the incident identity key (from the
  deterministic-analyses enhancement) as the SARIF `partialFingerprints`
  value so consumers can deduplicate across runs the same way MTA does.
- CycloneDX 1.5 export of an application's dependency inventory: one
  `component` per dependency with `purl`, version, and the direct/indirect
  distinction preserved; the application itself as `metadata.component`.
- Both exports from all three surfaces: Hub API, Hub UI export menu, and
  `kantra` CLI.
- CI validation against the published SARIF and CycloneDX JSON schemas plus
  consumer smoke tests (GitHub code-scanning ingest, `cyclonedx-cli
  validate`).
- The field mappings documented and versioned as a contract, per the
  open-standards discipline (Suggestion 18's item 1).
- Feature-flagged rollout following the existing settings pattern
  (`export.sarif.enabled`, `export.cyclonedx.enabled`, mirroring the
  verified `download.csv.enabled`).

### Non-Goals

- SARIF *ingestion* — importing third-party scanner results into MTA is a
  separate, unscheduled idea.
- A full dependency graph in CycloneDX v1 (the `dependencies` tree with
  `dependsOn` relationships); v1 ships the flat component list the
  inventory already supports, with the graph as a follow-up.
- SPDX output (CycloneDX first for tooling adoption; SPDX is a candidate
  follow-up, see Alternatives).
- Vulnerability enrichment of the SBOM (the RHDA/Trusted Profile Analyzer
  integration, Suggestion 22, is where CVE data comes from — the export
  carries what analysis collected).
- Changing the internal data model to accommodate export; the mappings
  adapt output to the standards, not the reverse.
- Export of assessment/questionnaire data (no standard equivalent; custom
  JSON/CSV remains the fallback per Suggestion 12's item 4).

## Proposal

### User Stories

#### Story 1: Security engineer triages migration issues in code scanning

As a security engineer, I add one CI step after `kantra analyze`: upload the
SARIF file to GitHub Code Scanning. Migration findings now appear alongside
code-scanning alerts, filtered and dismissed with the same machinery, with
rule descriptions and source locations intact. No custom parser was
written, and none will drift.

#### Story 2: Compliance officer produces SBOMs for the audit

As a compliance officer preparing for the Cyber Resilience Act, I fetch
`GET /applications/{id}/export/cyclonedx` per application per analysis run
and archive the files with the run's toolchain manifest. Each artifact
records exactly which dependency inventory was known at analysis time.

#### Story 3: CI gates on new migration findings

As a CI operator, my pipeline diffs the SARIF export of the analysis of a
pull request's branch against main's export using standard SARIF tooling.
New mandatory-category incidents fail the build — a policy gate built on
the format the scanner ecosystem already diffs, not on MTA-specific JSON.

#### Story 4: Consultant builds an exec dashboard without reverse-engineering MTA

As a consultant, my reporting tool ingests SARIF (findings, effort in
properties) and CycloneDX (inventory) — formats my tooling already parses —
instead of scraping the static report or hand-parsing Hub JSON with a
parser that breaks on every Hub upgrade.

#### Story 5: Offline pipeline gets standards output from the CLI

As a developer in an air-gapped environment, `kantra analyze
--export-sarif` writes the SARIF file next to `report.yaml`, produced by
the same mapping the Hub uses, so local and Hub results integrate
identically.

### Implementation Details/Notes/Constraints

**1. SARIF mapping.** `GET /analyses/{id}/export/sarif` produces SARIF
2.1.0 JSON:

| SARIF element | MTA source |
|---|---|
| `runs[].tool.driver.name` | `Konveyor MTA` |
| `runs[].tool.driver.rules[]` | loaded rulesets/rules; `id = ruleset/rule`; `shortDescription.text` = rule description; `helpUri` = rule documentation link |
| `runs[].results[]` | incidents; `ruleId = ruleset/rule`; `message.text` = incident message |
| `results[].level` | category mapping (Open Question 1): mandatory → `error`, potential → `warning`, optional → `note` |
| `results[].locations[].physicalLocation` | `artifactLocation.uri` = normalized repository-relative path (the §8.1 normalization); `region.startLine` = incident line |
| `results[].partialFingerprints["konveyor/identity"]` | incident identity key — consumers deduplicate across runs exactly as MTA's carry-over does |
| `results[].properties` | `"konveyor/effort"`, `"konveyor/category"`, `"konveyor/labels"` |

Constraints: URIs are repository-relative and case-preserved (no absolute
paths, no workspace internals); the export contains findings metadata and
code *location* references, not code content. Effort survives only in
`properties` — SARIF has no effort concept, and consumers that ignore
custom properties will simply not see it (an accepted, documented loss).

**2. CycloneDX mapping.** `GET /applications/{id}/export/cyclonedx`
produces CycloneDX 1.5 JSON: `specVersion: "1.5"`;
`metadata.component` = the application (type `application`, name, version
if known); `components[]` = one entry per collected dependency with
`type: "library"`, `name`, `version`, `purl` (constructed from the GAV
coordinates the dependency inventory already carries — the API's
version/indirect fields are verified), `scope` per Open Question 2, and
`properties["konveyor/direct"]` preserving direct vs. indirect. The
`dependencies` graph is out of scope for v1 (Non-Goal).

**3. Serialization home and streaming.** Both serializers live in Go next
to the Hub's data model (`tackle2-hub/shared` per Open Question 3), so the
Hub endpoints and kantra use the same mapping. Serialization is streaming:
the export non-functional target is ≤ 5 s for a 10,000-incident SARIF and
≤ 2 s for a 5,000-dependency CycloneDX (load-tested nightly, see Test
Plan).

**4. CLI.** `kantra analyze --export-sarif` (and the CycloneDX equivalent)
fetch/produce the file locally from the analysis result using the shared
serializer, writing alongside the existing report artifacts.

**5. UI.** The Hub UI's existing export affordance (currently CSV) gains
SARIF and CycloneDX entries, shown when the corresponding settings flag is
enabled — the exact mechanism the verified `download.csv.enabled` setting
uses today, extended with `export.sarif.enabled` /
`export.cyclonedx.enabled` (default off, flipped on after one release per
the rollout rule).

**6. Contract discipline.** The mappings are documented in the OpenAPI
spec (export endpoints with example payloads) and in a short mapping
reference; a change to any mapping field is a contract change subject to
the deprecation policy — this exporter pair is deliberately the first
concrete instantiation of the standards-boundary rule this program proposes
under Suggestion 18, and the two are filed together.

**Repo impact.** `tackle2-hub` (endpoints, serializers, settings flags,
OpenAPI) is primary; `kantra` (flags, local export); `tackle2-ui` (export
menu entries); CI (schema validation job). No data-model changes.

### Security, Risks, and Mitigations

- **Exports reveal effort and risk metadata.** Export authorization rides
  the existing analysis-read scopes — an export is a read of analysis data
  in a different serialization, not a new privilege. No new scopes.
- **Path disclosure.** SARIF `artifactLocation.uri` contains
  repository-relative paths only; absolute paths, workspace prefixes, and
  credentials-bearing URLs are excluded by the shared normalization. No
  source code, secrets, or transcript content appears in either format —
  the payload is metadata by construction, which also keeps the exports
  safe to attach to tickets and archive in compliance stores.
- **SBOM sensitivity.** A dependency inventory is itself sensitive in some
  organizations (it reveals the stack); CycloneDX export is therefore
  gated by the same scopes as dependency reads, not treated as public.
- **Standards drift.** SARIF and CycloneDX evolve; the proposal pins
  SARIF 2.1.0 and CycloneDX 1.5, validates in CI against the published
  schemas, and treats a spec-version bump as a contract change with a
  deprecation window, not a silent swap.
- **Alert fatigue (Open Question 1).** A wrong `level` mapping floods code
  scanning with errors; mitigated by the documented mapping, reviewer
  sign-off from consumer-experienced maintainers, and the feature flag
  allowing per-deployment opt-out.

## Design Details

### Test Plan

- **Unit:** mapping tables exhaustively — every incident field's SARIF
  destination and every dependency field's CycloneDX destination;
  purl construction from GAV (including edge cases: versions with
  metadata, classifiers); normalization applied to URIs; identity key
  present in `partialFingerprints`; empty and partial analyses (an
  analysis that completed with errors exports what exists, with the
  errors reflected — an export never fabricates a clean run).
- **Schema validation (CI, blocking):** every exported document validated
  against the published SARIF 2.1.0 and CycloneDX 1.5 JSON schemas on the
  fixture corpus.
- **Consumer smoke tests (CI):** SARIF ingested by GitHub code scanning
  (or the official `sarif` validator as the hermetic fallback) with rules
  and fingerprints visible; CycloneDX validated by `cyclonedx-cli
  validate`.
- **NFR load test (nightly):** 10,000-incident SARIF ≤ 5 s; 5,000-
  dependency CycloneDX ≤ 2 s (streaming verified — no OOM at 10×).
- **E2E:** Hub export → UI menu shows entries when flags on → CLI local
  export byte-equal (modulo timestamps) to Hub export for the same
  analysis; round-trip count check — SARIF `results` length equals the
  analysis incident count.

Tricky cases called out: incidents without a line number (region omitted
per SARIF rules); duplicate incidents from provider overlap (each exported
— SARIF consumers deduplicate via fingerprints, matching MTA's own
carry-over semantics); Windows-normalized paths.

### Upgrade / Downgrade Strategy

- **Upgrade:** purely additive — two new endpoints, two settings flags
  (default off), CLI flags, UI menu entries. No schema or data migration.
  The OpenAPI spec gains the endpoints and examples in the same PR.
- **Downgrade:** older Hub versions lack the endpoints (clean 404); older
  kantra ignores the new flags. No state is created by exporting, so
  downgrade is trivially safe.
- **Version skew:** a UI newer than its Hub shows no export entries
  (setting absent) rather than broken links; CLI and Hub serializer
  version skew is covered by the shared-module contract tests.

## Implementation History

- 2026-11-09: proposed (provisional). Grounded in Suggestion 12 of the
  companion suggestions document and verified Hub-API facts (CSV-only
  export via `download.csv.enabled`, dependency inventory with
  version/indirect fields). Companion to
  `deterministic-analyses-and-incident-identity.md` (identity key reused
  as SARIF fingerprints). JIRA and GitHub searches found no prior SARIF/
  CycloneDX export work in the Konveyor org or MTA project.
- 2026-11-09: filing status — **new filing**; the empty-search result is
  itself the novelty evidence and should lead the PR description.

## Drawbacks

- **Two more serialization surfaces to keep correct.** Every mapping field
  is a place for subtle loss (effort survives only as a custom property;
  categories map onto a three-level severity that does not really fit).
- **The mapping freezes.** Once external tooling depends on
  `properties["konveyor/effort"]`, renaming or restructuring it is a
  breaking contract change — the cost of being a good ecosystem citizen,
  paid in flexibility.
- **Standards evolve faster than MTA releases.** SARIF and CycloneDX move
  independently of the MTA train; pinning versions and deferring bumps
  means shipping slightly stale standards for a release at a time.
- **v1 SBOM is flat.** A CycloneDX file without the `dependencies` graph
  satisfies schema validators and most scanners but understates the
  structure for consumers expecting a tree; this must be documented to
  avoid compliance teams over-trusting it.

## Alternatives

- **Client-side converters** (each consumer transforms Hub JSON/CSV into
  SARIF/CycloneDX itself). Rejected: it recreates the bespoke-parser
  problem the standards exist to remove — N consumers, N mappings, N
  drifts, no shared tests — and every consumer needs the incident identity
  to deduplicate correctly, which only the Hub computes.
- **Status quo (CSV/HTML only).** Rejected by the evidence: manual
  spreadsheet copying is the documented workaround, and the agentic chain
  needs structured input CSV cannot carry.
- **SPDX instead of (or before) CycloneDX.** Viable and possibly mandated
  by some compliance regimes; deferred as a follow-up exporter because
  CycloneDX's tooling adoption (scanners, `cyclonedx-cli`, GitHub
  ecosystem) is broader today, and the serializer architecture makes a
  second format additive. Recorded here so the choice is revisitable.
- **Export from the static-report pipeline** (`analyzer-output-parser`).
  Rejected: the static report is a separate rendering path from Hub data;
  exporting there would fork the mapping from the API export and inherit
  the report path's known data-loss cases (MTA-5643, MTA-5730, MTA-5939).
- **Bespoke MTA JSON as *the* export** (document the existing API as the
  contract and stop). Rejected: it asks every external tool to learn
  MTA's vocabulary; the point of the standards is that the vocabulary
  already exists on the consuming side.

## Infrastructure Needed

- A **schema-validation CI job** in `tackle2-hub` (and kantra) fetching or
  vendoring the published SARIF/CycloneDX schemas; no new repositories or
  services. The consumer smoke tests need one CI credential for a GitHub
  code-scanning ingest (or run the hermetic validator-only fallback).
