# React migration — `deliverables/ui-mockup/index.html` → this app

**Decision (2026-11-15):** full conversion of the single-file HTML mock into a
real React application, **keeping `deliverables/ui-mockup/index.html` untouched and in
parallel** — the mock remains the verified reference implementation and the
fallback demo while this app catches up.

**Stack:** Vite + React 19 + TypeScript + `@patternfly/react-core` 6.7.0
(same PF6 version line as the mock's stylesheet), `@patternfly/react-table`,
RHDS tokens (`@rhds/tokens` 3.2.0 via unpkg) and RHDS icons (path data
extracted from the mock — no `<rh-icon>` web component, per defect row 75).

## Status

| Area | State |
|---|---|
| Project scaffold (Vite, TS, PF6 React) | ✅ done |
| Data extraction from the mock (`scripts/extract-data.mjs` → `src/data/generated.ts`) | ✅ done — 41 literals, re-runnable any time |
| App state + hash-router (deep-link grammar preserved) | ✅ done |
| RBAC (`canView`/`can`, nav filtering) | ✅ done — nav mirrors the **mock's nav markup** (no "Application import" item, 2026-11-16 user correction: the import wizard is part of Applications — its Import button — and stays deep-linkable via `#scr=wizard`; don't derive nav entries from the RBAC views list, which carries `wizard` for clamp purposes only) |
| Tenancy (org/dept/team, `teamLockScope`, `archClampScope`, scoping) | ✅ done |
| Scheme toggle (dark class + `localStorage` + `&scheme=`) | ✅ done |
| RHDS icon component | ✅ done |
| Screens: **Home** (architect landing, live KPIs) · **Inventory** (mock-parity 2026-11-16: Applications/Archetypes-&-cohorts tabs (`&tab=archetypes` deep-linked via `invTab` app state), filter-category toolbar (10 categories, multi-select checkbox menus, removable chips, Clear-all), bulk selection + Assign-to-wave (`PUT /waves/{id}`) + Queue-analysis (`POST /batch/analyses`) RBAC-gated, sortable table (name/pts/wave/bsvc/age), Last-analysis column + incidents deep links (`#scr=incidents&app=`), PF6 pager, empty state, Create-new (`POST /applications`, plus icon), Export (client-side CSV, export icon), Import (→ wizard, import icon), saved-view chips (`Stale > 30d` / `— Not scheduled` / `Wave: 3`, click-to-toggle `pf-v6-c-label` spans with brand-outline active state, `Wave: 3` default ON, Clear-all resets them — mock `matches()` semantics: `a.stale` / `!a.wave` / `a.wave === '3'`; 'Stale > 30d'/'Wave: 3' stay EN in all locales by mock parity), row-click app-detail modal — all live reads; mock's Reports/Dependencies modal tabs still have no hub read) · **Incidents** (triage queue + insights tab + incident/insight modals + `&app=` chip, verified) · **Waves** (gantt lanes, gate stepper/list, evidence + tickets tabs, pgm coordination, ticket modal, verified; wave expand/collapse chevrons restored 2026-11-16 as the standard `RhMicronsCaretDownIcon` — the hand-rolled `svg.fas` copy rendered invisible because the mock's `svg.fas` rule was missing from index.css, see the AGENTS.md landmine) · **Reports** (7 tabs: combined risks, provenance facets, trends chart, dependencies, agent-run KPIs, rule coverage, questionnaire answers, verified) · **Agentic** (6 registries + run-record modals + lifecycle verbs + create flows, verified) · **Credentials** (scoped table + credential modal, verified) | ✅ done |
| Remaining screens (Wizard, Tasks, Config) | ✅ done — **Wizard** (5 steps, boot at step 3 with blocking validation; nav step numbers render once via PF6's `::before` counter badge — the "N. " text prefixes duplicated it, fixed 2026-11-16 in mock + port with dict keys renamed to bare step names, mock defect-log row 104), **Tasks** (qhealth strip, removable chips, sortable ID/Age, bulk select + cancel RBAC, real pager, task modal), **Config** (8 tabs, `&tab=` deep-linked; Controls with 8 sub-tabs + guarded deletes; Organizations padmin-only) |
| Notification bell + role/org-filtered drawer (#36 item 5) | ✅ done (2026-11-16) — verbatim mock port: 6 role/org-tagged static items with the mock's exact EN strings (trailing-space dict keys), mock filter semantics (`roleOk = persona==='admin' || for===persona`, `orgOk = !org || persona==='padmin' || org===state.org`), badge = filtered count (hidden at 0), outside-click + Escape close, per-item deep links; **unfenced** — the legacy walker translates it like the mock (status line translates only for n=1, same as the mock — it composes `n + ' unread · …'` and the dict only carries the n=1 key). Close interactions verified against **computed display**, not the `hidden` property: PF6's author-level `display:flex` overrides the UA's `[hidden]{display:none}`, so the drawer once stayed visually open while toggling correctly — fixed with `.pf-v6-c-notification-drawer[hidden]{display:none}` in index.css (the mock's `#notifDrawer[hidden]` rule, mock line 293) |
| i18n (8 locales) | 🔶 dual-engine migration (2026-11-16) — the mock's DOM-walker (`src/i18n/i18n.ts`, verbatim dict+rules+phrase pass) still translates **unmigrated** surfaces; migrated components use **react-i18next with natural keys** (`src/i18n/index.tsx`, `useT()`): catalogs in `locales/<lng>.json` are seeded from the mock's `I18N` dict by `scripts/extract-i18n.mjs` (runs in prebuild; + hand-maintained `scripts/i18n-additions.json` for strings the mock never had). EN stays byte-exact by construction (missing key → EN fallback). Migrated subtrees carry `data-i18n-live`, which the walker's skip check honors (travels through PF6 portals). Migrated so far: masthead chrome (user menu, scheme/skip/sidebar toggles) + Home (header, persona banner, architect landing — incl. the `Trans`-based trends caption). Plural-sensitive keys use i18next's native `count:` plurals (`_one`/`_other` pairs in every locale; EN forms in the generated `en.json`). `npm run check:i18n` gates used keys × all locales (also collects `i18nKey="…"` from `Trans` and enforces plural pairs for count-keys). Retire the walker when all screens are migrated — see "i18n strategy" below |
| **Live hub-backend API** (every screen reads the Quarkus backend; hard dependency with error state + retry) | ✅ done 2026-11-16 — see "Live API" below |
| CRUD against the API (agentic creates/deletes, incident triage) | ✅ real writes — run lifecycle (pause/resume/cancel, delete-finished) stays client-side (no hub verbs yet); **2026-11-17 (mock row 106 propagation):** inventory bulk bar gained two-step armed **Delete** (`DELETE /applications/{id}` per selection, real hub writes; the wave-membership 409 `resource.in-use` surfaces per app while the rest delete) and **Queue analysis is state-gated** — bulk button greyed unless ≥1 selected app is Not started/Succeeded, and the app-detail modal gained a functional gated Queue button (`POST /analyses`; the backend's 409 `state.conflict` is the enforcement layer) |
| Agent-run telemetry (mock row 105) | ✅ 2026-11-17 — Agent runs table has **Turns**/`Context` columns (`r.turns` / `r.ctx` from the hub contract's new fields, `—` when null); run-record modals repeat the "Agent loop N turns · context cur/win" line via `LoopTelemetry` (blue **live** label while the stage runs); the composed line keeps ONE text node per segment (`Agent loop ` + `<b>` + ` turns · context `) so the legacy walker's exact-node dict keys hit — never concatenate the sentence |
| Table pagination (mock row 106) | ✅ 2026-11-17 — the five Agentic tables (workflow runs, agent runs, workflows, agents, skills) + Credentials + Reports→Risk provenance page through PF6 `Pagination` (10/page default, compact bottom variant, hidden at zero results per row 87, page clamps when a reload shrinks the store); the fake "1–6 of 16 runs" caption was replaced by the real pager |
| Drawers/modals (app detail, incident triage, run records) | ✅ incident triage + insight modals (Incidents), ticket drawer (Waves), run-record modals (Agentic) and the **app-detail modal** (Inventory row click, 2026-11-16 — port of the mock's `openAppRow`: summary strip Effort/Risk(+provenance)/Analysis/Last-analysis + tabs Details/Tags/Review/Tasks/Platform/Related incidents, all from live hub data; the mock's Reports and Dependencies tabs (run comparison, artifact inventory) have no live read in the hub contract yet and are omitted; write verbs — Edit, Delete — stay with the CRUD work package; **Queue analysis landed 2026-11-17** state-gated per mock row 106) |
| CRUD stores (create/edit/delete + cascades) | ⬜ not started |
| Annotation system (`.anno` badges + tips) | ⬜ not started |
| Welcome/tour/dock | ✅ done 2026-11-16 — **Help menu** (#43 port, `src/components/Help.tsx`): guided tour with per-persona steps (`TOURS`, anno-cite citations stripped per the no-`(#N)`-in-JSX rule), tour modal + minimized dock that survives navigation, completion persists `mta.tour.<persona>` (label flips to "Replay…"), first-run role welcome persists `mta.welcome.<persona>` (deep links skip it), About modal adapted to the live-API console (workspace-relative doc links omitted — they only resolve from the mock's `file://` context); Home's parked-tour resume mirror button not ported (the dock covers resume) |
| Verification suites (jsdom + Chrome) for this app | ⬜ not started |

## Architecture

```
src/
  api/client.ts          fetch wrapper — Keycloak Bearer token (src/api/auth.ts),
                         ApiError, 401 → login(), listAll() paging
  api/hub.tsx            the hub data layer: loadAll() (per-org fan-out + global reads),
                         adapters projecting backend responses onto the mock's render
                         shapes, HubProvider (loading/error/retry), installTenancy/installHub
  data/generated.ts      GENERATED from deliverables/ui-mockup/index.html — never edit by hand
  state/appState.tsx     AppState (persona/org/dept/team/archLevel/scheme/anno),
                         hash parse+sync (mock's applyHash/syncHash grammar),
                         RBAC can()/canView() (SCOPE_OVERRIDES — hand-written, see below),
                         clamp() (teamLock/archClamp ports), useScoped(), and the
                         mutable ORGS/TEAM_BY_ID/APPS_LIST/CREDS_LIST registries the
                         hub layer installs at load time
  components/            Shell (masthead+sidebar), Nav, RhIcon
  screens/               one file per screen, ported incrementally
```

Principals carried over from the mock:

- **Data parity is mechanical**: `scripts/extract-data.mjs` re-pulls every data
  literal (apps, tenancy, RBAC, waves, incidents, agents, icons, …) from
  `deliverables/ui-mockup/index.html`. The mock stays the single source of truth until a
  screen is ported *and* verified. Wired into `predev`/`prebuild`. **Since the
  live-API switch, generated.ts only carries static chrome** (PERSONA_LABEL,
  views, ARCH_APP, the few static demo stores); all screen DATA comes from the
  hub backend (see "Live API" below).
- **Deep-link grammar preserved**: `#scr=…&persona=…&org=…&dept=…&team=…&arch=…&scheme=…&anno=1`
  — same keys, same precedence (deep link wins over persisted state), same
  clamps (`teamLockScope`, `archClampScope`).
- **RBAC/tenancy as pure functions** over state — no string matching on
  rendered text; the mock's invariants (exactly-one-team, owner derivation,
  stakeholder-org-required) port into `state/derive.ts` as screens need them.
- **RHDS tokens for the app's own layer**, PF6 components for chrome — the
  mock's design rules (no raw hex, RHDS space/font tokens, RHDS focus ring,
  state-reflecting scheme icon) carry over.

## Live API (2026-11-16) — every screen is hub-backed, Keycloak-authenticated

The app is now a **hard client of the Quarkus hub-backend** (`../hub-backend`,
contract v2.1 + the console extensions), **authenticated with Keycloak**
(realm `mta`, public client `mta-console`, PKCE — Dev Services Keycloak on
:8180 in dev; the realm file is `../hub-backend/keycloak/mta-realm.json`).
There is **no demo-data fallback**: when the backend is unreachable,
`HubProvider` renders a "Hub backend unavailable" error state with a Retry
button; nothing else renders.

- **Auth gate (App.tsx)**: `initAuth()` runs `check-sso` FIRST — anonymous
  visitors get a sign-in screen instead of a forced redirect; authenticated
  users get HubProvider → AppProvider → the console. `api()` attaches the
  Bearer token (auto-refresh ≤30 s before expiry) and re-triggers
  `login()` on 401. **Roles define persona**: the realm role of the
  signed-in user IS the persona (`PERSONA_PRECEDENCE` in `auth.ts`) — the
  mock's persona switcher is replaced by the user chip (name · role · Sign
  out). `&persona=` deep links clamp to the token persona.
- **Tenancy from the token**: the `mta-org` claim (display name) is the
  home org; the optional `team` claim pins team-locked personas (schmidt =
  pm of Claims). Native Keycloak-org membership (claim `mta-orgs`, array of
  org aliases) is the fallback source — `home()` and the org filter accept
  either (aliases equal the tenancy slugs). Non-padmin users fan out data
  reads over exactly one org via `?organization=<uuid>`; padmin pivots
  across all (audited backend-side).
- **`main.tsx` order + data-driven home**: the provider chain lives in
  `App.tsx` (auth gate → HubProvider → AppProvider) — `AppProvider`'s
  `parseHash` must not mount before the hub installs the orgs/teams
  registries, else every screen silently renders the empty-org fallback
  (`scope-label` = "· · all teams", zero rows despite 200-OK calls).
- **RBAC scope literals live in `appState.tsx` (`SCOPE_OVERRIDES`), NOT in
  generated.ts** — `prebuild` regenerates generated.ts from the mock on every
  build and would wipe edits. They mirror the backend's role bundles and gate
  the UI (disabled buttons with reason titles); the BACKEND enforces for real
  (token roles → `hub.role-mapping.*`). The backend role mappings must cover
  every scope a screen calls — gaps surface as 403s under demo users.
- **Demo users** (realm import, password `demo`): keller (architect), cordes
  (migrator), schmidt (pm · Claims), vogel (pgm), weber (admin), root
  (padmin). Sign in at :5173 with any of them; the workspace adapts.

- **Provider order is load-bearing**: `HubProvider` wraps `AppProvider` in
  `main.tsx` (NOT inside `App.tsx`). `AppProvider`'s `parseHash` runs at mount
  and freezes the initial tenancy clamp — if it mounts before the hub installs
  the orgs/teams registries, every screen silently renders the empty-org
  fallback (this was a real bug; the symptom was `scope-label` = "· · all
  teams" and zero rows everywhere despite 200-OK API calls).
- **`main.tsx` order + data-driven home**: org/dept/team default (TEAM_HOME)
  derives from the ARCH_APP's (`payments-api`) team via the hub data — not
  alphabetical first (the backend returns "Meridian Health" first when sorted
  by name).
- **RBAC scope literals live in `appState.tsx` (`SCOPE_OVERRIDES`), NOT in
  generated.ts** — `prebuild` regenerates generated.ts from the mock on every
  build and would wipe edits. `SCOPE_OVERRIDES` merges over the generated
  `RBAC` and uses backend-exact `resource:verb` literals; `'*'` stays
  frontend-only and is expanded by `client.ts` `expandScopes` to `ALL_SCOPES`.
- **Loading strategy** (`loadAll` in `hub.tsx`): `/organizations` first (org-less),
  then a per-org fan-out with `?organization=<uuid>` for the tenant-required
  endpoints (`/applications`, `/departments`, `/teams`, `/stakeholders`,
  `/business-services`, `/tags`, `/waves`, `/analyses`, `/tasks`,
  `/analyses/incidents`, `/identities`, `/audit`), in parallel with the global
  surfaces (`/report/trend`, agentic registries, `/platforms`, `/targets`,
  wave content). The org set comes from the token's `mta-org` claim
  (display name) or `mta-orgs` (native Keycloak-org aliases);
  non-padmin users see exactly one org (the backend clamps to the claim and
  ignores the param). Missing org claim ⇒ 400 `tenant.required`.
- **Adapters project onto the mock's render shapes** so the ported screens keep
  their markup: app `state` maps CURRENT→succeeded, IN_FLIGHT→running(+progress),
  STALE→quota, FAILED→failed, NOT_STARTED→notstarted; `stale` = last successful
  analysis ≥ 2 days old; task QUEUED+quota→'Postponed'; task id displays as
  `#${uuid.slice(0,4)}`; ages derive from analysis `completedAt`. Data stays
  data — derivations run one way (backend state → display string).
- **Module-level store bind pattern** for screens whose child components read
  stores (Waves, Reports, Config): `let X = …` module bindings assigned at the
  top of the screen function (children render after the parent body runs).
  Incidents/Agentic/Tasks/Credentials use `useHub()` directly.
- **Writes that are real**: agentic creates/deletes (POST/DELETE + `reload()`),
  incident triage (`PUT /incidents/{key}/triage`, gated by `triage:write`,
  group rows carry a representative incidentKey). **Run lifecycle
  (pause/resume/cancel, delete-finished) stays client-side** — the hub contract
  has no such verbs yet; Tasks cancel is a no-op demo (TaskResource is
  read-only). Created entities are seeded minimally (the backend owns age/
  consumer/count derivation).
- **Static content boundaries** (kept in the app, no backend surface):
  `ACTIVE_LOGINS`/`EXTRA_USERS` (Config Access tab, console-directory demo) and
  the Reports combined-matrix/insights editorial prose.
- **Dev proxy** (`vite.config.ts`): `/api/*` → `process.env.HUB_API` (dev
  default: the hub's :8080; rewrite strips `/api`). Set `VITE_API_BASE` to
  point the client elsewhere. Start the backend with `mvn quarkus:dev` in
  `../hub-backend`.
- **`.tsx` generic arrow functions need `<T,>`** — `const per = async <T>(…)`
  parses `<T>` as JSX and fails with confusing syntax errors.


## i18n strategy (decision made 2026-11-16 — key-based i18next, dual-engine migration)

The mock translates at runtime by walking DOM text nodes (dict → rules →
phrase pass). That machinery was ported verbatim (`src/i18n/i18n.ts`) and works,
but pattern-matching arbitrary text is the mock's most fragile layer (silent
fallback on copy churn, regex landmines, mixed partials). The target is
**react-i18next with natural keys**; both engines run side by side during the
migration:

1. **Catalogs** (`src/i18n/locales/<lng>.json`): the key IS the English string;
   values seeded from the mock's `I18N` dict by `scripts/extract-i18n.mjs`
   (prebuild), merged with hand-maintained `scripts/i18n-additions.json` for
   strings the mock never had (auth chrome). The dict's whitespace-padded
   sentence fragments are dropped — they belong to the retired rules layer.
2. **`t()` pipeline**: `useT()` from `src/i18n/index.tsx`; components translate
   their strings at render time. EN byte-exact by construction (missing key →
   EN fallback; `keySeparator`/`nsSeparator` disabled because keys are sentences).
3. **Dual-engine fence**: migrated components mark their DOM `data-i18n-live`;
   the legacy walker's `i18nSkipped()` honors it (attribute travels through PF6
   portals, so dropdown menus and modals are fenced too). Unmarked surfaces keep
   translating through the walker — no double-translation, no coverage loss.
4. **CI gate**: `npm run check:i18n` re-seeds the catalogs, then verifies every
   `t()` literal used in `src/` exists in ALL locales and no key is
   identifier-shaped/padded. Cross-locale drift from the mock's dicts is
   reported as a warning only (legacy data holes, they render EN).
5. **Retirement**: migrate screen by screen (chrome strings only; data strings
   stay data — the identifier-guard/`data-i18n-skip` bug classes become
   structural omissions). When no surface is walker-managed, delete
   `src/i18n/i18n.ts`, move `dir`/`documentElement.lang`/`localStorage mta.lang`
   ownership into the provider, and replace the walker's date/currency phrase
   pass with `Intl` formatters. The regex rules (`I18N_RULES`) die with it —
   genuinely grammatical sentences become keyed ICU messages.

## Screen port order (suggested)

1. ~~Incidents (triage queue + insight split + incident modal)~~ ✅ 2026-11-15
2. ~~Waves (gantt, gates, coordination card)~~ ✅ 2026-11-15
3. ~~Reports (7-tab rollups)~~ ✅ 2026-11-15
4. ~~Agentic (6 registries)~~ ✅ 2026-11-15
5. ~~Credentials (scoped table + credential modal)~~ ✅ 2026-11-15
6. ~~Tasks + Wizard + Config (8 tabs)~~ ✅ 2026-11-15 — **all 9 screens ported**
4. Config hub + Tasks + Wizard
5. Drawers/modals ride with their parent screens
6. i18n + annotations once screens are stable
7. Verification suites (jsdom structural + Chrome visual), then the
   mock's suites get a `ui-react` variant where behavior should match

### Porting notes learned on Incidents

- **Generated data carries HTML entities verbatim** (`&rarr;`, `&times;`,
  `&middot;`, `&mdash;`). The mock decodes them via `innerHTML`; React text
  nodes do not. Pass every data-derived string through `dec()`
  (`src/utils/decode.ts`).
- **Modal field semantics differ from the queue cells**: the mock's
  `openIncidentFromRow` passes the *raw* row tracker (`r[4]`), while the queue
  cell falls back to the app's `WAVE_TICKETS` entry on row 0 — so the modal
  shows "not exported to a tracker" where the queue shows "MIG-418 synced".
  Replicated deliberately.
- The incident modal's Rule row is **computed per incident** from the title
  (`incRuleFor` slug derivation), and the hint alert + triage-state card are
  unconditional template statics; the Cohort group shows for every
  `EAP8-archetype` app (store-derived membership).
- RBAC-gated modal verbs use `isDisabled` + a `title` reason
  (pm/pgm have empty scopes; architect lacks `incidents:resolve/triage`).
- Sortable headers: only the active column carries `sortBy.index` — otherwise
  PF6 renders an active arrow on every column.
- Pagination is conditionally rendered (hidden at zero results, mock row 87).
- CDP probe pattern (`/tmp/opencode/cdp-inc-modal.cjs`, uses Node 22's global
  `WebSocket`) drives real clicks for modal verification — headless screenshots
  alone can't exercise interactivity.

### Porting notes learned on Waves

- **Static vs derived split**: the mock's wave lanes carry *template statics*
  (bars, planned→actual, composition, stakeholders — now `WAVE_META`) while
  everything membership-driven derives live (chips, analysis/risk/effort/spend
  stats, member tables, gate list + stepper, evidence, tickets, dep edges,
  scope count). `MOCK_AGENT_RUNS` was added to the extractor for the agent-spend
  rollup (note: it's a `let` in the mock — the finder matches both).
- **Lane visibility rule** (`applyTenancyWaves`): lanes show only for org
  `nwf`; team-scoped views hide member-less waves; non-nwf orgs get the
  guided empty state (#43).
- **PGM-only coordination strips** render inside each wave's detail
  (`renderPgmCoord` port): contributing teams + cross-team flag, quota
  blockers, and the wave's side of the dependency edge.
- **PF6 React API**: `ProgressStep` (not `Step`) takes its title as
  `children`; `id` + `titleId` are required for a11y; Button uses
  `size="sm"` (no `isSmall`); table primitives live in `@patternfly/react-table`.
- **Never `.join()` JSX nodes** (renders `[object Object]`) — map with string
  separators instead.
- The gantt/wave-exec CSS came from the mock's own layer — ported token-for-
  token into `src/index.css` (including the dark-scheme `.bar` flip).

### Porting notes learned on Reports

- **Card actions**: PF6 React idiom is `<CardHeader actions={{ actions: <>…</> }}>`
  — never nest a second `CardHeader` (the mock's `__actions` div has no direct
  React equivalent).
- **Hand-rolled PF markup needs its stylesheet imported explicitly**: the app
  gets component CSS through each component's JS side-effect import, so markup
  reusing `pf-v6-c-*` classes without the component (here: the combined-risks
  `pf-v6-c-progress` bars, which the React `Progress` component renders with an
  extra status icon) must add e.g.
  `import '@patternfly/react-styles/css/components/Progress/progress.css';`.
  Diagnose with `grep -o "class" dist/assets/*.css | wc -l` — `grep -c` counts
  lines and minified CSS is one line.
- **jsdom/CDP probes on Tabs**: PF React keeps ALL tab panels mounted (hidden),
  so scope queries with `[role="tabpanel"]:not([hidden])`. Same for clickable
  `Label`s: the onClick lands on an inner `<button>`, not the outer
  `.pf-v6-c-label` span — synthetic `.click()` on the span silently no-ops.
- **Reports tabs are NOT `&tab=` deep-linkable** — the mock only deep-links
  config/agentic/incidents tabs, so the port matches (click-only).
- **RBAC note**: `migrator` has no reports view (RBAC parity with the mock) —
  `#scr=reports&persona=migrator` correctly falls back to Home; scope
  verification uses `pm` (team Claims: 11 runs, 3.5M tokens, $92.32 — equals
  the wave-lane spend rollup for the same apps, a nice cross-check).
- Never `.join()` JSX arrays; static JSX-in-array literals need `Fragment key=`
  to satisfy the jsx-key lint rule.

### Porting notes learned on Agentic

- **`&tab=` deep-linking lives in appState now**: the mock emits `tab` for
  agentic (and config/incidents), so `AppState.agTab` was added — parseHash
  reads it, syncHash emits it for `scr=agentic`. A screen-local
  `history.replaceState` loses the race against appState's own syncHash effect
  (the app state re-writes the whole hash on every change).
- **Registries are hub-backed now** (2026-11-16): `useState` arrays seed from
  `HubData` and re-sync on every load; creates/deletes are real POST/DELETEs +
  `reload()`. The *lifecycle verbs* (pause/resume/cancel, delete-finished)
  remain client-mutable state — no hub verbs yet.
- **Lifecycle verbs propagate** (one agent run = one stage): cancel/stop on a
  workflow run cascades into running/queued (cancel) or running (stop) stages;
  cancel/stop on a stage cascades up into a running parent (first reason wins,
  `rec.reason = rec.reason || reason` — kept); resume reverses both. Every
  affected log gets a terminal event via `evNextTs` (+45s after the last).
- **Armed deletes** are the mock's two-step `dataset.armed` contract: trash →
  warning icon + "Confirm delete"; skill/workflow deletes keep the guard rails
  (bound-to-agents / referenced-by-runs → error alert, no delete).
- **RBAC note**: architect lacks `runs:delete`, `agents:create`, and
  `agents:delete` (extracted RBAC is mock truth) — the Create-agent button and
  registry delete icons render disabled with "Missing scope" titles.
- Probe landmine (recurring): React controlled `TextInput`s ignore native
  `value = …` assignment — use the `HTMLInputElement.prototype.value` native
  setter before dispatching `input`, or the form validation state never sees
  the probe's keystrokes.

### Porting notes learned on Credentials

- **The tenancy clamp is the whole screen**: `scopedCreds()` = credentials
  whose team's org matches + team filter (port is a `useMemo` over
  `state.org`/`state.team`) — org `mrd`/team `imaging` yields the #43 guided
  empty state; `pm` has no credentials view at all (RBAC fallback to Home).
- **Used-by is derived, not stored**: the mock's `CREDS[].usedBy` string is
  seed decoration — `renderCreds` recomputes the count from
  `MOCK_APPS[].credName`, so the port does too (gitlab-pat renders "4
  applications" from the store, not the static "7").
- The credential modal is the static svn-read-key template generalized: the
  warning (rotation/blast-radius) fires only for `expiring`, the unverified
  variant (nexus-mvn) swaps the label text and adds the #15 field-failure
  note, and `usedBy` links resolve through `MOCK_APPS` (#33 item 9).
- Probe landmine: PF React `Modal` centers in the *full* viewport height —
  crop screenshots at `h/2`, not the top half.

### Porting notes learned on Tasks / Wizard / Config

- **View-level RBAC decides screen visibility, not just buttons**: architect
  has no `tasks`/`config` *view*, so `#scr=tasks` as architect renders the
  Home fallback (the mock's nav hides the entries; the router clamp is the
  port equivalent). Probe those screens as `migrator` (tasks) or `admin`
  (config).
- **PF6 React sortable `Th` contract**: `sort` takes
  `{ columnIndex, sortBy: { index, direction, defaultDirection }, onSort }`
  and calls `onSort(event, columnIndex, newDirection)` — index *before*
  direction. Passing PF5's old `(event, direction, index)` shape silently
  sorts by the wrong column.
- **Nested PF Tabs probing landmine**: `[role="tabpanel"]:not([hidden]) tbody tr`
  matches rows of *inner hidden* panels because the outer (visible) panel
  contains them. Filter rows by walking ancestors: no
  `closest('[role="tabpanel"][hidden]')`.
- **`can(…, 'tenants')` is padmin-exclusive** (mock special-cases it before
  the scope check) — the Organizations tab renders only for padmin, exactly
  like the mock's `data-rbac="tenants:read"`.
- **Stakeholders are boot-derived**, not a store: the mock builds
  `MOCK_STAKEHOLDERS` from the tenancy rosters + `STAKE_OVERRIDES` + one hand
  added DBA; the port re-derives with `useMemo` (same for the Access tab's
  users table — stakeholders-with-email + `EXTRA_USERS` promote candidates).
- **PF6 component CSS is per-package in React**: `pf-v6-c-wizard` styling is
  NOT in `base.css` — import
  `@patternfly/react-styles/css/components/Wizard/wizard.css` (Progress on
  Reports set the precedent). The mock's `.qhealth` strip CSS was ported into
  `src/index.css` (light + dark gradients).
- **Sort state**: Tasks sorts ID-descending by default (#36 field finding),
  toggles to asc on header click; `aria-sort` follows via PF's
  `sortBy.index/direction`. Age >1h / Under 1h compares `ageMin`.

### Porting notes learned on Home (architect landing, 2026-11-16)

- **The mock's `lp-architect` landing is the source of truth** — the React
  Home is a full port of it (`ArchitectLanding` in `src/screens/Home.tsx`):
  the red persona-blurb banner ("that role's first question", all personas),
  then four KPI cards (Effort rollup #4, Combined risk #32 with the
  `.stackBar` distribution bar, Analysis coverage #33 donut, Waves on track
  #46 with per-wave failing/passing labels), the per-business-service
  "Where the portfolio hurts" table, and the Trends bars (#14). The
  `.persona-blurb` / `.stackBar` / card-footer-link CSS was ported into
  `src/index.css` (incl. the dark-scheme red-80/red-20 flip).
- **Every number derives live from hub data** — the mock's narrative
  constants (MOCK_RUN_TREND etc.) have no React equivalent: creds
  (expiring/unverified), wave-evidence (red suites), wave-tickets (open),
  waves, and `/report/trend` drive the same derivations the mock computes
  over its stores (`gateFacts` is a line-by-line port of `waveGateFacts`).
  Deliberate deviations: numbers differ from the mock where tenancy scopes
  them (keller's org has 12 apps, the mock's unscoped MOCK_APPS has 100+),
  and `.anno` badges don't exist in React (annotations are a mock-only
  layer).
- **`/report/trend` returns a RAW ARRAY, not the paged envelope** —
  `listAll()` (used by every other read) expects `{items:[…]}` and silently
  returns `[]` for it; the trend fetch must use `api<TrendV[]>('/report/trend')`
  directly. Symptom when wrong: Trends card renders "last 0 runs" with no
  error anywhere.
- **`useHub()` returns `{ data, reload, reloading }`** — the HubData fields
  (`creds`, `trend`, …) hang off `data`, not off the hook result.
- **Hurts-table rows deep-link into a pre-filtered Applications view**:
  row click sets `#scr=inventory&bsvc=<name>`; Inventory seeds a clearable
  "Business service: …" chip from the hash at mount (unknown hash keys are
  ignored by appState's parser, and `syncHash` rewrites the URL without
  them — the filter state lives in the component, like every other
  Inventory filter).

### Full-screen alignment pass (2026-11-16)

- **Suggestion-reference leaks stripped from all screens**: the port had
  folded the mock's annotation content (`(#4)`, `(#32 item 5: …)`,
  "Implements: …" footers) into visible titles/subtitles/column
  headers/prose — the mock shows these ONLY as opt-in `.anno` badges
  (default off), so all 235 refs were removed from the rendered text.
  They live on in comments and in the design docs; do not reintroduce
  `(#N)` refs into JSX text. Upstream refs the MOCK itself shows in prose
  (`tackle2-ui#3116`, `hub#420`, `agentic-controller#240`, `#494`,
  `R2-16`) stayed.
- **Mock client-side action verbs restored to SCOPE_OVERRIDES**
  (architect + migrator): `runs:create/cancel/pause`, `identities:edit`,
  `identities:verify`, `tasks:cancel` — the backend-exact override list
  had dropped them, disabling buttons the mock enables (Create workflow
  run, re-test, wave re-validate — that one also needed its gate literal
  corrected from `waves:edit` to `waves:update`). These verbs gate UI
  affordances only; server enforcement stays role-mapping-based.
  `runs:delete` deliberately NOT granted (mock's declared RBAC also lacks
  it — its run-row trash is disabled for the architect too).
- **Credentials display parity**: the hub seed now stamps `lastUsed` on
  the five demo identities (mock values: 14m/3d/1h/6h ago — was null ⇒
  'never' everywhere), and the adapter renders Expires the mock's EN way:
  relative "in N days" within 14 days, short date ("Sep 12") otherwise.
  Requires reseeding the Dev Services database (drop the Dev Services
  PostgreSQL container/volume, then restart `mvn quarkus:dev`).
- **Known remaining divergences (accepted)**: the app-detail modal's Reports
  and Dependencies tabs still have no hub read (run comparison, artifact
  inventory); archetype management writes (create/edit/membership-rule
  editing, propagate-assessment) have no archetype write scopes/endpoints in
  the frontend — the Archetypes tab is a live read. Wave bar text can clip
  ~2px earlier than the mock at 1600px (sub-pixel font rendering, CSS is
  token-identical). (Former divergences — pagination, Archetypes tab, bulk
  toolbar, Create-Import-Export — closed 2026-11-16.)
- **Tenancy slugs vs UUIDs (2026-11-16)**: the tenancy tree
  (`ORG_BY_ID`/`TEAM_BY_ID`/`TEAM_HOME`) carries display **slugs**
  (`claims`), not the UUIDs the hub's write bodies need. `HubData.teams`
  (`{id: uuid, name, org: slug}`) was added for that — POST /applications
  initially sent `teamId: "claims"` and failed 400-with-empty-body (JSON
  UUID deserialization). `HubData.archetypes` and `WaveRow.id`/`BsvcRow.id`
  were added in the same pass (bulk Assign-to-wave needs wave UUIDs,
  member-name→app-UUID mapping goes through `AppRow.id`).

## Running

```sh
cd ../hub-backend && mvn quarkus:dev   # the API on :8080 — start FIRST (hard dependency)
cd ui-react
npm install
npm run dev        # console on :5173 (proxies /api → :8080)
npm run build      # type-checks + bundles (extraction runs first)
node scripts/extract-data.mjs   # re-sync static literals from the mock
```

Open the console (:5173) — you land on the **sign-in screen**. Sign in at
the Dev Services Keycloak (:8180, realm `mta`) with a demo
user (password `demo`): `keller` (architect), `cordes` (migrator), `schmidt`
(pm · team Claims), `vogel` (pgm), `weber` (admin), `root` (padmin), `olson`
(architect, tenancy from org membership). With the orgs feature enabled the
login is **username-first** (username → Sign In → password). Your
realm role IS the persona; the token's `mta-org`/`team` claims (or native
org membership) scope your view. `VITE_KEYCLOAK_URL` overrides the Keycloak
base URL.

Without the backend the app renders the "Hub backend unavailable" error state
with Retry — by design (no mock-data fallback).

## Conventions for this folder

- `generated.ts` is never hand-edited; if a needed literal is missing, add its
  name to `NAMES` in `scripts/extract-data.mjs` and re-run.
- Screens port the mock's *behavior*, not its inline-`onclick` idiom — event
  handlers become React props; state mutations go through the store/context.
- Keep the mock untouched while porting; parity bugs found on either side get
  fixed in the mock first (it is the verified reference), then re-extracted.
