/* Hub data layer — loads EVERYTHING from the Quarkus backend and adapts the
   responses to the render shapes the screens consume (the shapes generated.ts
   captured from the mock). Hard API dependency: HubProvider renders an error
   state with retry when the backend is unreachable; there is no mock fallback.
   <p>
   Data stays data: the adapters derive display strings (ages, expiry chips,
   wave numbers) from backend state, never the other way around. */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, listAll } from './client';
import { authUser, type AuthUser } from './auth';
import { installHub, installTenancy } from '../state/appState';
import { ARCH_APP } from '../data/generated';   // static chrome: the arch-application anchor (#41)

/* ---------- shapes the screens consume ---------- */
export interface AppRow {
  id: string;
  name: string; tag: string; state: 'succeeded' | 'running' | 'quota' | 'notstarted' | 'failed';
  incidents?: number; pts?: number; ptsNote?: string; pct?: number;
  risk?: string; riskColor?: string; riskKind: 'own' | 'inherited' | 'unassessed' | 'none';
  wave: string; bsvc: string; age?: number | null; stale?: boolean;
  archetype: string; platform?: string; creds: string; repo: string; binary: string;
  tags: string; assess?: string; review: string; team: string; credName?: string;
}
export interface CredRow {
  name: string; kind: string; team: string; expires: string; expLabel: string; expColor: string;
  lastUsed: string; verifiedLabel: string; verColor: string; usedBy: string;
}
export type IncRow = [string, string, string, string, string, string, string?]; // title, pts, state, color, tracker, trackerColor, incidentKey
export interface IncidentGroup { total: number; pts: string; rows: IncRow[] }
export interface TicketRow { title: string; key: string; outcome: string; oc: string; detail: string; when: string; drawer?: boolean }
export interface EvidenceRow { cov: string; total: number; run: number; red: number }
export interface WaveRow { id: string; name: string; position: number; start: string; end: string; members: string[] }
export interface DepRow { from: string; to: string; verb: string }
export interface TrendRow { date: string; open: number; pass: number }
export interface TaskRow {
  id: string; app: string; state: 'Failed' | 'Queued' | 'Running' | 'Postponed' | 'Succeeded' | 'Canceled';
  kind: string; ageMin: number; age: string; decision: string; errorCode?: string; quota?: string;
}
export interface WfRunRow { id: string; name: string; wf: string; app: string; phase: string; stages: string; state: string; age: string; duration: string; canonical?: boolean; reason?: string }
export interface AgentRunRow {
  id: string; name: string; agent: string; app: string; phase: string; state: string; reason: string;
  duration: string; gw: string; model: string; tokens: string; tokDetail: string; cost: string;
  image: string; wr: string; age: string; events: string[][];
}
export interface AgentRow { id: string; name: string; image: string; gateways: string; skills: string; params: number; ready: boolean; age: string }
export interface SkillRow { id: string; name: string; display: string; desc: string; type: string; source: string; ready: boolean; tags: string; age: string }
export interface WorkflowRow { id: string; name: string; stages: number; guide: string; ready: boolean; age: string }
export interface GatewayRow {
  name: string; model: string; endpoint: string; ctx: string; cred: string; ready: boolean;
  tier: string; health: string; healthAge: string; runs30d: string; tokens30d: string; rate: string; consumers: string;
}
export interface BsvcRow { id: string; name: string; description: string; owner: string }
export interface ArchRow { id: string; name: string; description: string; tags: string[]; criteria: string[]; memberCount: number }
export interface GroupRow { name: string; description: string; members: string[]; waves: string[] }
export interface TagRow { name: string; category: string }
export interface FunctionRow { name: string }
export interface PlatformRow { name: string; type: string }
export interface TargetRow { name: string; langs: string }
export interface RegIdentityRow { name: string; desc: string; type: string }
export interface StakeRow { name: string; org: string; email: string; func: string; bsvcs: string[] }
export interface AuditRow { ts: string; actor: string; action: string; target: string }

export interface HubData {
  apps: AppRow[];
  creds: CredRow[];
  incidents: Record<string, IncidentGroup>;
  tickets: Record<string, TicketRow>;
  evidence: Record<string, EvidenceRow>;
  deps: DepRow[];
  waves: WaveRow[];
  trend: TrendRow[];
  tasks: TaskRow[];
  wfruns: WfRunRow[];
  agentRuns: AgentRunRow[];
  agents: AgentRow[];
  skills: SkillRow[];
  workflows: WorkflowRow[];
  gateways: GatewayRow[];
  bsvcs: BsvcRow[];
  archetypes: ArchRow[];
  /* real team UUIDs (the tenancy tree carries display slugs) — needed for
     write bodies like POST /applications { teamId } */
  teams: { id: string; name: string; org: string }[];
  groups: GroupRow[];
  tags: TagRow[];
  functions: FunctionRow[];
  platforms: PlatformRow[];
  targets: TargetRow[];
  regIdentities: RegIdentityRow[];
  stakeholders: StakeRow[];
  audit: AuditRow[];
}

/* ---------- helpers ---------- */
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function ageDays(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d < 0 ? 0 : d;
}
function relText(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
/** ISO-8601 duration (PT2H41M) → minutes. */
function durationMin(iso: string | undefined | null): number {
  if (!iso) return 0;
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso);
  if (!m) return 0;
  return (+(m[1] || 0)) * 1440 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)) + (+(m[4] || 0)) / 60;
}
function durationText(min: number): string {
  if (min >= 60) return `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;
  return `${Math.max(1, Math.round(min))}m`;
}
const fmt = (n: number) => n.toLocaleString('en-US');

const REVIEW_MAP: Record<string, string> = { NOT_STARTED: 'notstarted', PENDING: 'pending', APPROVED: 'approved' };
const RISK_COLOR: Record<string, string> = { High: 'red', Medium: 'yellow', Low: 'green' };
const TRIAGE_STATE: Record<string, [string, string]> = {
  TRIAGE: ['Triage', 'outline'], IN_PROGRESS: ['In progress', 'yellow'], ASSIGNED: ['Assigned', 'teal'],
  FALSE_POSITIVE: ['False positive', 'grey'], RESOLVED: ['Resolved', 'green'],
};

/* ---------- raw backend response types (fields we read) ---------- */
interface OrgV { id: string; name: string }
interface DeptV { id: string; name: string; organization: string }
interface TeamV { id: string; name: string; department: string; organization: string; members: string[] }
interface StakeV { id: string; name: string; email: string; jobFunction: string | null; organization: string; teams: string[] }
interface AppV {
  id: string; name: string; businessService: string; team: string; teamId: string; organization: string;
  archetype: string | null; tags: string[]; analysisState: string; effort: number; risk: string | null;
  riskKind: string; platform: string | null; repositoryType: string; binaryArtifact: boolean;
  assessmentVersion: string | null; reviewState: string; identity: string | null; credential: string | null;
  incidents: number; progress: number | null; updatedAt: string;
}
interface AnalysisV { id: string; application: string; status: string; completedAt: string | null }
interface IncidentV {
  incidentKey: string; application: string; ruleset: string; rule: string; effort: number;
  state: string; triageComment: string | null;
}
interface TaskV {
  id: string; kind: string; state: string; label: string; application: string | null;
  errorCode: string | null; errorMessage: string | null; quota: string | null; age: string; triggeredBy: string | null;
}
interface WaveV { id: string; name: string; position: number; startDate: string; endDate: string; members: string[] }
interface ArchV { id: string; name: string; description: string | null; tags: string[]; membershipCriteria: string[]; memberCount: number }
interface TicketV { id: string; application: string; title: string; key: string | null; outcome: string; detail: string | null; whenText: string | null }
interface EvidenceV { id: string; application: string; coverage: string; total: number; run: number; red: number }
interface DepV { id: string; from: string; to: string; verb: string }
interface TrendV { date: string; open: number; pass: number }
interface WfRunV { id: string; name: string; workflow: string; application: string; phase: string; stages: number; state: string; age: string; duration: string | null; canonical: boolean }
interface AgentRunV {
  id: string; name: string; agent: string; application: string; workflowRun: string; phase: string; state: string;
  reason: string | null; duration: string | null; gateway: string; model: string; tokens: string | null;
  tokDetail: string | null; cost: string | null; image: string | null; age: string; events: [string, string][] | null;
}
interface AgentV { id: string; name: string; image: string; gateway: string; tierPin: string | null; skills: string[]; params: number; ready: boolean; age: string }
interface SkillV { id: string; name: string; display: string; description: string; type: string; source: string; ready: boolean; tags: string | null; age: string }
interface WorkflowV { id: string; name: string; stages: number; guide: string | null; ready: boolean; age: string }
interface GatewayV {
  id: string; name: string; model: string; endpoint: string; ctx: string | null; cred: string | null; ready: boolean;
  tier: string | null; health: string | null; healthAge: string | null; runs30d: number; tokens30d: string | null;
  rate: string | null; consumers: string;
}
interface BsvcV { id: string; name: string; description: string | null; owner: string | null }
interface GroupV { id: string; name: string; description: string | null; members: string[] }
interface TagV { id: string; name: string; tagType: string }
interface FunctionV { id: string; name: string }
interface PlatformV { id: string; name: string; type: string }
interface TargetV { id: string; name: string; langs: string }
interface IdentityV {
  id: string; name: string; kind: string; organization: string; team: string | null;
  lastUsed: string | null; expiresOn: string | null; verified: boolean; description: string | null; usedBy: number;
}
interface AuditV { actor: string; action: string; resourceType: string; resourceId: string; detail: string | null; at: string }

/* ---------- the loader ---------- */
export async function loadAll(): Promise<HubData> {
  const me = authUser();

  // 1. organizations first (tenant-scoped reads fan out per org). Non-padmin
  //    users only see their token's organization — the backend clamps to the
  //    token claims regardless (?organization= is honored for padmin pivots).
  //    Org claims come in two shapes: legacy display-name string (`mta-org`)
  //    or native Keycloak-org aliases (`mta-orgs`, which equal the org
  //    slug/id used in tenancy state).
  const allOrgs = await listAll<OrgV>('/organizations');
  const mine = me && me.persona !== 'padmin' && (me.orgName || me.orgAliases.length);
  const orgs = !mine
    ? allOrgs
    : allOrgs.filter(o => me.orgAliases.length ? me.orgAliases.includes(slug(o.name)) : o.name === me.orgName);

  const per = async <T,>(path: string, org?: OrgV): Promise<T[]> =>
    listAll<T>(path + (org ? `${path.includes('?') ? '&' : '?'}organization=${org.id}` : ''));

  const orgReads = await Promise.all(orgs.map(async o => {
    const [depts, teams, stakes, groups, bsvcs, tags, funcs, archs, waves, analyses, tasks, incidents, ids, audit, apps] =
      await Promise.all([
        per<DeptV>('/departments', o),
        per<TeamV>('/teams', o),
        per<StakeV>('/stakeholders', o),
        per<GroupV>('/stakeholder-groups', o),
        per<BsvcV>('/business-services', o),
        per<TagV>('/tags', o),
        per<FunctionV>('/job-functions', o),
        per<ArchV>('/archetypes', o).catch(() => []),
        per<WaveV>('/waves', o),
        per<AnalysisV>('/analyses', o),
        per<TaskV>('/tasks', o),
        per<IncidentV>('/analyses/incidents', o),
        per<IdentityV>('/identities', o),
        per<AuditV>('/audit', o).catch(() => []),   // padmin-only scope
        per<AppV>('/applications', o),
      ]);
    return { org: o, depts, teams, stakes, groups, bsvcs, tags, funcs, archs, waves, analyses, tasks, incidents, ids, audit, apps };
  }));

  // 2. global surfaces (no tenancy)
  const [trend, wfrunsRaw, agentRunsRaw, agents, skills, workflows, gateways, platformsRaw, targetsRaw, deps, evidence] =
    await Promise.all([
      api<TrendV[]>('/report/trend').catch(() => [] as TrendV[]),  /* raw array — NOT paged */
      per<WfRunV>('/workflow-runs'),
      per<AgentRunV>('/agent-runs'),
      per<AgentV>('/agents'),
      per<SkillV>('/skills'),
      per<WorkflowV>('/workflows'),
      per<GatewayV>('/gateways'),
      per<PlatformV>('/platforms'),
      per<TargetV>('/targets'),
      per<DepV>('/wave-dependencies').catch(() => []),
      per<EvidenceV>('/wave-evidence').catch(() => []),
    ]);
  const tickets = await per<TicketV>('/wave-tickets').catch(() => [] as TicketV[]);
  const apps = orgReads.flatMap(r => r.apps);

  /* ---------- tenancy ---------- */
  const tenancy = { orgs: orgReads.map(({ org, depts, teams, stakes }) => ({
    id: slug(org.name), name: org.name,
    departments: depts.map(dp => ({
      id: slug(dp.name), name: dp.name,
      teams: teams.filter(t => t.department === dp.name).map(t => {
        const members = { architects: [] as string[], pms: [] as string[], migrators: [] as string[] };
        stakes.filter(s => s.teams.includes(t.name)).forEach(s => {
          const fn = s.jobFunction || '';
          if (fn === 'Architect') members.architects.push(s.name);
          else if (fn.includes('manager') || fn.includes('Manager')) members.pms.push(s.name);
          else members.migrators.push(s.name);
        });
        return { id: slug(t.name), name: t.name, members };
      }),
    })),
  })) };

  /* ---------- applications ---------- */
  const teamIdOf = new Map<string, string>();
  tenancy.orgs.forEach(o => o.departments.forEach(dp => dp.teams.forEach(t => teamIdOf.set(t.name, t.id))));
  const waveOf = new Map<string, number>();
  orgReads.forEach(r => r.waves.forEach(w => w.members.forEach(m => waveOf.set(m, w.position))));
  const lastSuccess = new Map<string, string | null>();
  orgReads.forEach(r => r.analyses.forEach(a => {
    if (a.status === 'SUCCEEDED' && a.completedAt) {
      const prev = lastSuccess.get(a.application);
      if (!prev || a.completedAt > prev) lastSuccess.set(a.application, a.completedAt);
    }
  }));

  const apps2: AppRow[] = apps.map(a => {
    const state: AppRow['state'] =
      a.analysisState === 'CURRENT' ? 'succeeded'
        : a.analysisState === 'IN_FLIGHT' ? 'running'
          : a.analysisState === 'STALE' ? 'quota'
            : a.analysisState === 'FAILED' ? 'failed' : 'notstarted';
    const age = ageDays(lastSuccess.get(a.name));
    const wn = waveOf.get(a.name);
    return {
      id: a.id,
      name: a.name,
      tag: (a.tags[0] || '').split(' ')[0] || '',
      state,
      incidents: a.incidents,
      pts: a.effort || undefined,
      ptsNote: state === 'quota' ? 'last run' : undefined,
      pct: a.progress ?? undefined,
      risk: a.risk ?? undefined,
      riskColor: a.risk ? RISK_COLOR[a.risk] : undefined,
      riskKind: (a.riskKind || 'none').toLowerCase() as AppRow['riskKind'],
      wave: wn ? String(wn) : '',
      bsvc: a.businessService,
      age,
      stale: age != null && age >= 2,
      archetype: a.archetype || 'Legacy',
      platform: a.platform ?? undefined,
      creds: a.identity || '',
      repo: a.repositoryType.toLowerCase().replace('subversion', 'subversion'),
      binary: a.binaryArtifact ? 'binary' : 'none',
      tags: a.tags.join(' '),
      assess: a.assessmentVersion || '',
      review: REVIEW_MAP[a.reviewState] || 'notstarted',
      team: teamIdOf.get(a.team) || slug(a.team),
      credName: a.credential || undefined,
    };
  });
  installTenancy(tenancy, home(me, tenancy, apps2));

  installHub(apps2, []);

  /* ---------- credentials (team-scoped identities) ---------- */
  const creds: CredRow[] = orgReads.flatMap(r => r.ids.filter(i => i.team != null).map(i => {
    let expLabel = '', expColor = 'green';
    let expires = '—';
    if (i.expiresOn) {
      const days = Math.ceil((new Date(i.expiresOn).getTime() - Date.now()) / 86_400_000);
      /* mock's EN display: relative near-term ("in 6 days"), short date otherwise ("Sep 12") */
      expires = (days >= 0 && days <= 14)
        ? `in ${days} day${days === 1 ? '' : 's'}`
        : new Date(i.expiresOn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      expLabel = days <= 30 ? 'expiring' : 'ok';
      expColor = days <= 30 ? 'yellow' : 'green';
    }
    const kindMap: Record<string, string> = {
      USERNAME_PASSWORD: 'maven &middot; user/password', BEARER_TOKEN: 'source &middot; PAT (https)',
      SOURCE_PRIVATE_KEY: 'source &middot; SSH key', OAUTH2: 'source &middot; OAuth2',
      SECRET_KEY: 'secret key', API_KEY: 'API key',
    };
    return {
      name: i.name,
      kind: i.description || kindMap[i.kind] || i.kind,
      team: teamIdOf.get(i.team as string) || slug(i.team as string),
      expires, expLabel, expColor,
      lastUsed: relText(i.lastUsed),
      verifiedLabel: i.verified ? 'verified' : 'unverified',
      verColor: i.verified ? 'green' : 'red',
      usedBy: i.usedBy === 1 ? '1 application' : `${i.usedBy} applications`,
    };
  }));
  installHub(apps2, creds);


  /* ---------- incidents → per-app groups (triage queue) ---------- */
  const incidents: Record<string, IncidentGroup> = {};
  orgReads.forEach(r => {
    const byApp = new Map<string, IncidentV[]>();
    r.incidents.forEach(i => {
      const list = byApp.get(i.application) || [];
      list.push(i);
      byApp.set(i.application, list);
    });
    byApp.forEach((list, app) => {
      const byRule = new Map<string, IncidentV[]>();
      list.forEach(i => {
        const k = `${i.ruleset}.${i.rule}`;
        const arr = byRule.get(k) || [];
        arr.push(i);
        byRule.set(k, arr);
      });
      const rows: IncRow[] = [...byRule.entries()]
        .map(([, arr]) => {
          const n = arr.length;
          const pts = fmt(arr.reduce((s, i) => s + i.effort, 0));
          const [stLabel, stColor] = TRIAGE_STATE[arr[0].state] || [arr[0].state, 'outline'];
          const cmt = arr.find(i => i.triageComment)?.triageComment || '';
          const tracker = cmt && /MIG-\d+/.test(cmt)
            ? [/failed|Gone/.test(cmt) ? 'sync failed' : 'synced', /failed|Gone/.test(cmt) ? 'red' : 'green']
            : ['', ''];
          return [`${arr[0].rule} (${n}×)`, `${pts} pts`, stLabel, stColor, tracker[0], tracker[1], arr[0].incidentKey] as IncRow;
        })
        .sort((a, b) => parseInt(b[1]) - parseInt(a[1]))
        .slice(0, 6);
      incidents[app] = { total: list.length, pts: fmt(list.reduce((s, i) => s + i.effort, 0)), rows };
    });
  });

  /* ---------- wave content (keyed by app, like the mock stores) ---------- */
  const ticketsMap: Record<string, TicketRow> = {};
  tickets.forEach(t => {
    ticketsMap[t.application] = {
      title: t.title, key: t.key || '',
      outcome: t.outcome.toLowerCase(),
      oc: t.outcome === 'SYNCED' ? 'green' : t.outcome === 'FAILED' ? 'red' : 'outline',
      detail: t.detail || '',
      when: t.whenText || '—',
      drawer: t.outcome === 'FAILED',
    };
  });
  const evidenceMap: Record<string, EvidenceRow> = {};
  evidence.forEach(e => {
    evidenceMap[e.application] = { cov: e.coverage, total: e.total, run: e.run, red: e.red };
  });

  /* ---------- waves ---------- */
  const waves: WaveRow[] = orgReads.flatMap(r =>
    r.waves.map(w => ({
      id: w.id, name: w.name, position: w.position, start: w.startDate, end: w.endDate, members: w.members,
    }))).sort((a, b) => a.position - b.position);

  /* ---------- tasks ---------- */
  const tasks: TaskRow[] = orgReads.flatMap(r => r.tasks.map(t => {
    const st = t.state;
    const postponed = st === 'QUEUED' && t.quota;
    const state: TaskRow['state'] = st === 'FAILED' ? 'Failed'
      : postponed ? 'Postponed' : st === 'QUEUED' ? 'Queued'
        : st === 'RUNNING' ? 'Running' : st === 'SUCCEEDED' ? 'Succeeded' : 'Canceled';
    const min = durationMin(t.age);
    let decision: string;
    if (t.errorCode === 'PVC_RWX_DENIED' || (t.errorMessage || '').includes('permission denied')) {
      decision = `${t.errorMessage} → check PVC RWX; retry · logs`;
    } else if (t.quota) {
      decision = `blocked by quota ${t.quota} → raise in CR`;
    } else if (t.state === 'RUNNING' && t.errorMessage && t.errorMessage.includes('%')) {
      decision = t.errorMessage;
    } else if (t.errorMessage) {
      decision = t.errorMessage;
    } else {
      decision = 'waiting for a worker slot — next free worker picks it up';
    }
    return {
      id: t.id.slice(0, 4), app: t.application || '', state, kind: t.kind.toLowerCase(),
      ageMin: Math.max(1, Math.round(min)), age: durationText(min), decision,
      errorCode: t.errorCode || undefined, quota: t.quota || undefined,
    };
  }));

  /* ---------- agentic registries ---------- */
  const wfruns2: WfRunRow[] = wfrunsAll(wfrunsRaw);
  const agentRuns2: AgentRunRow[] = agentRunsAll(agentRunsRaw);
  const agents2: AgentRow[] = agents.map(a => ({
    id: a.id, name: a.name, image: a.image,
    gateways: a.tierPin ? `${a.gateway} (${a.tierPin})` : a.gateway,
    skills: a.skills.join(', '), params: a.params, ready: a.ready, age: a.age,
  }));
  const skills2: SkillRow[] = skills.map(s => ({
    id: s.id, name: s.name, display: s.display, desc: s.description, type: s.type.toLowerCase(),
    source: s.source, ready: s.ready, tags: s.tags || '', age: s.age,
  }));
  const workflows2: WorkflowRow[] = workflows.map(w => ({
    id: w.id, name: w.name, stages: w.stages, guide: w.guide || '— (org-authored)', ready: w.ready, age: w.age,
  }));
  const gateways2: GatewayRow[] = gateways.map(g => ({
    name: g.name, model: g.model, endpoint: g.endpoint, ctx: g.ctx || '', cred: g.cred || '',
    ready: g.ready, tier: g.tier || 'standard', health: g.health || 'unknown',
    healthAge: g.healthAge || '—', runs30d: String(g.runs30d), tokens30d: g.tokens30d || '',
    rate: g.rate || '', consumers: g.consumers,
  }));

  /* ---------- config surfaces ---------- */
  const bsvcs: BsvcRow[] = orgReads.flatMap(r => r.bsvcs.map(b => ({
    id: b.id, name: b.name, description: b.description || '', owner: b.owner || '—',
  })));
  const archetypes: ArchRow[] = orgReads.flatMap(r => r.archs.map(a => ({
    id: a.id, name: a.name, description: a.description || '', tags: a.tags,
    criteria: a.membershipCriteria, memberCount: a.memberCount,
  })));
  const teamList: { id: string; name: string; org: string }[] = orgReads.flatMap(r =>
    r.teams.map(t => ({ id: t.id, name: t.name, org: slug(t.organization) })));
  const groups: GroupRow[] = orgReads.flatMap(r => r.groups.map(g => ({
    name: g.name, description: g.description || '', members: g.members.map(m => {
      const st = r.stakes.find(s => s.email === m);
      return st ? st.name : m;
    }),
    waves: waves.slice(0, 3).map(w => w.name),
  })));
  const tags: TagRow[] = orgReads.flatMap(r => r.tags.map(t => ({ name: t.name, category: t.tagType })));
  const functions: FunctionRow[] = orgReads.flatMap(r => r.funcs.map(f => ({ name: f.name })));
  const platforms: PlatformRow[] = platformsAll(platformsRaw);
  const targets: TargetRow[] = targetsAll(targetsRaw);
  const regIdentities: RegIdentityRow[] = orgReads.flatMap(r =>
    r.ids.filter(i => !i.team).map(i => ({
      name: i.name, desc: i.description || '',
      type: i.name.includes('maven') ? 'Maven'
        : i.kind === 'SOURCE_PRIVATE_KEY' ? 'Source'
          : i.kind === 'OAUTH2' ? 'Source' : 'Source + Maven',
    })));
  const stakeholders: StakeRow[] = orgReads.flatMap(r =>
    r.stakes.map(s => ({
      name: s.name,
      org: slug(s.organization),
      email: s.email,
      func: s.jobFunction || '—',
      bsvcs: r.bsvcs.filter(b => b.owner === s.name).map(b => b.name),
    })));
  const audit: AuditRow[] = orgReads.flatMap(r => r.audit.map(a => ({
    ts: a.at.replace('T', ' ').slice(0, 16),
    actor: a.actor === 'seed' ? 'Platform administrator' : a.actor,
    action: `${a.resourceType.toLowerCase()}:${a.action}`.replace('system:seed', 'tenant:provision'),
    target: a.detail || `${a.resourceType} ${a.resourceId}`,
  })));

  return {
    apps: apps2, creds, incidents, tickets: ticketsMap, evidence: evidenceMap, deps: deps.map(d => ({ from: d.from, to: d.to, verb: d.verb })),
    waves, trend: trend.map(t => ({ date: t.date, open: t.open, pass: t.pass })),
    tasks, wfruns: wfruns2, agentRuns: agentRuns2, agents: agents2, skills: skills2, workflows: workflows2, gateways: gateways2,
    bsvcs, groups, tags, functions, platforms, targets, regIdentities, stakeholders, audit,
    archetypes, teams: teamList,
  };
}

function wfrunsAll(rows: WfRunV[]): WfRunRow[] {
  return rows.map(r => ({
    id: r.id, name: r.name, wf: r.workflow, app: r.application, phase: r.phase,
    stages: String(r.stages), state: r.state.toLowerCase(), age: r.age,
    duration: r.duration || '', canonical: r.canonical || undefined,
  }));
}
function agentRunsAll(rows: AgentRunV[]): AgentRunRow[] {
  return rows.map(r => ({
    id: r.id, name: r.name, agent: r.agent, app: r.application, phase: r.phase,
    state: r.state.toLowerCase(), reason: r.reason || '', duration: r.duration || '',
    gw: r.gateway, model: r.model, tokens: r.tokens || '', tokDetail: r.tokDetail || '',
    cost: r.cost || '', image: r.image || '', wr: r.workflowRun, age: r.age,
    events: r.events || [],
  }));
}
function platformsAll(rows: PlatformV[]): PlatformRow[] { return rows.map(p => ({ name: p.name, type: p.type })); }
function targetsAll(rows: TargetV[]): TargetRow[] { return rows.map(t => ({ name: t.name, langs: t.langs })); }

/**
 * The token's tenancy anchors the home org/dept/team: the org claim names the
 * org, the team claim (team-locked personas) names the team; without a team
 * claim the arch application's team (the mock's ARCH_APP anchor) seeds the
 * view when it lives in the caller's org. padmin (no org claim) anchors to
 * the ARCH_APP's org so the landing shows a populated scope.
 */
function home(me: AuthUser | null, tenancy: { orgs: Array<{ id: string; departments: Array<{ id: string; teams: Array<{ id: string }> }> }> }, apps: AppRow[]): { org: string; dept: string; team: string } | undefined {
  const archTeamId = apps.find(a => a.name === ARCH_APP)?.team;
  const anchor = (orgId: string): { org: string; dept: string; team: string } | undefined => {
    const org = tenancy.orgs.find(o => o.id === orgId);
    if (!org) return undefined;
    const withArch = org.departments.find(dp => dp.teams.some(t => t.id === archTeamId));
    if (withArch) return { org: orgId, dept: withArch.id, team: archTeamId! };
    const dp = org.departments[0];
    return dp ? { org: orgId, dept: dp.id, team: dp.teams[0]?.id ?? '' } : undefined;
  };
  if (me?.orgName || me?.orgAliases.length) {
    // legacy display-name claim → slug; native org-alias claim already IS the slug
    const orgId = me.orgName ? slug(me.orgName) : me.orgAliases[0];
    const ownOrg = anchor(orgId);
    if (!ownOrg) return undefined;
    if (me.teamName) {
      const teamId = slug(me.teamName);
      const dept = tenancy.orgs.find(o => o.id === orgId)?.departments
        .find(dp => dp.teams.some(t => t.id === teamId));
      if (dept) return { org: orgId, dept: dept.id, team: teamId };
    }
    return ownOrg;
  }
  // padmin (or unscoped): anchor to the ARCH_APP's org for a populated landing
  const anchored = tenancy.orgs.map(o => anchor(o.id)).find(h => h?.team === archTeamId);
  return anchored ?? (tenancy.orgs[0] ? anchor(tenancy.orgs[0].id) : undefined);
}

/* ---------- provider ---------- */
interface HubState {
  data: HubData;
  reload: () => void;
  reloading: boolean;
}
const HubCtx = createContext<HubState | null>(null);

export function HubProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<HubData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setReloading(true);
    try {
      const d = await loadAll();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReloading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (error) {
    return (
      <div role="alert" style={{
        margin: 'var(--rh-space-6xl) auto', maxWidth: 640, textAlign: 'center',
        fontFamily: 'var(--pf-t--global--font--family--body--default)',
      }}>
        <h1 style={{ fontSize: 'var(--rh-font-size-heading-lg)', marginBottom: 'var(--rh-space-md)' }}>
          Hub backend unavailable
        </h1>
        <p style={{ color: 'var(--pf-t--global--text--color--subtle)', marginBottom: 'var(--rh-space-lg)' }}>
          {error}
        </p>
        <p style={{ marginBottom: 'var(--rh-space-lg)' }}>
          The console is a hard client of the Tackle Hub API — there is no demo-data fallback.
          Start the backend, then retry.
        </p>
        <button className="pf-v6-c-button pf-m-primary" type="button" onClick={() => void load()} disabled={reloading}>
          {reloading ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div role="status" style={{
        margin: 'var(--rh-space-6xl) auto', textAlign: 'center',
        fontFamily: 'var(--pf-t--global--font--family--body--default)',
        color: 'var(--pf-t--global--text--color--subtle)',
      }}>
        Loading the hub… (applications, incidents, waves, agentic registries)
      </div>
    );
  }

  return <HubCtx.Provider value={{ data, reload: () => void load(), reloading }}>{children}</HubCtx.Provider>;
}

export function useHub(): HubState {
  const ctx = useContext(HubCtx);
  if (!ctx) throw new Error('useHub outside HubProvider');
  return ctx;
}

/* re-export for screens that build mutation calls */
export { api };
