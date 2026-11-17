// Application state — the React port of the mock's `state` object + applyHash/syncHash.
// Deep-link grammar is preserved: #scr=…&persona=…&org=…&dept=…&team=…&arch=…&tab=…&scheme=…&lang=…&anno=1
// (&tab= applies to agentic/config/incidents, exactly like the mock's applyHash)
// <p>
// Tenancy + the app/credential registries are INSTALLED at runtime by the hub
// data layer (src/api/hub.tsx) — the backend is the source of truth. The
// install happens before any render (HubProvider gates rendering), so the
// module-level registries below are safe.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { PERSONA_LABEL, RBAC as GENERATED_RBAC, ARCH_APP } from '../data/generated';
import { authUser } from '../api/auth';
import { LANG_META } from '../i18n/i18n';

/* ---------- RBAC scopes (hand-written — NOT generated) ----------
   generated.ts is re-extracted from the mock on every build, so the backend-
   matching scope literals live HERE: resource:verb exactly as the hub's
   @Scopes annotations expect. '*' stays frontend-only; the API client expands
   it to the full set (src/api/client.ts ALL_SCOPES). */
const SCOPE_OVERRIDES: Record<string, string[] | '*'> = {
  architect: ['applications:read', 'applications:create', 'applications:update', 'applications:delete',
    'analyses:read', 'analyses:create', 'triage:read', 'triage:write', 'waves:read', 'waves:update',
    'identities:read', 'identities:create', 'identities:update', 'identities:delete',
    'tasks:read', 'reports:read', 'business-services:read', 'archetypes:read', 'tags:read',
    'analysis-profiles:read', 'workflow-runs:read', 'workflow-runs:create', 'agent-runs:read',
    'agents:read', 'agents:create', 'agents:update', 'skills:read', 'skills:create', 'skills:update',
    'workflows:read', 'workflows:create', 'workflows:update', 'gateways:read',
    /* mock client-side verbs (no backend endpoint — UI affordance gates only,
       mirrors the mock's RBAC so buttons match the reference for this persona) */
    'runs:create', 'runs:cancel', 'runs:pause', 'identities:edit', 'identities:verify',
    'platforms:read', 'targets:read', 'teams:read', 'stakeholders:read', 'stakeholder-groups:read',
    'job-functions:read', 'organizations:read'],
  pm: ['applications:read', 'analyses:read', 'triage:read', 'incidents:read', 'waves:read',
    'tasks:read', 'reports:read', 'teams:read', 'business-services:read', 'archetypes:read',
    'tags:read', 'organizations:read'],
  pgm: ['applications:read', 'analyses:read', 'triage:read', 'incidents:read', 'waves:read',
    'tasks:read', 'reports:read', 'teams:read', 'departments:read', 'business-services:read',
    'archetypes:read', 'tags:read', 'organizations:read', 'stakeholders:read', 'stakeholder-groups:read'],
  migrator: ['applications:read', 'applications:create', 'applications:update',
    'analyses:read', 'analyses:create', 'triage:read', 'triage:write', 'incidents:read',
    'waves:read', 'identities:read', 'identities:create', 'identities:update', 'identities:delete',
    'tasks:read', 'workflow-runs:read', 'workflow-runs:create', 'agent-runs:read', 'agents:read',
    'skills:read', 'workflows:read', 'gateways:read', 'reports:read', 'business-services:read',
    'tags:read', 'teams:read',
    /* mock client-side verbs (see architect note above) */
    'runs:create', 'runs:cancel', 'runs:pause', 'tasks:cancel', 'identities:edit', 'identities:verify'],
  admin: '*',
  padmin: '*',
};
export const RBAC = Object.fromEntries(
  Object.entries(GENERATED_RBAC).map(([p, r]) => [p, { ...r, scopes: SCOPE_OVERRIDES[p] ?? r.scopes }])
) as typeof GENERATED_RBAC;

export type Persona = keyof typeof PERSONA_LABEL;
export type ArchLevel = 'app' | 'team' | 'dept' | 'org';

export interface AppState {
  scr: string;
  persona: Persona;
  org: string;
  dept: string;
  team: string;            // '' = all teams in scope
  archLevel: ArchLevel;
  agTab?: string;          // agentic tab (deep-linked &tab=, mock's agTabApply)
  cfgTab?: string;         // config tab (deep-linked &tab=, mock's setCfgTab)
  invTab?: string;         // inventory tab (deep-linked &tab=archetypes)
  scheme: 'light' | 'dark';
  anno: boolean;
  lang: string;            // UI locale (mock's 8-locale set; EN = identity, AR flips RTL)
}

/* ---------- org/dept/team resolution (installed from the hub) ---------- */
export interface TeamRec { id: string; name: string; members: { architects: string[]; pms: string[]; migrators: string[] }; org: string; dept: string }
export interface OrgRec { id: string; name: string; departments: Array<{ id: string; name: string; teams: Omit<TeamRec, 'org' | 'dept'>[] }> }

export const ORGS: OrgRec[] = [];
export const ORG_BY_ID: Record<string, OrgRec> = {};
export const TEAM_BY_ID: Record<string, TeamRec> = {};
export const TEAM_HOME = { org: '', dept: '', team: '' };

export function installTenancy(tenancy: { orgs: OrgRec[] }, home?: { org: string; dept: string; team: string }) {
  ORGS.length = 0;
  for (const k of Object.keys(ORG_BY_ID)) delete ORG_BY_ID[k];
  for (const k of Object.keys(TEAM_BY_ID)) delete TEAM_BY_ID[k];
  tenancy.orgs.forEach(o => {
    ORGS.push(o);
    ORG_BY_ID[o.id] = o;
    o.departments.forEach(dp => dp.teams.forEach(t => {
      TEAM_BY_ID[t.id] = { ...t, org: o.id, dept: dp.id };
    }));
  });
  if (home && ORG_BY_ID[home.org]) {
    TEAM_HOME.org = home.org;
    TEAM_HOME.dept = home.dept;
    TEAM_HOME.team = home.team;
  } else {
    const firstOrg = ORGS[0];
    if (firstOrg) {
      const firstDept = firstOrg.departments[0];
      TEAM_HOME.org = firstOrg.id;
      TEAM_HOME.dept = firstDept?.id ?? '';
      TEAM_HOME.team = firstDept?.teams[0]?.id ?? '';
    }
  }
}

/* ---------- app/credential registries (installed from the hub) ---------- */
import type { AppRow, CredRow } from '../api/hub';
export const APPS_LIST: AppRow[] = [];
export const CREDS_LIST: CredRow[] = [];

export function installHub(apps: AppRow[], creds: CredRow[]) {
  APPS_LIST.length = 0;
  apps.forEach(a => APPS_LIST.push(a));
  CREDS_LIST.length = 0;
  creds.forEach(c => CREDS_LIST.push(c));
}

/* ---------- RBAC (port of canView/can) ---------- */
export function canView(persona: Persona, v: string): boolean {
  return (RBAC[persona] || RBAC.architect).views.includes(v);
}
export function can(persona: Persona, verb: string, res: string): boolean {
  if (res === 'tenants') return persona === 'padmin';
  const r = RBAC[persona] || RBAC.architect;
  return r.scopes === '*' || (r.scopes as string[]).includes(res + ':' + verb);
}

/* ---------- tenancy clamps (ports of teamLockScope / archClampScope) ---------- */
export function clamp(state: AppState): AppState {
  let s = { ...state };
  // roles define persona: the Keycloak realm role wins over any &persona= deep link
  const tokenPersona = authUser()?.persona;
  if (tokenPersona && s.persona !== tokenPersona) s = { ...s, persona: tokenPersona, scr: tokenPersona !== state.persona ? 'home' : s.scr };
  if (!ORG_BY_ID[s.org]) s.org = TEAM_HOME.org || ORGS[0]?.id || '';
  const org = ORG_BY_ID[s.org];
  if (org) {
    if (!org.departments.some(d => d.id === s.dept)) s.dept = org.departments[0]?.id ?? '';
    if (s.team && (!TEAM_BY_ID[s.team] || TEAM_BY_ID[s.team].org !== s.org)) s.team = '';
    if (s.team) s.dept = TEAM_BY_ID[s.team].dept;
  }
  if (s.persona === 'pm' || s.persona === 'migrator') {
    s = { ...s, org: TEAM_HOME.org, dept: TEAM_HOME.dept, team: TEAM_HOME.team };  // team-scoped personas pin to their home team (#41)
  }
  if (s.persona === 'architect') {
    // responsibility level clamps the scope (#41): app/team pin to the sampled app's team,
    // dept clears the team selection, org leaves the org-wide view
    const appTeam = TEAM_BY_ID[APPS_LIST.find(a => a.name === ARCH_APP)?.team ?? ''];
    if (s.archLevel === 'app' || s.archLevel === 'team') {
      if (appTeam) s = { ...s, dept: appTeam.dept, team: appTeam.id };
    } else if (s.archLevel === 'dept') {
      s = { ...s, team: '' };
    }
  }
  return s;
}

/* ---------- hash grammar ---------- */
function parseHash(): AppState {
  const p = new URLSearchParams(window.location.hash.slice(1));
  /* persona defaults to the TOKEN role, not architect: a hash without &persona=
     (demo captures, the tour's Open-view, any deep link) must keep the signed-in
     role — defaulting to architect made clamp() redirect every non-architect
     user's hash navigation back to home (state === s made the persona-change
     test always true). An explicit foreign &persona= still clamps to home. */
  const persona = (p.get('persona') || authUser()?.persona || 'architect') as Persona;
  const orgP = p.get('org');
  const firstOrg = ORGS[0];
  let org = orgP && ORG_BY_ID[orgP] ? orgP : (TEAM_HOME.org || firstOrg?.id || '');
  let dept = p.get('dept') || ORG_BY_ID[org]?.departments[0]?.id || '';
  let team = p.get('team') || '';
  let archLevel = (['app', 'team', 'dept', 'org'] as const).includes(p.get('arch') as ArchLevel)
    ? (p.get('arch') as ArchLevel) : 'org';
  const scheme = (p.get('scheme') === 'dark' || localStorage.getItem('mta.scheme') === 'dark') ? 'dark' : 'light';
  const langP = p.get('lang');
  const lang = (langP && langP in LANG_META) ? langP
    : (Object.keys(LANG_META).includes(localStorage.getItem('mta.lang') || '') ? localStorage.getItem('mta.lang') as string : 'en');
  let s: AppState = {
    scr: p.get('scr') || 'home',
    persona,
    org, dept, team,
    archLevel,
    agTab: p.get('tab') || undefined,
    cfgTab: p.get('tab') || undefined,
    invTab: p.get('tab') || undefined,
    scheme,
    anno: p.get('anno') === '1',
    lang,
  };
  s = clamp(s);
  return s;
}

function syncHash(s: AppState) {
  const p = new URLSearchParams();
  p.set('scr', s.scr);
  if (s.persona !== 'architect') p.set('persona', s.persona);
  if (s.org !== (TEAM_HOME.org || ORGS[0]?.id)) p.set('org', s.org);
  if (s.dept !== ORG_BY_ID[s.org]?.departments[0]?.id) p.set('dept', s.dept);
  if (s.team) p.set('team', s.team);
  if (s.persona === 'architect' && s.archLevel !== 'org') p.set('arch', s.archLevel);
  if (s.scr === 'agentic' && s.agTab && s.agTab !== 'wfruns') p.set('tab', s.agTab);
  if (s.scr === 'config' && s.cfgTab && s.cfgTab !== 'controls') p.set('tab', s.cfgTab);
  if (s.scr === 'inventory' && s.invTab && s.invTab !== 'apps') p.set('tab', s.invTab);
  if (s.scheme === 'dark') p.set('scheme', 'dark');
  if (s.anno) p.set('anno', '1');
  if (s.lang !== 'en') p.set('lang', s.lang);
  const h = '#' + p.toString().replace(/%3D/g, '=');
  if (window.location.hash !== h) history.replaceState(null, '', h);
}

interface AppCtx {
  state: AppState;
  set: (patch: Partial<AppState>) => void;
}
const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(parseHash);

  // hashchange → state (deep links win, like applyHash)
  useEffect(() => {
    const on = () => setState(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  // state → hash + dark class + persistence
  useEffect(() => {
    syncHash(state);
    document.documentElement.classList.toggle('pf-v6-theme-dark', state.scheme === 'dark');
    document.documentElement.lang = state.lang;   // the i18n layer owns dir (AR → rtl)
    try { localStorage.setItem('mta.scheme', state.scheme); } catch { /* private mode */ }
  }, [state]);

  const value = useMemo<AppCtx>(() => ({
    state,
    set: patch => setState(prev => clamp({ ...prev, ...patch })),
  }), [state]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp outside AppProvider');
  return ctx;
}

/* ---------- scoping (ports of scopedApps / scopedCreds / tenancyPath) ---------- */
export function useScoped() {
  const { state } = useApp();
  return useMemo(() => {
    let apps = APPS_LIST.filter(a => TEAM_BY_ID[a.team]?.org === state.org && (!state.team || a.team === state.team));
    if (state.persona === 'architect' && state.archLevel === 'app') apps = apps.filter(a => a.name === ARCH_APP);
    const creds = CREDS_LIST.filter(c => { const t = TEAM_BY_ID[c.team as string]; return t && t.org === state.org && (!state.team || c.team === state.team); });
    const o = ORG_BY_ID[state.org];
    const dp = o?.departments.find(d => d.id === state.dept) || o?.departments[0];
    const t = state.team ? TEAM_BY_ID[state.team] : null;
    const path = `${o?.name ?? ''} · ${dp?.name ?? ''}${t ? ' · ' + t.name : ' · all teams'}${state.persona === 'architect' && state.archLevel === 'app' ? ' · app ' + ARCH_APP : ''}`;
    return { apps, creds, path };
  }, [state]);
}
