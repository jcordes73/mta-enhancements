# Enhancement proposals ①–⑤

Five complete, fileable enhancement proposals for upstream
[`konveyor/enhancements`](https://github.com/konveyor/enhancements), distilled
from the MTA improvement program. All are **new filings** — none duplicates an
existing upstream issue (verified 2026-11); six other suggestion clusters are
handled as build-on-existing-issue actions instead (see the workspace
[README](../README.md) and design doc [§6 filing
plan](../design/design.md#6-enhancement-clustering-filing-plan)).

## The proposals

Numbering ①–⑤ matches the cross-references inside the proposals, the
[socialization scripts](../socialization/socialization-scripts.md), and the
[slide decks](../socialization/presentations/index.html).

| # | Proposal | Covers suggestions | Primary repos | Effort | Reviewers / Approvers |
|---|---|---|---|---|---|
| ① | [Deterministic Analyses and Incident Identity](deterministic-analyses-and-incident-identity.md) | #7, part of #1 | analyzer-lsp, tackle2-hub, kantra | ≈ 12 ew | @shawn-hurley, @jortel / @savitharaghunathan |
| ② | [Triage Store and Run Comparison](triage-store-and-run-comparison.md) | #33(1–2), #1, #6, #10 | tackle2-hub | ≈ 12.5 ew | @jortel, @fabianvf, @abrugaro / @jwmatthews |
| ③ | [SARIF and CycloneDX Export](sarif-and-cyclonedx-export.md) | #12, #18 | tackle2-hub | ≈ 5 ew | @jortel, @shawn-hurley / @savitharaghunathan |
| ④ | [Batch, Events, and Aggregates API](batch-events-and-aggregates-api.md) | #33(3–6) | tackle2-hub | ≈ 10 ew | @jortel (+TBD tackle2-ui) / @jwmatthews |
| ⑤ | [Vulnerability and Coverage Issue Types](vulnerability-and-coverage-issue-types.md) | #24, #22 | tackle2-hub, addons | ≈ 11 ew | @jortel (+TBD RHDA/RHTPA) / @savitharaghunathan |

Program total ≈ 50 engineer-weeks; recommended landing order ① → ② → ④ → ⑤,
with ③ as the parallel quick win (design doc
[§6.2](../design/design.md#62-repository-impact-per-drafted-proposal)
and [§6.3](../design/design.md#63-effort-estimates-per-proposal)).

## What each file contains

Every proposal follows the
[`konveyor/enhancements` template](https://github.com/konveyor/enhancements)
exactly: YAML frontmatter (authors / reviewers / approvers, status,
see-also chain) and the standard sections — Summary, Motivation, Proposal,
Design Details, Drawbacks, Alternatives, Infrastructure Needed — plus a
Release Signoff Checklist and Open Questions that should be closed before
the `implementable` milestone.

## Filing status

- All five are drafted at status `provisional` — the milestone at which a
  PR is filed (design doc
  [§6.4](../design/design.md#64-filing-status-of-the-drafted-proposals)).
- Target repository: `konveyor/enhancements` (default branch `master`), one
  PR per proposal.
- Two reviewer slots are intentionally `TBD` (④ tackle2-ui maintainer,
  ⑤ RHDA/RHTPA-facing reviewer) — they should be filled during SIG
  socialization, alongside closing the Open Questions sections and the
  six program ADRs (design doc
  [§18](../implementation/implementation.md#18-implementation-readiness-checklist)).

## Before you file

1. Socialize at the SIGs using the
   [scripts](../socialization/socialization-scripts.md) and
   [decks](../socialization/presentations/index.html) — one per proposal, with explicit asks.
2. Close the Open Questions in each proposal and the ADRs in design doc §18.3.
3. Fill the two `TBD` reviewers.
4. File the PRs; afterwards, track each proposal through
   `provisional → implementable → implemented` (one PR per transition).
