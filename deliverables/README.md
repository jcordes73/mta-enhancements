# Deliverables — the three code artifacts backing the program documents

The `design/` and `implementation/` documents (stages 2–3) are only claims
until something runs them. This folder holds the three deliverables that
make them concrete: a **UI mock** that proves the console designs, its
**React port**, and a **Quarkus backend** that implements the API contract
the designs specify. Each carries its own toolchain; there is no shared
build. For the workspace layout and pipeline context, see the
[root README](../README.md) and [AGENTS.md](../AGENTS.md).

The three artifacts relate as **reference → port → contract**:

# Run everything with podman compose

[compose.yaml](compose.yaml) brings the whole stack up in containers —
PostgreSQL, Keycloak (the checked-in realm), the Quarkus hub-backend
(`%prod` profile), and the React console (nginx serving the production
build with `/api` proxied to the hub). No host Java, Node, or Maven needed.

## Prerequisites

- **podman ≥ 4.7** with a compose provider (`podman compose version` must
  work — on Fedora/RHEL this delegates to `podman-compose`; docker-compose
  v2 works identically via `docker compose` if you prefer).
- **First build needs network** (Maven + npm images/deps); roughly 5–10
  minutes once, seconds afterwards thanks to layer caching.
- Free ports: **5173** (console), **8180** (Keycloak), **8080** (hub API).

## Start

```sh
cd deliverables
podman compose up --build -d          # first run: builds 2 images, seeds DB + realm
podman compose ps                     # wait until keycloak/postgres report (healthy)
```

First boot order (automatic): postgres → keycloak (imports
`hub-backend/keycloak/mta-realm.json`) → `keycloak-bootstrap` (one-shot;
syncs Organization memberships, which realm imports skip — keycloak#54343)
→ hub-backend (seeds the mock dataset into the empty DB) → console.
Give it ~90 s end to end.

| URL | What |
|-----|------|
| http://localhost:5173 | The console — sign in with a demo user (password `demo`; the username is the user's email address): `m.keller@northwind-financial.com` (architect), `j.cordes@northwind-financial.com` (migrator), `p.schmidt@northwind-financial.com` (pm · team Claims), `k.vogel@northwind-financial.com` (pgm), `a.weber@northwind-financial.com` (admin), `root@example.com` (padmin), `r.olson@northwind-financial.com` (architect — tenancy purely from Keycloak-org membership) |
| http://localhost:8180 | Keycloak (realm `mta`) — admin console with `admin` / `admin` |
| http://localhost:8080 | Hub API — `/openapi3.json`, Swagger UI at `/q/swagger-ui` |

**Credentials cheat-sheet** — every console/demo/test user has password
`demo` (defined in `hub-backend/keycloak/mta-realm.json`); the Keycloak
admin console is `admin` / `admin` (`KC_BOOTSTRAP_ADMIN_USERNAME/PASSWORD`
in compose.yaml); the `pipeline` service-account client has no user
password — it authenticates with the client secret `pipeline-secret`. All
of this is plain text in the checked-in realm file: fine for the demo
realm, rotate + inject secrets for anything production-bound.

**Sign-in is username-first** (the orgs feature adds an identification
step): username → *Sign In* → password → *Sign In*. The realm role of the
user you pick IS the persona; the token's org claims scope your view
(#41).

**Guided demo** — `demos/live/make-demo.sh` (workspace root) renders the scripted role
tour (architect → migrator → pm → pgm, captions + click markers + Clippy speech
bubbles, same format as `demos/mock/`) against this live stack and writes
`demos/live/mta-live-tour.gif` / `.webm`; scene list and captions are
editable in `demos/live/capture.mjs` / `demos/live/assemble.py`.

Smoke test without a browser:

```sh
T=$(curl -s http://localhost:8180/realms/mta/protocol/openid-connect/token \
  -d 'grant_type=password&client_id=mta-console&username=keller&password=demo&scope=openid' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
curl -H "Authorization: Bearer $T" http://localhost:5173/api/organizations   # via the console proxy
```

## Day-to-day

```sh
podman compose logs -f hub-backend    # per-service logs (also: keycloak, console, keycloak-bootstrap)
podman compose stop                   # stop, keep containers + data
podman compose start                  # resume
podman compose down                   # remove containers (PostgreSQL data + realm survive in volumes)
podman compose down -v                # also drop volumes — fresh DB AND fresh realm import on next up
podman compose up -d --build hub-backend console   # rebuild after editing backend/frontend sources
```

After editing **realm or membership state**, use `down -v` — the realm
lives in the PostgreSQL volume, and `--import-realm` skips existing realms
(a plain `up` would not re-import changes).

## Troubleshooting

- **Port 8180/8080/5173 in use** — likely a leftover DevServices Keycloak
  from `mvn test` (`podman ps`, `podman rm -f <container>`) or a host dev
  server; free the port, then `podman compose start`.
- **Console shows "Hub backend unavailable"** — `podman compose logs
  hub-backend`; the backend waits up to 45 s for Keycloak (realm import),
  and the console's Retry button re-runs the load.
- **`mvn test` fails to boot Keycloak** — the compose keycloak holds :8180;
  `podman compose stop keycloak keycloak-bootstrap` first, run the tests,
  then `podman compose start keycloak`.
- **Everything resolves but zero rows** — the token has no usable org
  claim; check `podman logs mta-console_keycloak-bootstrap_1` (memberships
  synced?) and the `mta-org` / `mta-orgs` claims in a token.

The ports are pinned by the realm file (redirect URIs / web origins for
:5173 and :8180) and the console's auth defaults — don't move them without
updating `hub-backend/keycloak/mta-realm.json`.

## Layout

- `ui-mockup/` is the **verified reference implementation** — the data
  source of truth and the fallback demo.
- `ui-react/` is the **React port of the mock**, kept in parallel; it
  extracts its data from the mock mechanically rather than forking it.
- `hub-backend/` implements the **Tackle Hub API contract v2.1** that the
  mock's OpenAPI card and implementation.md §9 specify — the API the mock's
  stores stand in for.

---

## `ui-mockup/` — the PatternFly 6 console mock

| What | Where |
|---|---|
| The mock itself (single file, ~1.1 MB, all CSS/JS/data inline) | [index.html](ui-mockup/index.html) |
| Behavior record: persona journeys, coverage matrix, defect log, live-console parity audit | [use-case-verification.md](ui-mockup/use-case-verification.md) |
| Plan for full functional parity with the live console (data layer + 10 work packages) | [parity-plan.md](ui-mockup/parity-plan.md) |
| Descriptive reference for the two example organizations (tenancy sample data) | [example-organizations.md](ui-mockup/example-organizations.md) |
| Relational projection of the mock's in-memory data stores (schema of record, maintained with the backend) | [hub-backend/schema.sql](hub-backend/schema.sql) |
| Animated guided tour (webm + gif) | [demos/](../demos/live/README.md) (live console) · [demos/mock/](../demos/mock/README.md) (mock) |
| Automated jsdom + headless-Chrome verification suites | [verify/](ui-mockup/verify/README.md) |

**What it is:** a navigable mock of the MTA console — 11 screens rendering
from in-memory stores with live cross-surface consistency (CRUD, filters,
sorting, pagination, wave aggregates), real RBAC (per-persona navigation,
guarded deep links, disabled verbs) and multi-tenancy (org → department →
team, #41), plus tours, help, an OpenAPI modal, and 8-language i18n with
RTL Arabic. Built on the genuine PatternFly 6.7.0 stylesheet and
`pf-v6-c-*` markup — no fake PF look, no `rh-*` web components (RHDS
crayon/space tokens style the mock's own layer).

**Running it:** open `index.html` via `file://` — it needs internet for the
PatternFly/fonts CDN. Every suggestion a pattern implements is cited by an
annotation badge (hidden by default; masthead switch or `&anno=1`).

**Verifying it:** the jsdom suites run from the `ui-mockup/` working
directory (per-suite index in `verify/README.md`); anything visual needs
headless Chrome. The edit → parse-check → jsdom → headless-Chrome workflow
and its landmines are documented in [AGENTS.md](../AGENTS.md).

## `ui-react/` — the React port

The full conversion of the mock into a real React app (decision
2026-11-15), **in parallel** — the HTML mock stays untouched and remains
the reference. Stack: Vite + React 19 + TypeScript +
`@patternfly/react-core` 6.7.0 (same PF6 line as the mock's stylesheet)
+ `@patternfly/react-table`, RHDS tokens and icon path data.

- **Data parity is mechanical:** `scripts/extract-data.mjs` regenerates
  `src/data/generated.ts` from the mock (wired into `predev`/`prebuild` —
  never hand-edit the generated file; it now only carries static chrome —
  RBAC scope literals live in `appState.tsx`).
- **Deep-link grammar preserved** (`#scr=…&persona=…&org=…&tab=…`, same
  precedence and tenancy clamps — `&persona=` clamps to the signed-in
  user's token persona); RBAC/tenancy are pure functions.
- All 10 screens ported and CDP-verified; i18n, annotation badges, the
  welcome tour, and the verification suites are not yet ported.
- **Keycloak-authenticated (2026-11-16):** sign-in screen (check-sso) →
  realm `mta` (public client `mta-console`, PKCE; Dev Services Keycloak on
  :8180 with the checked-in `hub-backend/keycloak/mta-realm.json`). The
  logged-in user's **realm role IS the persona** — the mock's persona
  switcher is replaced by a user chip + Sign out (demo users keller /
  cordes / schmidt / vogel / weber / root, password `demo`); the token's
  `organization`/`team` claims drive tenancy (#41).
- **Every screen is API-backed (2026-11-16):** the app is a hard client of
  `hub-backend` — all data (inventory, incidents, waves, agentic registries,
  tasks, controls) loads from the Quarkus API through `src/api/hub.tsx`
  (per-org fan-out + mock-shape adapters), with an error state + Retry when
  the backend is down and **no mock-data fallback**. Creates/deletes and
  incident triage are real writes; run lifecycle stays client-side (no hub
  verbs yet). Details and landmines (provider order, scope overrides): the
  "Live API" section of MIGRATION.md.

**Running it:** start `hub-backend` (`mvn quarkus:dev`, :8080 — auto-boots
PostgreSQL + Keycloak on :8180), then `npm run dev` / `npm run build` from
`ui-react/` (the dev server proxies `/api` → :8080). Sign in with a demo
user (password `demo`).
Status, per-screen porting notes, and probe landmines:
[MIGRATION.md](ui-react/MIGRATION.md).

## `hub-backend/` — the Tackle Hub API on Quarkus

A Quarkus implementation of the workspace's **Tackle Hub API contract
v2.1** — the parity-gated contract from the mock's Hub API card
(Suggestion #48) plus the §9.1 OpenAPI fragments of implementation.md,
extended with the core inventory/controls resources the mock's data model
needs (§8). Java 21, Quarkus 3.40, Hibernate ORM + Panache, PostgreSQL.

- **Keycloak auth in every profile (2026-11-16):** OIDC with the checked-in
  realm [keycloak/mta-realm.json](hub-backend/keycloak/mta-realm.json) —
  Dev Services boots it on :8180 in dev/test; `%prod` uses `KEYCLOAK_URL`.
  Roles map to scope bundles (`hub.role-mapping.*`); the `organization`/
  `team` claims drive tenancy; unauthenticated → 401 + WWW-Authenticate.
- Applications (CRUD, upsert, ETag/If-Match, analysis diff), writable
  triage, batch operations, SSE, and the §9.2 RBAC scope mapping.
- **Agentic + wave-content extension (2026-11-16):** gateways, skills,
  agents, workflows, workflow/agent runs (+ event logs, token/cost
  showback), platforms/targets, wave dependencies/evidence/tickets, and
  `/report/trend` — the entities the ui-react console renders. SeedData
  mirrors the mock's full dataset.
- **Scope note:** this implements the *workspace's* contract, not full
  upstream `tackle2-hub` parity (buckets, files, taskgroups, settings
  CRUD, addons are out of scope).

- **Schema of record:** [schema.sql](hub-backend/schema.sql) — Part 1 is the
  Hibernate-generated schema of the 35 entities / 45 tables (exported from
  DevServices PostgreSQL, verbatim; includes the promoted agentic,
  wave-content, platform/target, and trend entities); Part 2 keeps only the
  not-yet-entity-backed mock projection (run comparison, group↔wave
  addressing), with the mock-vs-entity divergences documented. Runtime truth
  stays Hibernate generation; the file is the reviewed baseline. Referential
  gaps it surfaced in the mock's sample data are recorded in its header.

**Running it:** `mvn test` / `mvn clean package` from `hub-backend/`;
tests boot a real PostgreSQL via DevServices (podman socket). Contract
and run docs: [hub-backend/README.md](hub-backend/README.md).
