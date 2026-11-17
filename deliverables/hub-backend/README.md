# hub-backend — Tackle Hub API on Quarkus + PostgreSQL

A Quarkus implementation of the **Tackle Hub API (contract v2.1)** as specced
in this workspace — the parity-gated contract from the mock's Hub API card
(Suggestion #48) plus the §9.1 OpenAPI fragments of `implementation/implementation.md`,
extended with the core inventory/controls
resources the mock's data model needs (§8). Java 21, Quarkus 3.40, Hibernate
ORM + Panache, PostgreSQL.

**Scope note:** this implements the *workspace's* contract, not full upstream
tackle2-hub parity (buckets, files, taskgroups, settings CRUD, addons are
out of scope — see the "Not implemented" list below).

## Run

Prefer the full stack in containers (PostgreSQL + Keycloak + this API + the
React console, one command, no host toolchain)? See
[../README.md → "Run everything with podman compose"](../README.md) —
`cd .. && podman compose up --build -d`.

```sh
# dev mode (DevServices starts a PostgreSQL container automatically;
# requires podman/docker — the podman socket is used on this machine)
mvn quarkus:dev

# package + run against a real PostgreSQL
mvn clean package
QUARKUS_DATASOURCE_JDBC_URL=jdbc:postgresql://localhost:5432/hub \
QUARKUS_DATASOURCE_USERNAME=hub QUARKUS_DATASOURCE_PASSWORD=hub \
java -jar target/quarkus-app/quarkus-run.jar
```

Tests: `mvn test` (25 tests; DevServices boots a fresh, seeded PostgreSQL
per run — drop-and-create in the `%test` profile).

First boot seeds the **mock's full dataset** (rewritten 2026-11-16 to mirror
`deliverables/ui-mockup/index.html` byte-for-byte where the entities model it):
`northwind-financial` / `meridian-health`, departments/teams, stakeholders,
tags, archetypes, the 15 applications (risk kinds, platforms, identities,
credentials), waves 1–4 with dependencies/evidence/tickets, incidents with
triage states, tasks (incl. the quota-blocked/failed rows), analysis runs,
trend points, and the **agentic registries** (gateways, skills, agents,
workflows, workflow/agent runs with token/cost showback + event logs) —
only when the database is empty (`hub.seed.enabled=false` disables). This is
the dataset `../ui-react` renders against.

## Schema of record (`schema.sql`)

[schema.sql](schema.sql) is the checked-in schema baseline — the reference for
reviews, contract work, and future migrations (refreshed 2026-11-16):

- **Part 1 — implemented:** the Hibernate-generated schema of the **35 JPA
  entities** in `model/` (45 tables including the 10 join tables), exported
  verbatim via `pg_dump` from the DevServices PostgreSQL. At runtime Hibernate
  generation is the source of truth (dev `update`, test `drop-and-create`) —
  this file is *not* an init script; don't point Quarkus at it.
- **Part 2 — designed, not yet entity-backed:** only what no entity models
  yet — run comparison (`analysis_run`, `run_diff`) and stakeholder-group
  wave addressing. Everything else the first cut designed (agentic layer,
  wave content, trend, credential expiry) was **promoted into Part 1** as
  entities landed.
- The header also documents the mock-vs-entity divergences (e.g. `identity`
  merges the mock's identity + credential — now *including* expiry/
  verification columns; `incident` carries triage inline per
  implementation.md §8.2; `application.analysisstate` vs the mock's render
  states) and the referential gaps surfaced in the mock's sample data
  (including `CREDS.usedBy` display strings contradicting the app store).

To refresh Part 1 after entity changes: `mvn quarkus:dev` (DevServices boots
PostgreSQL), then `podman exec <container> pg_dump -U quarkus -d quarkus
--schema-only` from that container.

## Contract semantics implemented (v2.1)

| Semantics | Where |
|---|---|
| Unauthenticated → `401` + `WWW-Authenticate`, never a redirect | `%prod` HTTP `authenticated` policy + OIDC |
| Mutations send `ETag`, honor `If-Match`, conflict → `412` | `Responses` helper; `PUT /applications/{id}`, `/analysis-profiles/{id}` |
| Structured error bodies with stable codes | `ApiException` + mapper: `resource.not-found`, `resource.in-use`, `resource.duplicate`, `precondition.failed`, `validation.failed`, `scope.denied`, `tenant.mismatch` |
| Upsert: `POST /applications?upsert=true` keyed on name (`201`/`200`/`409`) | `ApplicationResource` |
| Reverse relations: `/tags/{id}/applications` | `TagResource` |
| Pagination metadata `{items, totalCount, page, size}` | every collection |
| OpenAPI served at `/openapi3.json` | smallrye-openapi |

## Endpoints

- **Inventory** — `/applications` (CRUD + upsert + `/analysis/diff`),
  `/platforms`, `/targets`, `/tags` (+ reverse relation), `/tag-types`,
  `/business-services`, `/archetypes`, `/waves`, `/report/effort?groupBy=…`,
  `/report/trend` (trend-point series for the landing chart), `/report/dashboard`
  (deprecated, `Deprecation`/`Sunset` headers)
- **Analysis** — `/analyses` (list/queue), `/analyses/incidents`,
  `/analyses/{id}/triage`, `/incidents/{incidentKey}/triage` (writable
  triage, §9.1 anchor), `/analysis-profiles`
- **Batch & events** — `/batch/tags` (202), `/batch/analyses` (202 →
  taskgroup ref), `/events` (SSE, `?kind=` filter), `/user-settings`
  (self-scoped, merge semantics), `/tasks` (+ `/tasks/health` queue health #30)
- **Automation/controls** — `/manifests` (#33 item 11), `/webhooks` (+
  `/deliveries` log + replay), `/identities` (credentials, secret
  write-only; expiry/verification/description for the Credentials screen),
  `/stakeholders`, `/stakeholder-groups`, `/job-functions`,
  `/teams`, `/departments`, `/organizations` (padmin write), `/audit` (#42
  trail, padmin read)
- **Agentic (console extension, 2026-11-16)** — `/gateways`, `/skills`,
  `/agents` (+skills binding), `/workflows`, `/workflow-runs`,
  `/agent-runs` (+ per-run event log; token/cost showback #20),
  `/wave-dependencies`, `/wave-evidence`, `/wave-tickets` (wave content
  #46)

## RBAC + tenancy

- Scopes are `resource:verb` strings (§9.2). They derive from the token's
  `mta-scopes` claim (test/automation users) **merged with** realm roles via
  `hub.role-mapping.<role>` config — six role bundles are preconfigured
  (`migrator`, `architect`, `pm`, `pgm`, `admin`, `padmin`, plus a
  `pipeline` automation identity). New scopes only need a config entry; the
  Keycloak realm packages the role bundles once.
- Tenancy (#41): the token's `organization` claim (optionally `team`)
  clamps every list and single-resource read. Non-admin cross-tenant reads
  → `403 tenant.mismatch`; the platform admin (`padmin` role) may pivot
  across organizations (explicit `?organization=<id>`) and **every such
  access appends to the audit trail (#42)**. Guarded deletes honor the
  exactly-one-team invariant (applications, credentials) and the
  team-staffing source of stakeholders.

## Authentication (Keycloak, all profiles)

Auth is OIDC everywhere — dev and test boot **Dev Services for Keycloak**
with the checked-in realm [keycloak/mta-realm.json](keycloak/mta-realm.json)
(pinned to `http://localhost:8180/realms/mta`); `%prod` points at a real
Keycloak via `KEYCLOAK_URL`. Unauthenticated calls return `401` +
`WWW-Authenticate` in every profile; only `/openapi3.json` and `/q/*` are
public.

- **Clients**: `mta-console` (public, SPA — the React console; PKCE, also
  direct-access grants for tests/curl) and `mta-hub` (bearer-only resource
  server), plus `pipeline` (confidential service account).
- **Roles define the persona**: realm roles map to scope bundles via
  `hub.role-mapping.*`; demo users exist per persona and their **usernames are
  their email addresses** — `m.keller@northwind-financial.com` (architect),
  `j.cordes@northwind-financial.com` (migrator), `p.schmidt@northwind-financial.com`
  (pm, team claim `Claims`), `k.vogel@northwind-financial.com` (pgm),
  `a.weber@northwind-financial.com` (admin), `root@example.com` (padmin) —
  all password `demo` (as are the test fixtures, which keep short names:
  `arch`, `chen`, `mig`, `pm`, `admin`, `padmin`, `someone-else`, `limited`,
  `test-architect`). The Keycloak admin console (compose: `admin`/`admin`)
  and the `pipeline` client secret (`pipeline-secret`) are also plain text
  in the realm file — demo credentials only, rotate and inject for anything real.
- **Organizations**: the realm enables the Keycloak *Organizations* feature
  (northwind-financial / meridian-health, matching the #41 tenancy sample).
  Org memberships are NOT realm-importable — [keycloak/sync-org-members.sh](keycloak/sync-org-members.sh)
  (idempotent kcadm script; the compose stack runs it as an init service)
  adds them. Demo user `olson` (architect) carries NO organization
  attribute — his tenancy comes purely from org membership.
- **Claims**: `mta-org` (organization display name, from the user
  attribute) and `team` drive tenancy, with native `mta-orgs` (Keycloak-org
  membership aliases) as the membership-derived source — `TenantScope`
  tries the attribute claim first, then resolves aliases against the seeded
  orgs. `mta-scopes` (mapped from the `scopes` user attribute) carries
  extra scopes for test/automation users. Claims are read from the JWT
  principal (`TokenClaims`) — quarkus-oidc does not propagate them to
  identity attributes.
- Dev/test REST tests authenticate with `Tokens.of("<user>")` — a password
  grant against the DevServices Keycloak; realm users carry the scope sets /
  org claims the tests need (see `src/test/java/.../Tokens.java`).

```sh
# obtain a token (direct-access grant on mta-console)
curl -s http://localhost:8180/realms/mta/protocol/openid-connect/token \
  -d 'grant_type=password&client_id=mta-console&username=m.keller%40northwind-financial.com&password=demo&scope=openid'
# call the API with it
curl -H "Authorization: Bearer <token>" http://localhost:8080/applications
```

Note: with OIDC enabled but the auth server unreachable, unauthenticated
calls return 500 (deployment misconfiguration), not 401 — point
`KEYCLOAK_URL` at a live realm.

## Known limitations (deliberate)

- Schema via `database.generation=update` (dev convenience) — production
  should switch to Flyway/Liquibase migrations.
- Events are in-process (single node); a clustered deployment swaps
  `EventBroadcaster` for a Kafka/AMQP bridge without contract change.
- Webhook deliveries are logged and replayable, but no HTTP dispatcher is
  wired yet (the contract surface is).
- Triage *history* table (§8.2) not yet modeled — triage state + actor +
  timestamp are recorded on the incident; the audit trail captures the
  state transitions.
- No run-lifecycle verbs (pause/resume/cancel) and no run-record deletion —
  the ui-react console keeps those client-side (documented in its
  MIGRATION.md); `/tasks` is read-only.
- Not implemented (full upstream parity): buckets, files, taskgroups,
  settings CRUD, addons, proxies, metrics, assessment/review entities.
