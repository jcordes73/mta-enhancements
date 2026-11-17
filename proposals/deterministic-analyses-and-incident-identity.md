---
title: deterministic-analyses-and-incident-identity
authors:
  - "@jcordes73"
reviewers:
  - "@shawn-hurley"
  - "@jortel"
approvers:
  - "@savitharaghunathan"
creation-date: 2026-11-09
last-updated: 2026-11-09
status: provisional
see-also:
  - "/proposals/kep-279-kai-solution-server-rest-frontend"
replaces: []
superseded-by: []
---

# Deterministic Analyses and Incident Identity

## Release Signoff Checklist

- [ ] Enhancement is `implementable`
- [ ] Design details are appropriately documented from clear requirements
- [ ] Test plan is defined
- [ ] User-facing documentation is created

## Open Questions

> 1. Should `line` participate in the *exact* incident identity key, or only
>    in the fuzzy carry-over tier? Including it makes re-analysis after small
>    upstream edits churn identities (every incident below an inserted line
>    changes); excluding it risks conflating distinct findings on the same
>    rule and file. This proposal ships `line` in the key with a fuzzy
>    carry-over tier and requests reviewer input, since it must align with
>    kai's incident storage.
> 2. Should the incident-identity function live in `analyzer-lsp`, in
>    `tackle2-hub/shared`, or both (mirrored with contract tests)? This
>    proposal proposes hub-owned with a mirrored implementation in kai, but
>    an analyzer-lsp-owned function emitted into results would remove the
>    mirror.
> 3. Is the 7-consecutive-nightly-zero-diff gate acceptable as a release
>    requirement for projects with slower CI cadences, or should it be a
>    proportionally shorter window (e.g., 5 runs) configurable per repository?

## Summary

Konveyor analyses are not reliably reproducible today: re-running the same
analysis on the same application with the same configuration can produce
different results, different issue counts, different effort totals, and
differently ordered incidents. Downstream, this breaks three things users
depend on: run-to-run diffing (users cannot tell a real change from noise),
triage persistence (a triaged incident in run N cannot be recognized in
run N+1, so triage work is lost), and trust (Red Hat MTA JIRA contains
recurring reports of divergent results between the Hub, the CLI, and IDE
plugin runs of the same application — MTA-4943, MTA-4982, MTA-5170,
MTA-5179, MTA-6530, MTA-7445).

This enhancement makes analysis results deterministic and gives every
incident a stable identity. It has four parts: (1) a **toolchain manifest**
— digest-pinned analyzer image, rule-bundle digests, provider versions,
mode, and an effective-settings fingerprint — recorded with every analysis
and rendered in the Hub, the CLI, and the static report; (2) **deterministic
incident ordering** in analyzer-lsp, with a defined sort key and no
timestamps or UUIDs in result payloads; (3) an **incident identity key** —
a hash over rule, normalized file path, line, and snippet hash — that makes
incidents comparable across runs, surfaces, and components, and that carries
triage decisions forward across re-analyses with defined exact, fuzzy, and
re-ask tiers; and (4) a **strict mode** (`--strict`) that fails an analysis
rather than silently degrading when inputs are incomplete, plus a nightly
double-run harness that gates releases on zero variance across a fixture
corpus.

## Motivation

Users plan migrations on the numbers the tool produces. When the numbers
move between runs without a cause, confidence in the tool — and in the
migration plan built on it — erodes. The problem is documented repeatedly in
Red Hat MTA JIRA: rules firing differently between Windup and Konveyor
rulesets (MTA-4982), effort counts varying between runs on the same Node.js
application (MTA-5170), different rules generated between MTA 7.2 and 7.3 on
the same application (MTA-5179), annotation matching failing under wildcard
imports (MTA-6530), and — the cross-surface case this enhancement directly
addresses — different rules and issues firing when the same analysis profile
is run from the MTA Hub versus the IDE plugin (MTA-7445). Upstream,
editor-extensions#1482 documents an analysis assertion that has been failing
silently since July 2025 because nothing distinguishes a stable result from
a drifting one.

Determinism is also the keystone dependency for a family of planned
capabilities that are impossible without stable incident identity: triage
persistence and carry-over (triaged-once, carried-forward), run comparison
and diff views, effort-delta reporting between waves, and agentic workflows
that read incidents as stable identifiers. The kai project already stores
incidents with an identity-oriented model; this enhancement aligns Hub and
kai on one key definition so the components agree.

### Goals

- Every analysis record carries a toolchain manifest sufficient to explain
  what produced it (analyzer image digest, rule bundle digests, provider
  versions, mode, settings fingerprint).
- Re-running an analysis with an identical toolchain manifest and unchanged
  inputs produces byte-identical incident output, in the same order, with
  identical effort totals.
- Every incident has a stable identity key computable by the Hub, the CLI,
  and kai, with one shared definition of normalization.
- Triage decisions carry over across re-analyses under defined exact,
  fuzzy, and re-ask tiers, with fuzzy carries surfaced for re-confirmation
  rather than silently applied.
- A `--strict` mode (CLI and Hub analysis profile) that fails the analysis
  when required inputs (e.g., complete Maven dependency resolution) are
  unavailable, instead of producing partial results that look complete.
- A nightly double-run harness over a fixture corpus that reports zero
  variance before release, providing the regression gate that
  editor-extensions#1482 shows is missing.

### Non-Goals

- Fixing the content of individual rules or rule bundles (rule correctness
  is tracked per rule in the rulesets repository; this enhancement is about
  the analysis pipeline, not rule semantics).
- Full dependency-resolution parity with Maven and Gradle (tracked
  separately; MTA-8155 — this enhancement's strict mode depends on it but
  does not implement it).
- Reproducing binary-identical results across *different* toolchains; the
  toolchain manifest exists precisely so differences are attributable
  rather than eliminated.
- Backfilling toolchain manifests onto analyses recorded before this
  enhancement (they are rendered as pre-determinism runs instead).
- Post-hoc normalization of non-deterministic output (see Alternatives).
- Report rendering (static report parity is a separate work item).

## Proposal

### User Stories

#### Story 1: Architect compares two analyses

As an application architect, after my team fixes a module and re-runs
analysis, I open the comparison between the two runs. Every incident is
either unchanged, added, or resolved — with no churn — because both runs
record the same toolchain (same analyzer digest, same rule bundles) and
incidents carry stable identities. The effort delta I report to management
reflects real changes only.

#### Story 2: Migrator triages once

As a migrator, I mark an incident as false positive with a comment. Three
weeks later the application is re-analyzed after upstream changes shifted
line numbers slightly. My triage carries forward automatically — flagged as
a fuzzy carry for re-confirmation because the line moved — and I am not
re-triaging the same finding every sprint.

#### Story 3: Engineer debugs a divergence report

As an engineer investigating a report that "Hub and IDE disagree" (the
MTA-7445 class), I read both analyses' toolchain manifests and see the
analyzer image differs by tag resolution — one run resolved a floating tag
to a newer image. The manifest turns an unexplainable discrepancy into a
one-paragraph answer, and the fix (digest pinning) is mechanical.

#### Story 4: CI blocks on partial results

As a CI operator, I run `kantra analyze --strict` in the pipeline. When the
corporate Maven mirror is down and dependency resolution is incomplete, the
analysis fails with a clear error instead of completing with a subset of
incidents that would silently understate the migration effort.

#### Story 5: Release manager trusts the gate

As a release manager, the nightly double-run harness has reported zero
variance across the fixture corpus for seven consecutive nights before the
release cut. A determinism regression would have blocked the release, not
surfaced weeks later as a support case.

### Implementation Details/Notes/Constraints

**1. Toolchain manifest.** Recorded per analysis by the Hub (which owns
analysis execution) and validated against a versioned JSON Schema shared by
analyzer-lsp, the Hub, and kantra:

```json
{
  "$id": "https://konveyor.io/schemas/toolchain-manifest-1.json",
  "type": "object",
  "required": ["schemaVersion", "analyzerImage", "ruleBundles", "mode"],
  "properties": {
    "schemaVersion":  {"const": 1},
    "analyzerImage":  {"type": "string", "pattern": ".+@sha256:[a-f0-9]{64}"},
    "ruleBundles":    {"type": "array", "items": {
      "type": "object",
      "required": ["name", "digest"],
      "properties": {"name": {"type": "string"}, "digest": {"type": "string"}}}},
    "providerVersions": {"type": "object"},
    "mode":           {"enum": ["source", "source+dependencies", "binary"]},
    "settingsFingerprint": {"type": "string"},
    "hubVersion":     {"type": "string"}
  }
}
```

Constraints: the analyzer image reference must be digest-pinned (the Hub
resolves tags to digests at task creation); `ruleBundles` records the
bundles *actually loaded*, not those configured; `settingsFingerprint` is a
hash over the effective settings document so configuration drift is
detectable. The manifest is rendered in three surfaces: Hub UI analysis
detail, `kantra` CLI output, and the static report footer. Analyses recorded
before this enhancement have `toolchain: null`; the UI renders them as
"pre-determinism run" with no backfill attempt (the manifest is not
reconstructible after the fact).

**2. Deterministic ordering.** analyzer-lsp emits incidents sorted by the
key `(normalizedFilePath, line, ruleset/ruleId)` with a defined stable
tiebreak (snippet hash, then incident message) so any two identical-result
runs serialize identically. Result payloads must not contain timestamps,
UUIDs, or other run-variant metadata; run-level metadata lives on the
analysis record, not inside incident entries. Effort totals are computed
from the sorted incident set, so equal incidents imply equal totals.

**3. Incident identity and carry-over.** The identity key is:

```
sha256( ruleset/ruleId | normalizedFilePath | line | snippetHash )
```

with normalization defined once and owned in `tackle2-hub/shared`, mirrored
in kai and covered by contract tests on both sides:
`normalizedFilePath` is repository-relative, forward-slash-separated,
workspace-prefix-stripped, and case-preserved; `snippetHash` is SHA-256 of
the matched code window (line ± 3) with whitespace normalized, tolerating
line-number drift from upstream edits. Carry-over of triage state on
re-analysis is tiered:

| Tier | Condition | Behavior |
|---|---|---|
| exact | identity key matches | triage carries silently |
| fuzzy | same rule + file, line drift ≤ 10 | carries with `carriedBy: fuzzy` flag; UI asks for re-confirmation |
| re-ask | rule + file match, larger drift or snippet changed | offered, never auto-carried |
| new | otherwise | new incident, prior triage visible in history |

This must be aligned with kai's incident storage model so the Hub, kai, and
the IDE extension agree on keys (see-also: the Kai Solution Server REST
frontend enhancement, which consumes triage state).

**4. Strict mode.** `kantra analyze --strict` and the corresponding Hub
analysis-profile setting cause the analysis to fail — with a structured
error identifying the incomplete input — when required inputs are missing
(today: incomplete Maven dependency resolution; extensible to other
providers). Default remains best-effort for compatibility; strict is
opt-in per profile and documented for CI use.

**5. Nightly double-run harness.** A fixture corpus (small applications
representative of the rule sets, checked into a harness repository) is
analyzed nightly in two independent pods with identical manifests; outputs
are normalized (ordering excluded, since ordering is itself under test) and
diffed. Zero diff is required for a release; the harness also verifies that
two runs with *differently pinned* manifests report differing toolchains —
guarding against the manifest silently degenerating to a constant. The
harness can live in `go-konveyor-tests` or a dedicated
`konveyor/determinism-harness` repository (see Infrastructure Needed).

**Repo impact.** `analyzer-lsp` (ordering, payload hygiene),
`tackle2-hub` (analysis model, manifest, identity function, carry-over),
`kantra` (`--strict`, manifest display), `rulesets` (bundle digests),
harness repository (new or existing test repo).

### Security, Risks, and Mitigations

- **Digest pinning changes supply-chain behavior.** Pinning makes image and
  bundle substitution *visible* rather than impossible; digest verification
  should reuse the existing image-pull policy machinery. No new secrets are
  introduced. Security review: normal PR review by analyzer-lsp and hub
  maintainers is sufficient; no new privilege boundaries.
- **Strict mode breaks best-effort pipelines.** Users who today rely on
  analyses completing with partial results will see failures after opting
  in. Mitigation: strict is opt-in, the error identifies the incomplete
  input, and the default behavior is unchanged. Documented prominently in
  release notes.
- **Fuzzy carry-over could silently mis-apply triage.** A fuzzy carry that
  is wrong teaches downstream LLM weighting (kai) the wrong lesson.
  Mitigation: fuzzy carries are flagged and require re-confirmation in the
  UI; the carry tier is recorded on the triage record for audit.
- **Snippet hashes in payloads.** The identity key contains a hash of a
  code window, not the code itself; exporting identity keys reveals at most
  that two code windows are equal. No sensitive content is added to
  payloads. (The snippet text itself continues to be governed by existing
  analysis-data access controls.)
- **Harness cost.** Nightly double-runs of the fixture corpus add CI load;
  the corpus is deliberately small and the harness is isolated from
  release-blocking paths other than its own gate.

## Design Details

### Test Plan

- **Unit:** sort-key comparator properties (stability, total order,
  tiebreak); normalization function (path separators, prefixes, case);
  snippet-hash windowing and whitespace normalization; manifest schema
  validation (valid, digest-unpinned-invalid, unknown-version-invalid);
  carry-over tier classification across synthetic before/after incident
  sets, including the negative cases — an incident that vanishes on
  re-analysis, and a triage whose rule disappears entirely.
- **Integration:** double-run of the same application in one cluster
  (same pod pool) producing identical serialized output; two runs with
  different pinned manifests producing differing toolchain records;
  re-analysis after a synthetic upstream edit shifting lines by ≤ 10
  producing fuzzy carries (and exact carries when unshifted).
- **E2E / release gate:** the nightly double-run harness over the fixture
  corpus in two independent pods — zero diff required across **7
  consecutive nights** before release. This is the gate whose absence
  allowed editor-extensions#1482 to fail silently since July 2025.
- **Cross-component:** contract tests asserting hub-owned normalization and
  kai's mirrored implementation agree on a shared vector of cases; static
  report and CLI both render the manifest.

Tricky cases called out: analyses on Windows-style checkout paths
(normalization), duplicate incidents from provider overlap (tiebreak),
binary-mode analyses (line semantics differ — key includes line only when
the provider supplies one).

### Upgrade / Downgrade Strategy

- **Upgrade:** all schema changes are additive; no migration of existing
  analysis data. Analyses predating the enhancement carry `toolchain: null`
  and render as pre-determinism runs. The Hub resolves tags to digests at
  task creation from this version forward; existing saved analysis profiles
  continue to work unchanged (strict defaults to off).
- **Downgrade:** older Hub versions ignore the manifest field (additive JSON)
  and older analyzer-lsp versions ignore strict — downgrade is safe with the
  loss of the new guarantees. Because triage carry-over tiers are recorded
  on triage records (`carriedBy`), a downgrade leaves that field unused
  rather than inconsistent.
- **Version skew:** a new Hub with an old analyzer image (not emitting
  manifest inputs) is detected at task creation and reported as a manifest
  validation failure rather than recorded as a silent pre-determinism run.

## Implementation History

- 2026-11-09: proposed (provisional). Grounded in Red Hat MTA JIRA evidence
  (MTA-4943, MTA-4982, MTA-5170, MTA-5179, MTA-6530, MTA-5199, MTA-4790,
  MTA-7445, MTA-8155) and konveyor/editor-extensions#1482; design detailed in
  the companion design document (§4.1, §8.1, §8.3).
- 2026-11-09: filing status — **new filing**; searches of the Konveyor
  GitHub org and Red Hat MTA JIRA (2026-11) found no existing proposal for
  this scope. The related issues above are evidence, not proposals.

## Drawbacks

- **Strict mode rejects analyses that today "complete with errors."** Some
  users treat partial results as better than nothing; after opting in they
  get a failure instead. This is the intended behavior but is a real
  regression for those workflows, and support will see the tickets.
- **Ordering is a breaking change for diff tooling.** Any consumer that
  diffs raw analyzer output positionally will see every ordering change at
  once when this lands. Consumers should switch to identity-keyed diffs,
  but the transition is noisy.
- **The identity key freezes a definition into the data model.** Once
  triage records reference identity keys, changing the normalization or the
  key composition later requires a migration of every stored key. The
  schemaVersion field and the open questions above exist because of this.
- **The release gate has teeth.** A 7-night zero-diff requirement can hold
  a release for a variance bug that previously would have shipped
  unnoticed. That is the point, but it is a schedule risk teams must accept.

## Alternatives

- **Post-hoc normalization** (sort, deduplicate, and canonicalize results in
  the Hub after receipt). Rejected: it hides variance instead of eliminating
  it — two runs that disagree would be silently flattened, so the
  non-determinism survives to bite in places the Hub does not touch (CLI,
  IDE, kai), and it cannot produce stable identities for genuinely
  different result sets.
- **Timestamps-included identity** (key includes run timestamp). Rejected:
  it makes every incident unique per run, which is exactly the churn this
  enhancement exists to remove.
- **Content-hash-only identity** (no rule or path; hash the whole finding).
  Rejected: identical snippets with different rule verdicts are common
  (different rules flag the same code) and would collide.
- **Emit the identity key from analyzer-lsp only** (Hub stores what it
  receives). Considered viable and possibly better long-term (removes the
  mirrored implementation) but deferred to an open question: it couples the
  key definition to the analyzer release cycle, while Hub-side computation
  lets triage attach to incidents the analyzer produced before the key
  existed.
- **Do nothing; document instability.** Rejected: MTA-7445-class divergence
  reports and the lost-triage problem recur in every large deployment; the
  downstream family of features (triage, diff, effort deltas) is blocked
  without this.

## Infrastructure Needed

- A **fixture-corpus harness**, either as new CI jobs in
  `go-konveyor-tests` or a dedicated `konveyor/determinism-harness`
  repository. Requirements: ability to run two analyzer pods nightly
  against a small corpus, normalize, diff, and report; a public zero-diff
  badge consumed by release checklists.
- **Digest verification of rule bundles** assumes the rulesets
  repository/registry publishes stable digests per bundle version; if it
  does not today, a small publishing change there is needed.
