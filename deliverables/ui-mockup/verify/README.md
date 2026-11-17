# jsdom verification suites

Ad-hoc Node + jsdom assertion suites for `../index.html` — the documented
verification harness for the UI mock (see `../use-case-verification.md` §1 for
harness scope and known limits). Originally kept ephemeral in `/tmp/opencode`;
now part of the workspace so they survive `/tmp` cleanup.

## Running

From the **`deliverables/ui-mockup/` working directory** (suites resolve `index.html` and
the shared fixture relative to this folder, so the working directory does not
matter, but docs and examples assume `deliverables/ui-mockup/`):

```sh
cd ui-mockup
node verify/verify-waves.js          # one suite
node verify/run-all.js               # ALL suites, in parallel (default jobs: min(cpus, 6))
node verify/run-all.js --only=waves,rbac   # subset
node verify/run-all.js --jobs=1      # sequential, classic order
(cd verify && npm test)              # same as run-all.js
# or: (cd verify && npm install) once, then the same commands resolve jsdom
# from verify/node_modules instead of the /tmp fallback
```

`run-all.js` aggregates per-suite results (OK/FAIL with wall time per suite and
a total) and exits non-zero when any suite fails — a suite fails on a non-zero
exit OR any `FAIL` line in its output (belt-and-braces: several suites
historically exited 0 while printing FAIL lines; the exit codes were fixed
2026-11-17, and the line check guards against regressions of that). Suites are
independent processes, so parallel execution changes nothing about what each
asserts.

jsdom is resolved via `require('jsdom')` first (works after
`npm install` inside `verify/`), falling back to the historical ephemeral
location `/tmp/node_modules/jsdom`.

Each suite prints `FAIL: <name>` lines for failed assertions and exits
non-zero on failure (silence + exit 0 = pass).

## The suites

| Suite | Verifies |
|---|---|
| `verify-waves.js` | Wave-execution screen: 4 lanes + gantt bars, per-wave stat rows, #20 agent-spend rollup from run records, tenancy clamp on Meridian spend, #26 chevron rotation (`pf-m-expanded`), inventory rows vs `inv-rows-reference-wp3.json` |
| `verify-wavetabs.js` | Wave 3 tab bar: 4 lenses, Applications default, live badge counts + gate-status mark, lens switching |
| `verify-wavesi18n.js` | Full-translation sweep of the waves screen (every text node translated or whitelisted data/proper noun) + spot checks |
| `verify-i18n.js` | Language switcher: boot state, 8-option dropdown (row 98: no flags/countries), per-language switching, EN byte-exactness |
| `verify-i18nfilters.js` | Toolbar filters work under translation (the DE defect: translated filter menus must still filter) |
| `verify-i18ninc.js` | i18n observer reactivity (#70): dynamically written nodes translate; EN baseline unchanged |
| `verify-tokengate.js` | DE renders: admin wave-gate summary composition, reports/credentials copy |
| `verify-tokens.js` | Row 129 token administration: boot render + live column set, kind filter, search, show-expired toggle, sortable headers + `aria-sort`, shared pager, single/bulk revoke (modal → audit + toast), cross-page select-all, empty state + row-87 pager hiding, RBAC gating, wired Tokens link |
| `verify-aprofiles.js` | Row 130 analysis profiles (Config → Analysis): boot render + verbatim live sample row, wizard walk over the live step set (required-Name gate, source select, targets + skip-warning, scope, rules-required-when-no-targets gate, review, Finish), save/edit/delete with audit + archetype write-through, RBAC both personas, empty state |
| `verify-users.js` | Row 131 directory users (Config → Access): boot render + live column set, realm demo identities, token counts, search filter + zero-result pager hiding, create modal validation gates (required set, password mismatch, case-insensitive duplicate login), edit with rename cascading token ownership + stakeholder bind email, token-guarded delete + armed two-step delete, RBAC both personas, summary line |
| `verify-archtp.js` | Row 132 archetype target profiles: detail-row block + verbatim live sample row, manage modal scoped per archetype, reassignment with two-way write-through (profile registry archs + archetype Profiles cell), duplicate-name gate, armed delete with last-reference detach and non-last-reference retention, RBAC both personas |
| `verify-stakegroups.js` | Row 133 stakeholder-side group membership: edit pencils, modal Create/Save states, pre-checked memberships, both-direction `MOCK_GROUPS.members` sync (check grants, uncheck removes), rename cascade into groups + app owners + BSVC owners + wave stakeholder cells, duplicate-name gate exempting the edited record, audited create/update |
| `verify-identities.js` | Row 134 identities: live Created-by column + default label + Remove-default verb at boot, New-credential modal with the five live types driving per-type field sets (source user-credentials + default switch, maven upload/paste, proxy, Basic/Bearer Jira token), validation gates + duplicate name, exclusive-default write-through, persona-directory createdBy, audited create/update, RBAC |
| `verify-inssingle.js` | Row 135 Insights Single-application sub-tab: live two-tab bar, verbatim empty state before an app is picked, app/category menus, live column set with per-app Affected files (assessment-sourced row renders the no-files note), category filtering with a muted no-match line, same-record drillability, `&sub=single` deep link |
| `verify-agauthor.js` | Row 136 Agentic authoring: agent/skill Edit pencils with pre-filled Save modals, rename cascades (agent→run records, skill→agent bindings), cancel-edit reset, stages builder (starter row, Add stage, per-stage name/agent/instructions, chaining alert, named-stage gate), derived stage count, `workflows:create` audit, ready-only run-create select |
| `verify-assessoverride.js` | Row 137 assessment override: Assess routes through the gate, verbatim "New assessment" modal (warning icon, association alert with app + archetype, the live question), Override → questionnaire drawer with the dedicated-mode note (#45 baseline untouched), View archetypes → cohorts tab, generalized app parameter, Cancel closes |
| `verify-tenancy.js` | Tenancy invariants: org scoping at boot, exactly-one-team data, org isolation / platform-admin pivot, inventory rows vs fixture |
| `verify-rbac.js` | Persona nav matrix, flat nav (no Administration header), masthead task shortcut, inventory rows vs fixture |
| `verify-migr.js` | My-work reactivity: ticket cleared → row drops out; incident assigned → becomes my work; empty state |
| `verify-inc42.js` | Assigned-to-me toggle OFF → pool appears; #65 pool pagination (10/page, full count); wave chip filter |
| `verify-stats44.js` | Archetype cohort card + live counts (no "(N in portfolio)" suffix), A2A count |
| `verify-visuals45.js` | #59 segmented donut (one arc per analysis state, counts in titles, arcs tile the circle), pm home strip |
| `verify-helpmenu.js` | Help menu: tour item markup sanity, click → tour modal opens + menu closes, welcome item |
| `verify-tourdock.js` | Tour dock: absent without a tour, parked via step CTA, resume reopens the modal at the parked step |
| `verify-welcome.js` | Welcome flow: first-visit boot, start → flag set + tour opens, unseen persona triggers welcome |
| `verify-dequeue.js` | Row 118 dequeue: bulk queue → queued state + waiting task row, dequeue via row link and via the application modal, pre-queue state restored (Not started *and* Succeeded), task row removed, RBAC no-op for pm |
| `verify-adm43.js` | Admin workflow gating: no waves → no gate clause, task-count scoping, Wave-3 pass after credential rotate |
| `verify-grid93.js` | Row 93 RHDS 12-column grid: container census (11 since row 131's Access split), whole-track span sum per container incl. `gc12` full-width cards, no legacy inline `grid-template-columns` at the content layer |
| `verify-r87.js` | Row 87 RHDS per-element guidelines: code-block drawer templates, menu grouping ≤7, icon-only toggle `aria-label`s |

## Shared fixture

`inv-rows-reference-wp3.json` — recorded inventory-row render used by
`verify-waves.js`, `verify-tenancy.js`, and `verify-rbac.js` as a reference
snapshot.

## Known limits & landmines (see use-case-verification.md §1)

- jsdom has no layout: `offsetParent` is null; use headless Chrome for
  anything visual.
- MutationObserver is async — sleep 60–150 ms before asserting.
- `document.body.textContent` spans **all** screens (hidden ≠ absent) and
  includes `<script>` text unless the walker skips `script,style`.
- Locate elements by `data-*` attributes/ids, never visible text (i18n
  translates text at runtime).
- AR probes must use double-quoted, word-free JS (the AR phrase pass rewrites
  text inside `<script>` nodes and can mangle wordy probe source).
- Inline `onclick` on template-cloned content may not fire in jsdom — verify
  click cycles in headless Chrome; keep jsdom for structural assertions.
- **Stale-suite landmine**: suites are point-in-time checks tied to defect-log
  rows and can drift from recorded idioms (e.g. row-75 `svg.fas`, row-92 sort
  glyphs, ISO dates). Before diagnosing a suite failure as a regression,
  compare the assertion against the defect log in
  `../use-case-verification.md` §4.
