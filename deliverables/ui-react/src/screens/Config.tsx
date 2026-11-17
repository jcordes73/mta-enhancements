import { useMemo, useState } from 'react';import {
  Alert, Button, Card, CardBody, CardHeader, CardTitle, Content, ContentVariants,
  Label, Modal, ModalHeader, ModalBody, ModalFooter, Pagination, Tabs, Tab, TabTitleText, Title,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { useApp, useScoped, can, ORG_BY_ID, TEAM_BY_ID, ORGS } from '../state/appState';
import { useHub, type HubData } from '../api/hub';
import { ACTIVE_LOGINS, EXTRA_USERS } from '../data/generated';
import { dec } from '../utils/decode';

type App = HubData['apps'][number];
type Team = { id: string; name: string; members: { architects: string[]; pms: string[]; migrators: string[] } };

/* hub-backed stores — bound at the top of Config() (all consumers render under it).
   ACTIVE_LOGINS / EXTRA_USERS stay static: console-directory demo content with no
   hub-backend surface (documented in MIGRATION.md). */
let TENANCY: { orgs: typeof ORGS } = { orgs: ORGS };
let MOCK_APPS: App[] = [];
let MOCK_BSVCS: HubData['bsvcs'] = [];
let MOCK_GROUPS: HubData['groups'] = [];
let MOCK_FUNCTIONS: HubData['functions'] = [];
let MOCK_TAGS: HubData['tags'] = [];
let AUDIT_LOG: HubData['audit'] = [];
let MOCK_PLATFORMS: HubData['platforms'] = [];
let MOCK_TARGETS: HubData['targets'] = [];
let MOCK_IDENTITIES: HubData['regIdentities'] = [];
let MOCK_GATEWAYS: HubData['gateways'] = [];
let STAKE_OVERRIDES: Record<string, { bsvcs?: string[] }> = {};

const CTRL_SUBTABS = [
  ['bsvc', 'Business services'], ['stake', 'Stakeholders'], ['groups', 'Stakeholder groups'],
  ['func', 'Job functions'], ['tags', 'Tags'], ['teams', 'Teams'], ['depts', 'Departments'], ['orgs', 'Organizations'],
] as const;
type CtrlSub = (typeof CTRL_SUBTABS)[number][0];

const CFG_TABS = [
  ['controls', 'Controls'], ['access', 'Access'], ['registries', 'Registries'],
  ['analysis', 'Analysis'], ['tracker', 'Tracker sync'], ['rules', 'Rules'],
  ['automation', 'Automation'], ['platform', 'Platform'],
] as const;
type CfgTab = (typeof CFG_TABS)[number][0];

/* ---------- generic icon buttons (edit/delete, the mock's editIconBtn/deleteIconBtn) ---------- */
function IconActions({ onDelete }: { onDelete?: () => void }) {
  return (
    <>
      <Button variant="plain" aria-label="Edit" title="Edit" icon={<span aria-hidden>✎</span>} onClick={e => e.stopPropagation()} />
      {onDelete && <DeleteArmed onConfirm={onDelete} />}
    </>
  );
}
function DeleteArmed({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <Button variant="plain" className={armed ? 'armed-delete' : undefined}
      aria-label={armed ? 'Confirm delete' : 'Delete'} title={armed ? 'Confirm delete' : 'Delete'}
      icon={<span aria-hidden>{armed ? '⚠' : '🗑'}</span>}
      onClick={e => { e.stopPropagation(); if (armed) onConfirm(); else setArmed(true); }} />
  );
}

/* ---------- the screen ---------- */
export function Config() {
  const { state, set } = useApp();
  const { apps } = useScoped();
  const { data } = useHub();

  /* bind the hub stores before any tab renders (module bindings above) */
  TENANCY = { orgs: ORGS };
  MOCK_APPS = data.apps;
  MOCK_BSVCS = data.bsvcs;
  MOCK_GROUPS = data.groups;
  MOCK_FUNCTIONS = data.functions;
  MOCK_TAGS = data.tags;
  AUDIT_LOG = data.audit;
  MOCK_PLATFORMS = data.platforms;
  MOCK_TARGETS = data.targets;
  MOCK_IDENTITIES = data.regIdentities;
  MOCK_GATEWAYS = data.gateways;
  STAKE_OVERRIDES = Object.fromEntries(data.stakeholders.map(s => [s.name, { bsvcs: s.bsvcs }]));

  const tab: CfgTab = (CFG_TABS.some(([k]) => k === state.cfgTab) ? state.cfgTab : 'controls') as CfgTab;
  const setTab = (t: CfgTab) => set({ cfgTab: t });
  const [ctrlSub, setCtrlSub] = useState<CtrlSub>('bsvc');

  const isPadmin = state.persona === 'padmin';
  const canTenants = can(state.persona, 'read', 'tenants');

  /* derived stores — stakeholders come straight from the hub (/stakeholders) */
  const stakeholders = useMemo(() => data.stakeholders, [data]);
  const appList = apps as App[];
  const scopedTeams = useMemo(() => {
    const orgs = isPadmin ? TENANCY.orgs : [ORG_BY_ID[state.org]];
    return orgs.flatMap(o => o.departments.flatMap(dp => dp.teams.map(t => ({ o, dp, t: t as Team }))));
  }, [isPadmin, state.org]);
  const appsOfTeam = (tid: string) => (MOCK_APPS as App[]).filter(a => a.team === tid).length;
  const appsOfDept = (did: string) => (MOCK_APPS as App[]).filter(a => (TEAM_BY_ID[a.team] || {}).dept === did).length;
  const appsOfOrg = (oid: string) => (MOCK_APPS as App[]).filter(a => (TEAM_BY_ID[a.team] || {}).org === oid).length;

  /* delete guards feed the ctrlMsg warning */
  const [ctrlMsg, setCtrlMsg] = useState<React.ReactNode | null>(null);
  const deleteTeam = (t: Team) => {
    const n = appsOfTeam(t.id);
    if (n) { setCtrlMsg(<>Cannot delete <b>{t.name}</b>: {n} application{n === 1 ? '' : 's'} still assigned — reassign them first (each application belongs to exactly one team).</>); return; }
    setCtrlMsg(<>Deleted team <b>{t.name}</b> (in-memory).</>);
  };
  const deleteDept = (dp: { id: string; name: string; teams: Team[] }) => {
    if (dp.teams.length) {
      setCtrlMsg(<>Cannot delete <b>{dp.name}</b>: {dp.teams.length} team{dp.teams.length > 1 ? 's' : ''} still belong{dp.teams.length > 1 ? '' : 's'} to it ({dp.teams.map(t => t.name).join(', ')}) — move or delete them first (Teams tab).</>);
      return;
    }
    setCtrlMsg(<>Deleted department <b>{dp.name}</b> (in-memory).</>);
  };

  /* ---------- access-tab state ---------- */
  const [ubPage, setUbPage] = useState(1);
  const [ubPerPage, setUbPerPage] = useState(10);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [inactive, setInactive] = useState<Set<string>>(new Set());
  const userRows = useMemo(() =>
    stakeholders.filter(p => p.email)
      .map(p => ({ login: p.email, stake: p.name, func: p.func, last: (ACTIVE_LOGINS as Record<string, string>)[p.name] || 'never' }))
      .concat(EXTRA_USERS.map(u => ({ login: u.login, stake: '', func: '—' as string, last: u.last }))), [stakeholders]);
  const ubStart = (ubPage - 1) * ubPerPage;
  const ubRows = userRows.slice(ubStart, ubStart + ubPerPage);

  /* ---------- automation-tab state ---------- */
  const gwCost = (tokens30d: string, rate: string) => '$' + ((parseFloat(tokens30d) || 0) * (parseFloat(rate) || 0)).toFixed(2);
  const [rates, setRates] = useState<Record<string, string>>(
    Object.fromEntries(MOCK_GATEWAYS.map(g => [g.name, String(parseFloat(g.rate) * 1)])));

  const muted = (t: string) => <span className="u-muted">{t}</span>;

  return (
    <>
      <Title headingLevel="h1" size="2xl" className="page-title">Administration</Title>
      <Content component={ContentVariants.p} className="page-subtitle">
        One Administration hub section instead of scattered one-switch pages
      </Content>
      <Tabs activeKey={tab} onSelect={(_e, k) => setTab(k as CfgTab)} aria-label="Administration sections" style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
        {/* ================= CONTROLS (8 sub-tabs) ================= */}
        <Tab eventKey="controls" title={<TabTitleText>Controls</TabTitleText>} aria-label="Controls sections">
          <Tabs activeKey={ctrlSub} onSelect={(_e, k) => setCtrlSub(k as CtrlSub)} aria-label="Controls sections" style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
            <Tab eventKey="bsvc" title={<TabTitleText>Business services</TabTitleText>} aria-label="Business services">
              <Card style={{ marginTop: 'var(--rh-space-lg)' }}>
                <CardHeader actions={{ actions: <Button variant="primary" size="sm">Add business service</Button> }}>
                  <CardTitle>Business services</CardTitle>
                </CardHeader>
                <CardBody>
                  <Table aria-label="Business services" variant="compact">
                    <Thead><Tr><Th>Name</Th><Th>Description</Th><Th>Owner</Th><Th>Applications</Th><Th /></Tr></Thead>
                    <Tbody>
                      {MOCK_BSVCS.map(b => (
                        <Tr key={b.name}>
                          <Td dataLabel="Name"><b>{b.name}</b></Td>
                          <Td dataLabel="Description">{b.description}</Td>
                          <Td dataLabel="Owner">{b.owner || <Label color="orange" title="No owner assigned — accountability gap">Unowned</Label>}</Td>
                          <Td dataLabel="Applications"><b>{appList.filter(a => a.bsvc === b.name).length}</b></Td>
                          <Td><IconActions /></Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </CardBody>
              </Card>
            </Tab>
            <Tab eventKey="stake" title={<TabTitleText>Stakeholders</TabTitleText>} aria-label="Stakeholders">
              <Card style={{ marginTop: 'var(--rh-space-lg)' }}>
                <CardHeader actions={{ actions: <Button variant="primary" size="sm">Add stakeholder</Button> }}>
                  <CardTitle>Stakeholders</CardTitle>
                </CardHeader>
                <CardBody>
                  <StakeholderPager people={stakeholders} />
                </CardBody>
              </Card>
            </Tab>
            <Tab eventKey="groups" title={<TabTitleText>Stakeholder groups</TabTitleText>} aria-label="Stakeholder groups">
              <Card style={{ marginTop: 'var(--rh-space-lg)' }}>
                <CardHeader actions={{ actions: <Button variant="primary" size="sm">Add stakeholder group</Button> }}>
                  <CardTitle>Stakeholder groups</CardTitle>
                </CardHeader>
                <CardBody>
                  <Table aria-label="Stakeholder groups" variant="compact">
                    <Thead><Tr><Th>Name</Th><Th>Description</Th><Th>Stakeholders</Th><Th>Waves</Th><Th /></Tr></Thead>
                    <Tbody>
                      {MOCK_GROUPS.map(g => (
                        <Tr key={g.name}>
                          <Td dataLabel="Name"><b>{g.name}</b></Td>
                          <Td dataLabel="Description">{dec(g.description)}</Td>
                          <Td dataLabel="Stakeholders">{g.members.length ? g.members.join(', ') : muted('no stakeholders')}</Td>
                          <Td dataLabel="Waves">{(g.waves || []).length ? g.waves.join(', ') : muted('—')}</Td>
                          <Td><IconActions /></Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </CardBody>
              </Card>
            </Tab>
            <Tab eventKey="func" title={<TabTitleText>Job functions</TabTitleText>} aria-label="Job functions">
              <Card style={{ marginTop: 'var(--rh-space-lg)' }}>
                <CardHeader><CardTitle>Job functions</CardTitle></CardHeader>
                <CardBody>
                  <Table aria-label="Job functions" variant="compact">
                    <Thead><Tr><Th>Name</Th><Th>Stakeholders</Th></Tr></Thead>
                    <Tbody>
                      {MOCK_FUNCTIONS.map(f => (
                        <Tr key={f.name}>
                          <Td dataLabel="Name"><b>{f.name}</b></Td>
                          <Td dataLabel="Stakeholders">{stakeholders.filter(p => p.func === f.name).map(p => p.name).join(', ') || muted('—')}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </CardBody>
              </Card>
            </Tab>
            <Tab eventKey="tags" title={<TabTitleText>Tags</TabTitleText>} aria-label="Tags">
              <Card style={{ marginTop: 'var(--rh-space-lg)' }}>
                <CardHeader actions={{ actions: <Button variant="primary" size="sm">Add tag</Button> }}>
                  <CardTitle>Tags</CardTitle>
                </CardHeader>
                <CardBody>
                  <Table aria-label="Tags" variant="compact">
                    <Thead><Tr><Th>Tag</Th><Th>Category</Th><Th>Applications</Th></Tr></Thead>
                    <Tbody>
                      {MOCK_TAGS.map(t => (
                        <Tr key={t.name}>
                          <Td dataLabel="Tag"><b>{t.name}</b></Td>
                          <Td dataLabel="Category">{t.category}</Td>
                          <Td dataLabel="Applications"><b>{appList.filter(a => String(a.tags || '').split(' ').includes(t.name)).length}</b></Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </CardBody>
              </Card>
            </Tab>
            <Tab eventKey="teams" title={<TabTitleText>Teams</TabTitleText>} aria-label="Teams">
              <Card style={{ marginTop: 'var(--rh-space-lg)' }}>
                <CardHeader actions={{ actions: <Button variant="primary" size="sm">Add team</Button> }}>
                  <CardTitle>Teams</CardTitle>
                </CardHeader>
                <CardBody>
                  <Table aria-label="Teams" variant="compact">
                    <Thead><Tr><Th>Organization</Th><Th>Department</Th><Th>Team</Th><Th>Architects</Th><Th>Project managers</Th><Th>Migrators</Th><Th>Applications</Th><Th /></Tr></Thead>
                    <Tbody>
                      {scopedTeams.map(({ o, dp, t }) => (
                        <Tr key={t.id}>
                          <Td dataLabel="Organization">{o.name}</Td>
                          <Td dataLabel="Department">{dp.name}</Td>
                          <Td dataLabel="Team">{t.name}</Td>
                          <Td dataLabel="Architects">{t.members.architects.join(', ') || muted('—')}</Td>
                          <Td dataLabel="Project managers">{t.members.pms.join(', ') || muted('—')}</Td>
                          <Td dataLabel="Migrators">{t.members.migrators.join(', ') || muted('—')}</Td>
                          <Td dataLabel="Applications">{appsOfTeam(t.id)}</Td>
                          <Td><IconActions onDelete={() => deleteTeam(t)} /></Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                  <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
                    Deletes are guarded: a team with assigned applications cannot be deleted — reassign them first (each application belongs to exactly one team). Organization admins see their own organization&apos;s teams; the Platform administrator sees all.
                  </Content>
                </CardBody>
              </Card>
            </Tab>
            <Tab eventKey="depts" title={<TabTitleText>Departments</TabTitleText>} aria-label="Departments">
              <Card style={{ marginTop: 'var(--rh-space-lg)' }}>
                <CardHeader actions={{ actions: <Button variant="primary" size="sm">Add department</Button> }}>
                  <CardTitle>Departments</CardTitle>
                </CardHeader>
                <CardBody>
                  <Table aria-label="Departments" variant="compact">
                    <Thead><Tr><Th>Organization</Th><Th>Department</Th><Th>Teams</Th><Th>Applications</Th><Th /></Tr></Thead>
                    <Tbody>
                      {(isPadmin ? TENANCY.orgs : [ORG_BY_ID[state.org]]).map(o => o.departments.map(dp => (
                        <Tr key={dp.id}>
                          <Td dataLabel="Organization">{o.name}</Td>
                          <Td dataLabel="Department"><b>{dp.name}</b></Td>
                          <Td dataLabel="Teams">{dp.teams.length || muted('—')}</Td>
                          <Td dataLabel="Applications">{appsOfDept(dp.id) || muted('—')}</Td>
                          <Td><IconActions onDelete={() => deleteDept(dp as never)} /></Td>
                        </Tr>
                      )))}
                    </Tbody>
                  </Table>
                  <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
                    Organization admins manage their own organization&apos;s departments; the Platform administrator sees all. Renames cascade live into the Teams tab and the masthead scope switcher (structures resolve by id). Deletes are guarded: a department still containing teams cannot be deleted — move or delete the teams first.
                  </Content>
                </CardBody>
              </Card>
            </Tab>
            {canTenants && (
              <Tab eventKey="orgs" title={<TabTitleText>Organizations</TabTitleText>} aria-label="Organizations">
                <>
                  <Card style={{ marginTop: 'var(--rh-space-lg)' }}>
                    <CardHeader actions={{ actions: <Button variant="primary" size="sm">Add organization</Button> }}>
                      <CardTitle>Organizations</CardTitle>
                    </CardHeader>
                    <CardBody>
                      <Table aria-label="Organizations" variant="compact">
                        <Thead><Tr><Th>Organization</Th><Th>Departments</Th><Th>Teams</Th><Th>Applications</Th><Th>Status</Th></Tr></Thead>
                        <Tbody>
                          {TENANCY.orgs.map(o => (
                            <Tr key={o.id}>
                              <Td dataLabel="Organization">{o.name}</Td>
                              <Td dataLabel="Departments">{o.departments.length}</Td>
                              <Td dataLabel="Teams">{o.departments.reduce((n, dp) => n + dp.teams.length, 0)}</Td>
                              <Td dataLabel="Applications">{appsOfOrg(o.id)}</Td>
                              <Td dataLabel="Status"><Label color="green" isCompact>Active</Label></Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                      <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
                        Only the <b>Platform administrator</b> sees this tab and can move between organizations — every cross-organization access is recorded below. Organization admins (Admin persona) are scoped to their own organization like every other persona.
                      </Content>
                    </CardBody>
                  </Card>
                  <Card style={{ marginTop: 'var(--rh-space-lg)' }}>
                    <CardHeader><CardTitle>Cross-tenant audit trail</CardTitle></CardHeader>
                    <CardBody>
                      <AuditPager />
                    </CardBody>
                  </Card>
                </>
              </Tab>
            )}
            {/* non-padmin personas never see the tab at all (mock's data-rbac="tenants:read") */}
          </Tabs>
          {ctrlMsg && (
            <Alert variant="warning" isInline title="Delete blocked" style={{ marginTop: 'var(--rh-space-md)' }}
              actionClose={<Button variant="plain" aria-label="Close" onClick={() => setCtrlMsg(null)}>✕</Button>}>
              <p>{ctrlMsg}</p>
            </Alert>
          )}
        </Tab>

        {/* ================= ACCESS ================= */}
        <Tab eventKey="access" title={<TabTitleText>Access</TabTitleText>} aria-label="Access">
          <div style={{ marginTop: 'var(--pf-t--global--spacer--md)', display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 'var(--rh-space-2xl)' }}>
            <Card className="gc6">
              <CardHeader><CardTitle>Users ↔ Stakeholders</CardTitle></CardHeader>
              <CardBody>
                <Table aria-label="Users" variant="compact">
                  <Thead><Tr><Th>Login</Th><Th>Job function</Th><Th>Stakeholder link</Th><Th>Last login</Th><Th>Status</Th><Th /></Tr></Thead>
                  <Tbody>
                    {ubRows.map(b => {
                      const isInactive = inactive.has(b.login);
                      return (
                        <Tr key={b.login}>
                          <Td dataLabel="Login">{b.login}</Td>
                          <Td dataLabel="Job function">{b.func}</Td>
                          <Td dataLabel="Stakeholder link">
                            {b.stake
                              ? <>✓ {b.stake}</>
                              : <><Label color="yellow" isCompact>unlinked</Label> <Button variant="secondary" size="sm">bind by email</Button></>}
                          </Td>
                          <Td dataLabel="Last login">{b.last}</Td>
                          <Td dataLabel="Status"><Label color={isInactive ? 'grey' : 'green'} isCompact>{isInactive ? 'inactive' : 'active'}</Label></Td>
                          <Td>
                            <Button variant="plain" aria-label={isInactive ? 'Activate user' : 'Deactivate user'}
                              title={isInactive ? 'Activate — the directory login is allowed again (user:activate)' : 'Deactivate — blocks the login only; the stakeholder record stays (user:deactivate)'}
                              icon={<span aria-hidden>{isInactive ? '✓' : '⊘'}</span>}
                              onClick={() => setInactive(s => { const n = new Set(s); if (n.has(b.login)) n.delete(b.login); else n.add(b.login); return n; })} />
                          </Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
                <Pagination
                  itemCount={userRows.length} perPage={ubPerPage} page={ubPage}
                  onSetPage={(_e, p) => setUbPage(p)} onPerPageSelect={(_e, pp) => { setUbPerPage(pp); setUbPage(1); }}
                  widgetId="ub-pagination" titles={{ items: 'users' }} />
                <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
                  All {stakeholders.length} stakeholders are mapped to a directory login; {EXTRA_USERS.length} directory user is not yet a stakeholder (promote candidates){inactive.size ? `; ${inactive.size} deactivated` : ''}.
                </Content>
              </CardBody>
            </Card>
            <Card className="gc6">
              <CardHeader><CardTitle>Tokens (comment 9: management UX half — last-used, expiry warnings, sane defaults)</CardTitle></CardHeader>
              <CardBody>
                <Table aria-label="Tokens" variant="compact">
                  <Thead><Tr><Th>Kind</Th><Th>Expiration</Th><Th>Last used</Th><Th /></Tr></Thead>
                  <Tbody>
                    <Tr>
                      <Td dataLabel="Kind">api-key</Td>
                      <Td dataLabel="Expiration">2027-09-12 <Label color="green" isCompact>ok</Label></Td>
                      <Td dataLabel="Last used">14m ago</Td>
                      <Td><Button variant="danger" size="sm" onClick={() => setRevokeOpen(true)}>revoke</Button></Td>
                    </Tr>
                    <Tr>
                      <Td dataLabel="Kind">api-key</Td>
                      <Td dataLabel="Expiration">2036-08-01 <Label color="red" isCompact>~10y default</Label></Td>
                      <Td dataLabel="Last used">never</Td>
                      <Td><Button variant="danger" size="sm" onClick={() => setRevokeOpen(true)}>revoke</Button></Td>
                    </Tr>
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
          </div>
        </Tab>

        {/* ================= REGISTRIES (3 gc4 cards) ================= */}
        <Tab eventKey="registries" title={<TabTitleText>Registries</TabTitleText>} aria-label="Registries">
          <div style={{ marginTop: 'var(--pf-t--global--spacer--md)', display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 'var(--rh-space-2xl)' }}>
            <Card className="gc4">
              <CardHeader actions={{ actions: <Button variant="primary" size="sm">Add source platform</Button> }}>
                <CardTitle>Source platforms</CardTitle>
              </CardHeader>
              <CardBody>
                <Table aria-label="Source platforms" variant="compact">
                  <Thead><Tr><Th>Name</Th><Th>Type</Th><Th>Applications</Th><Th /></Tr></Thead>
                  <Tbody>
                    {MOCK_PLATFORMS.map(p => (
                      <Tr key={p.name}>
                        <Td dataLabel="Name"><b>{p.name}</b></Td>
                        <Td dataLabel="Type">{p.type}</Td>
                        <Td dataLabel="Applications"><b>{appList.filter(a => a.platform === p.name).length}</b></Td>
                        <Td><IconActions /></Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
            <Card className="gc4">
              <CardHeader actions={{ actions: <Button variant="primary" size="sm">Add migration target</Button> }}>
                <CardTitle>Custom migration targets</CardTitle>
              </CardHeader>
              <CardBody>
                <Table aria-label="Custom migration targets" variant="compact">
                  <Thead><Tr><Th>Name</Th><Th>Languages</Th><Th /></Tr></Thead>
                  <Tbody>
                    {MOCK_TARGETS.map(t => (
                      <Tr key={t.name}>
                        <Td dataLabel="Name"><b>{t.name}</b></Td>
                        <Td dataLabel="Languages">{t.langs}</Td>
                        <Td><IconActions /></Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
            <Card className="gc4">
              <CardHeader actions={{ actions: <Button variant="primary" size="sm">Add identity</Button> }}>
                <CardTitle>Identities</CardTitle>
              </CardHeader>
              <CardBody>
                <Table aria-label="Identities" variant="compact">
                  <Thead><Tr><Th>Name</Th><Th>Description</Th><Th>Type</Th><Th>Applications</Th><Th /></Tr></Thead>
                  <Tbody>
                    {MOCK_IDENTITIES.map(x => (
                      <Tr key={x.name}>
                        <Td dataLabel="Name"><b>{x.name}</b></Td>
                        <Td dataLabel="Description">{x.desc}</Td>
                        <Td dataLabel="Type">{x.type}</Td>
                        <Td dataLabel="Applications"><b>{appList.filter(a => a.creds === x.name).length}</b></Td>
                        <Td><IconActions /></Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
          </div>
        </Tab>

        {/* ================= ANALYSIS (questionnaires) ================= */}
        <Tab eventKey="analysis" title={<TabTitleText>Analysis</TabTitleText>} aria-label="Analysis">
          <Card style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
            <CardHeader actions={{ actions: <><Button variant="primary">New questionnaire</Button>{' '}<Button variant="secondary">Upload YAML</Button></> }}>
              <CardTitle>Questionnaire definitions</CardTitle>
            </CardHeader>
            <CardBody>
              <Table aria-label="Questionnaire definitions" variant="compact">
                <Thead><Tr><Th>Questionnaire</Th><Th>Version</Th><Th>Status</Th><Th>Scope</Th><Th>Questions</Th><Th>Thresholds</Th><Th>Overrides</Th><Th /></Tr></Thead>
                <Tbody>
                  <Tr>
                    <Td dataLabel="Questionnaire"><b>EAP8-archetype</b><br />{muted('EAP 7 → 8 migration assessment')}</Td>
                    <Td dataLabel="Version">v3</Td>
                    <Td dataLabel="Status"><Label color="green" isCompact>active</Label> <span className="u-muted u-meta">since 2026-10-02</span></Td>
                    <Td dataLabel="Scope"><Label color="teal" isCompact>includeFor: EAP 7</Label></Td>
                    <Td dataLabel="Questions">15 · 4 sections</Td>
                    <Td dataLabel="Thresholds">red ≥ 18 · yellow ≥ 8</Td>
                    <Td dataLabel="Overrides">1 · <a href="#scr=inventory">claims-web →</a></Td>
                    <Td dataLabel="Actions"><a href="#scr=inventory">answer session →</a>{' '}<Button variant="secondary" size="sm">Edit YAML</Button>{' '}<Button variant="secondary" size="sm">New version</Button></Td>
                  </Tr>
                  <Tr>
                    <Td dataLabel="Questionnaire"><b>EAP8-archetype</b></Td>
                    <Td dataLabel="Version">v2</Td>
                    <Td dataLabel="Status"><Label variant="outline" isCompact>archived</Label> <span className="u-muted u-meta">superseded by v3</span></Td>
                    <Td dataLabel="Scope"><Label color="teal" isCompact>includeFor: EAP 7</Label></Td>
                    <Td dataLabel="Questions">14 · 4 sections</Td>
                    <Td dataLabel="Thresholds">red ≥ 18 · yellow ≥ 8</Td>
                    <Td dataLabel="Overrides">{muted('—')}</Td>
                    <Td dataLabel="Actions"><Button variant="secondary" size="sm">View YAML</Button></Td>
                  </Tr>
                  <Tr>
                    <Td dataLabel="Questionnaire"><b>Cloud readiness</b><br />{muted('containerization / K8s move assessment')}</Td>
                    <Td dataLabel="Version">v1</Td>
                    <Td dataLabel="Status"><Label color="yellow" isCompact>draft</Label></Td>
                    <Td dataLabel="Scope"><Label variant="outline" isCompact>all cohorts</Label></Td>
                    <Td dataLabel="Questions">8 · 2 sections</Td>
                    <Td dataLabel="Thresholds">red ≥ 10 · yellow ≥ 5</Td>
                    <Td dataLabel="Overrides">{muted('—')}</Td>
                    <Td dataLabel="Actions"><Button variant="secondary" size="sm">Edit YAML</Button></Td>
                  </Tr>
                </Tbody>
              </Table>
              <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
                Authoring format is YAML, but it is no longer a one-way upload: the same schema validates the editor, the upload, and the REST resource, and activation follows the draft → validate → activate lifecycle with the version history kept.
              </Content>
            </CardBody>
          </Card>
          <Card style={{ marginTop: 'var(--rh-space-lg)' }}>
            <CardHeader><CardTitle>Validation</CardTitle></CardHeader>
            <CardBody>
              <Alert variant="success" title="EAP8-archetype v3: schema valid" aria-label="Validation result">
                <div>15 questions · thresholds consistent · <code>includeFor</code> / <code>applyTags</code> / <code>autoAnswerFor</code> accepted identically over the editor, upload, and <code>/questionnaires</code> REST resource</div>
              </Alert>
              <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
                Activation on 2026-10-02 propagated v3 answers across the EAP8 cohort; claims-web&apos;s completed own-assessment stayed on its recorded version and its per-app deltas remain visible in Reports → Provenance <a href="#scr=inventory">Cohorts →</a>
              </Content>
            </CardBody>
          </Card>
        </Tab>

        {/* ================= TRACKER SYNC ================= */}
        <Tab eventKey="tracker" title={<TabTitleText>Tracker sync</TabTitleText>} aria-label="Tracker sync">
          <Content component={ContentVariants.p} className="u-muted" style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
            Sync is a first-class outcome — server-side status, not a spinner that lies
          </Content>
          <Card style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
            <CardHeader actions={{ actions: <Button variant="secondary">Test connection</Button> }}>
              <CardTitle>Trackers (R2-17: a tracker&apos;s page shows whether tickets are actually moving)</CardTitle>
            </CardHeader>
            <CardBody>
              <Table aria-label="Trackers" variant="compact">
                <Thead><Tr><Th>Tracker</Th><Th>Connection</Th><Th>Last verified</Th><Th>Sync outcome (30d)</Th><Th>Consumers</Th><Th /></Tr></Thead>
                <Tbody>
                  <Tr>
                    <Td dataLabel="Tracker"><b>jira-cloud-prod</b><br />{muted('redhat.atlassian.net · basic-auth')}</Td>
                    <Td dataLabel="Connection"><Label color="yellow" isCompact>degraded</Label><br /><span className="u-muted u-meta">identity probe OK · sync failing: REST v2 search removed (CHANGE-2046)</span></Td>
                    <Td dataLabel="Last verified">2m ago <span className="u-muted u-meta">10s/60s cycles</span></Td>
                    <Td dataLabel="Sync outcome">12 created · 118 updated · <b>3 failed</b> · <a href="#scr=waves">ticket export →</a></Td>
                    <Td dataLabel="Consumers">2 waves · 14 open tickets</Td>
                    <Td><Button variant="secondary" size="sm">delete</Button></Td>
                  </Tr>
                  <Tr>
                    <Td dataLabel="Tracker"><b>jira-dc-legacy</b><br />{muted('jira.internal:8443 · basic-auth')}</Td>
                    <Td dataLabel="Connection"><Label color="green" isCompact>connected (HTTP 200)</Label></Td>
                    <Td dataLabel="Last verified">5m ago <span className="u-muted u-meta">10s/60s cycles</span></Td>
                    <Td dataLabel="Sync outcome">31 created · 210 updated · 0 failed · <a href="#scr=waves">ticket export →</a></Td>
                    <Td dataLabel="Consumers">1 wave · 22 open tickets</Td>
                    <Td><Button variant="secondary" size="sm">delete</Button></Td>
                  </Tr>
                </Tbody>
              </Table>
              <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
                Test-connection-on-save runs before a tracker is created or updated — today the form validates URL shape only, so problems surface via post-create polling (tackle2-ui#3116). · Tracker: REST v3 endpoint <Label color="green" isCompact>healthy</Label>
              </Content>
            </CardBody>
          </Card>
          <Card style={{ marginTop: 'var(--rh-space-lg)' }}>
            <CardHeader><CardTitle>Pluggable tracker integrations</CardTitle></CardHeader>
            <CardBody>
              <Table aria-label="Pluggable tracker integrations" variant="compact">
                <Thead><Tr><Th>Kind</Th><Th>Source</Th><Th>Status</Th><Th>Used by</Th></Tr></Thead>
                <Tbody>
                  <Tr><Td dataLabel="Kind">Jira Cloud</Td><Td dataLabel="Source">built-in</Td><Td dataLabel="Status"><Label color="green" isCompact>REST v3</Label></Td><Td dataLabel="Used by">jira-cloud-prod</Td></Tr>
                  <Tr><Td dataLabel="Kind">Jira Server / Data Center</Td><Td dataLabel="Source">built-in</Td><Td dataLabel="Status"><Label color="green" isCompact>supported</Label></Td><Td dataLabel="Used by">jira-dc-legacy</Td></Tr>
                  <Tr><Td dataLabel="Kind">GitHub Issues</Td><Td dataLabel="Source">plugin · v0.3</Td><Td dataLabel="Status"><Label color="yellow" isCompact>preview</Label></Td><Td dataLabel="Used by">{muted('—')}</Td></Tr>
                  <Tr><Td dataLabel="Kind">Your tracker</Td><Td dataLabel="Source">SPI slot · versioned contract</Td><Td dataLabel="Status"><Label variant="outline" isCompact>install from catalog</Label></Td><Td dataLabel="Used by">{muted('—')}</Td></Tr>
                </Tbody>
              </Table>
              <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
                Documented tracker surface: kinds, identity kinds (the identity kind must be exactly <code>basic-auth</code>), the required tracker <code>name</code> field, and the background connectivity tester&apos;s 10s/60s cycles.
              </Content>
            </CardBody>
          </Card>
        </Tab>

        {/* ================= RULES ================= */}
        <Tab eventKey="rules" title={<TabTitleText>Rules</TabTitleText>} aria-label="Rules">
          <Card style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
            <CardHeader actions={{ actions: <><Button variant="primary">Upload ruleset</Button>{' '}<Button variant="secondary">Validate all</Button></> }}>
              <CardTitle>Custom rulesets</CardTitle>
            </CardHeader>
            <CardBody>
              <Table aria-label="Custom rulesets" variant="compact">
                <Thead><Tr><Th>Ruleset</Th><Th>Source</Th><Th>Rules</Th><Th>Validation</Th><Th /></Tr></Thead>
                <Tbody>
                  <Tr>
                    <Td dataLabel="Ruleset"><code>platform-custom</code></Td>
                    <Td dataLabel="Source">organization</Td>
                    <Td dataLabel="Rules">14</Td>
                    <Td dataLabel="Validation"><Label color="green" isCompact>valid</Label></Td>
                    <Td dataLabel="Actions"><a href="#">Edit</a> · <a href="#">Download</a></Td>
                  </Tr>
                  <Tr>
                    <Td dataLabel="Ruleset"><code>weblogic-to-eap</code></Td>
                    <Td dataLabel="Source">bundled</Td>
                    <Td dataLabel="Rules">6</Td>
                    <Td dataLabel="Validation"><Label color="green" isCompact>valid</Label></Td>
                    <Td dataLabel="Actions">{muted('—')}</Td>
                  </Tr>
                </Tbody>
              </Table>
              <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
                IDE-authored rules validate against the same engine (<code>POST /rulesets/validate</code>) and publish here — edits on either surface converge. How the rules performed lives in Reports → Rule coverage.
              </Content>
            </CardBody>
          </Card>
        </Tab>

        {/* ================= AUTOMATION ================= */}
        <Tab eventKey="automation" title={<TabTitleText>Automation</TabTitleText>} aria-label="Automation">
          <Card style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
            <CardHeader actions={{ actions: <Button variant="secondary">Export usage CSV</Button> }}>
              <CardTitle>Gateway usage</CardTitle>
            </CardHeader>
            <CardBody>
              <Table aria-label="Gateway usage" variant="compact">
                <Thead><Tr><Th>Gateway / model</Th><Th>Tier</Th><Th>Health</Th><Th>Runs (30d)</Th><Th>Tokens (30d)</Th><Th>Rate → est. cost (30d)</Th><Th>Consumers</Th></Tr></Thead>
                <Tbody>
                  {MOCK_GATEWAYS.map(g => (
                    <Tr key={g.name}>
                      <Td dataLabel="Gateway"><b>{g.name}</b><br />{muted(`${g.model} · ctx ${g.ctx}`)}</Td>
                      <Td dataLabel="Tier"><Label color={g.tier === 'premium' ? 'purple' : 'teal'} isCompact>{g.tier}</Label></Td>
                      <Td dataLabel="Health"><Label color="green" isCompact>{g.health}</Label> <span className="u-muted u-meta">{g.healthAge}</span></Td>
                      <Td dataLabel="Runs">{g.runs30d}</Td>
                      <Td dataLabel="Tokens">{g.tokens30d}</Td>
                      <Td dataLabel="Rate">
                        <span style={{ whiteSpace: 'nowrap' }}><b>{gwCost(g.tokens30d, rates[g.name] || g.rate)}</b> <span className="u-muted">=</span>{' '}
                          <input type="number" min={0} step={0.0001} value={rates[g.name] || g.rate}
                            aria-label={`Rate per 1M tokens for ${g.name}`}
                            style={{ width: 78, padding: 'var(--rh-space-xs) var(--rh-space-md)' }}
                            onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) setRates(r => ({ ...r, [g.name]: String(v) })); }} />
                          <span className="u-muted"> /1M</span></span>
                      </Td>
                      <Td dataLabel="Consumers"><a href="#scr=agentic">{g.consumers} →</a></Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
              <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
                The rate field is the monetary amount assigned to token usage per gateway — editing it re-prices that gateway&apos;s showback (tokens × rate). Model tiering in action: the verify stage runs on standard, the execute stage can be pinned to premium per run.
              </Content>
            </CardBody>
          </Card>
          <Card style={{ marginTop: 'var(--rh-space-lg)' }}>
            <CardHeader actions={{ actions: <Label color="orange" isCompact>1 pending</Label> }}>
              <CardTitle>Agent registry curation</CardTitle>
            </CardHeader>
            <CardBody>
              <Content component={ContentVariants.small} style={{ marginBottom: 'var(--rh-space-md)' }}>
                Registration requests for the A2A Agent Card registry (the published cards live on <a href="#scr=agentic">Agent runs →</a>). Approval is a sensitive mutation — every decision lands in the audit log, and an approved agent&apos;s stages run under the same sandbox envelope as factory agents.
              </Content>
              <Table aria-label="Agent registration requests" variant="compact">
                <Thead><Tr><Th>Agent</Th><Th>Requested by</Th><Th>Declared capabilities</Th><Th>Requested access</Th><Th /></Tr></Thead>
                <Tbody>
                  <Tr>
                    <Td dataLabel="Agent"><code>serdes-modernizer</code><br />{muted('third-party · v0.4 · execute stage')}</Td>
                    <Td dataLabel="Requested by">a.weber@northwind-financial.com · 2d ago</Td>
                    <Td dataLabel="Capabilities">extended card · skills: schema-diff, serdes-rewrite · auth: OAuth 2.1</Td>
                    <Td dataLabel="Access">MCP tools: <code>analyze</code>, <code>transform</code> · gateway: standard tier · egress: mta-hub only</Td>
                    <Td><Button variant="primary" size="sm">approve</Button>{' '}<Button variant="danger" size="sm">reject</Button></Td>
                  </Tr>
                </Tbody>
              </Table>
              <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
                Recent decisions: <code>remediation-internal</code> — approved by admin · 2026-10-12 · audited · <code>code-gen-universal</code> — <Label color="red" isCompact>rejected</Label> by admin · 2026-09-30 · reason: requested unscoped egress · <a href="#">audit entries →</a>
              </Content>
            </CardBody>
          </Card>
          <Card style={{ marginTop: 'var(--rh-space-lg)' }}>
            <CardHeader actions={{ actions: <Button variant="secondary">Copy client config</Button> }}>
              <CardTitle>MCP server</CardTitle>
            </CardHeader>
            <CardBody>
              <Content component={ContentVariants.small} style={{ marginBottom: 'var(--rh-space-md)' }}>
                <b>https://mta-hub.apps.example.com/mcp</b> <Label color="green" isCompact>running</Label>{' '}
                <span className="u-muted">spec 2026-07-28 · 14 tools · 7 clients connected · OTel traces/metrics in cluster monitoring</span>
              </Content>
              <Table aria-label="MCP tools" variant="compact">
                <Thead><Tr><Th>Tool</Th><Th>Toolset</Th><Th>Mode</Th><Th>Notes</Th></Tr></Thead>
                <Tbody>
                  {([
                    ['run_analysis', 'Analysis', <Label key="m" color="yellow" isCompact>write · opt-in</Label>, <>starts a Hub analysis run; progress rides task events</>],
                    ['get_analysis_results', 'Analysis', <Label key="m" color="teal" isCompact>read-only</Label>, <>results + run diff</>],
                    ['get_incidents_by_file', 'Analysis', <Label key="m" color="teal" isCompact>read-only</Label>, <>the tool set the Konveyor editor-extension bridge already proves</>],
                    ['get_effort_rollup', 'Portfolio', <Label key="m" color="teal" isCompact>read-only</Label>, <>portfolio data complementing the SARIF/SBOM exports</>],
                    ['get_solved_examples', 'Solution server', <Label key="m" color="teal" isCompact>read-only</Label>, <>solved examples + confidence metrics from any MCP client</>],
                    ['validate_rule_yaml', 'Rules', <Label key="m" color="teal" isCompact>read-only</Label>, <>rule generation/validation via MCP — the proven community pattern</>],
                  ] as [string, string, React.ReactNode, React.ReactNode][]).map(([tool, set, mode, note]) => (
                    <Tr key={tool}>
                      <Td dataLabel="Tool"><code>{tool}</code></Td>
                      <Td dataLabel="Toolset">{set}</Td>
                      <Td dataLabel="Mode">{mode}</Td>
                      <Td dataLabel="Notes">{note}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
              <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
                <b>Auth:</b> OAuth 2.1 with Enterprise Managed Authorization; clients authenticate by exchanging Hub tokens — the server implements explicit token exchange rather than shared IdP configuration.
              </Content>
              <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-xs)' }}>
                <b>Inference &amp; audit:</b> tool execution that needs model access obtains it via the MaaS gateway under OIDC — no static provider keys — and write-tool opt-ins are recorded in the audit log. <a href="#scr=agentic">Agent runs →</a>
              </Content>
            </CardBody>
          </Card>
          <Card style={{ marginTop: 'var(--rh-space-lg)' }}>
            <CardHeader actions={{ actions: <><Button variant="secondary">OpenAPI spec</Button>{' '}<Button variant="secondary">Automation guide</Button></> }}>
              <CardTitle>Hub API</CardTitle>
            </CardHeader>
            <CardBody>
              <Content component={ContentVariants.small} style={{ marginBottom: 'var(--rh-space-md)' }}>
                <b>https://mta-hub.apps.example.com/hub</b> <Label color="green" isCompact>spec in parity</Label>{' '}
                <span className="u-muted">OpenAPI 3 · contract v2.1 · parity gate green (0 route/spec drift) · 1 deprecation notice</span>
              </Content>
              <Table aria-label="Hub API surfaces" variant="compact">
                <Thead><Tr><Th>Surface</Th><Th>Stability</Th><Th>Notes</Th></Tr></Thead>
                <Tbody>
                  <Tr>
                    <Td dataLabel="Surface">Inventory &amp; analysis <code>/applications, /analyses, /waves…</code></Td>
                    <Td dataLabel="Stability"><Label color="green" isCompact>stable</Label></Td>
                    <Td dataLabel="Notes">ETag/If-Match on mutations; structured error bodies with stable codes</Td>
                  </Tr>
                  <Tr>
                    <Td dataLabel="Surface">Batch &amp; events <code>/batch/*, /events</code></Td>
                    <Td dataLabel="Stability"><Label color="teal" isCompact>beta</Label></Td>
                    <Td dataLabel="Notes">bulk operations and task/webhook events (Suggestion 33&apos;s extension set)</Td>
                  </Tr>
                  <Tr>
                    <Td dataLabel="Surface"><code>/manifests, /adoptionplans</code></Td>
                    <Td dataLabel="Stability"><Label color="yellow" isCompact>evolving</Label></Td>
                    <Td dataLabel="Notes">agentic surfaces — expect additive change; tracked in release notes</Td>
                  </Tr>
                </Tbody>
              </Table>
              <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
                <b>Automation access:</b> one service account per pipeline, least-privilege scopes (rotate under <a href="#scr=config">Tokens</a>); every mutation attributed in the audit log. Generated Go/Python/TypeScript clients and the import → analyze → triage → report walkthrough ship with the spec.
              </Content>
            </CardBody>
          </Card>
        </Tab>

        {/* ================= PLATFORM ================= */}
        <Tab eventKey="platform" title={<TabTitleText>Platform</TabTitleText>} aria-label="Platform">
          <Card style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
            <CardHeader><CardTitle>Platform settings (R2-14: manifest-driven — each setting documented, validated, audited)</CardTitle></CardHeader>
            <CardBody>
              <Table aria-label="Platform settings" variant="compact">
                <Thead><Tr><Th>Setting</Th><Th>Value</Th><Th>Description</Th><Th>Effect</Th><Th>Audit</Th></Tr></Thead>
                <Tbody>
                  <Tr>
                    <Td dataLabel="Setting">Report download</Td>
                    <Td dataLabel="Value"><SwitchMock id="sw-download" /></Td>
                    <Td dataLabel="Description">Allows downloading the full static HTML report (contains source-derived findings)</Td>
                    <Td dataLabel="Effect"><b>hot</b> (R2-14: hot settings confirm before applying)</Td>
                    <Td dataLabel="Audit"><a href="#" onClick={e => e.preventDefault()}>last change: admin · 3d ago</a></Td>
                  </Tr>
                  <Tr>
                    <Td dataLabel="Setting">Insecure Git consumption</Td>
                    <Td dataLabel="Value"><SwitchMock id="sw-git" /></Td>
                    <Td dataLabel="Description">Permits HTTP/non-TLS Git sources — MITM exposure (R2-14)</Td>
                    <Td dataLabel="Effect">next task</Td>
                    <Td dataLabel="Audit"><a href="#" onClick={e => e.preventDefault()}>never changed</a></Td>
                  </Tr>
                  <Tr>
                    <Td dataLabel="Setting">Proxy (HTTP/HTTPS)</Td>
                    <Td dataLabel="Value"><Label color="teal" isCompact>configured</Label></Td>
                    <Td dataLabel="Description">Egress proxy — scope display: task clones ✓ · tracker sync ✗ (hub#420) (R2-16)</Td>
                    <Td dataLabel="Effect">next task</Td>
                    <Td dataLabel="Audit"><a href="#" onClick={e => e.preventDefault()}>admin · 12d ago</a></Td>
                  </Tr>
                </Tbody>
              </Table>
            </CardBody>
          </Card>
          <Card style={{ marginTop: 'var(--rh-space-lg)' }}>
            <CardHeader actions={{ actions: <Button variant="secondary">Edit CR values</Button> }}>
              <CardTitle>Hub deployment</CardTitle>
            </CardHeader>
            <CardBody>
              <Table aria-label="Hub deployment" variant="compact">
                <Thead><Tr><Th>Field</Th><Th>Value</Th><Th>Status</Th></Tr></Thead>
                <Tbody>
                  <Tr><Td dataLabel="Field"><code>spec.replicas</code></Td><Td dataLabel="Value">3 (hub) · 2 (keycloak) · 1 (jobs)</Td><Td dataLabel="Status"><Label color="green" isCompact>reconciled</Label></Td></Tr>
                  <Tr><Td dataLabel="Field"><code>spec.placement</code></Td><Td dataLabel="Value"><code>nodeSelector</code> workload-isolation=true · <code>tolerations</code> 1</Td><Td dataLabel="Status"><Label color="green" isCompact>reconciled</Label></Td></Tr>
                  <Tr><Td dataLabel="Field"><code>spec.resources</code></Td><Td dataLabel="Value">hub: 2 CPU / 4 Gi · override <code>spec.overrides[0]</code> adds <code>JAVA_OPTS</code></Td><Td dataLabel="Status"><Label color="green" isCompact>reconciled</Label></Td></Tr>
                  <Tr><Td dataLabel="Field"><code>spec.overrides[1]</code> volumeSize</Td><Td dataLabel="Value">200Gi → 300Gi pending</Td><Td dataLabel="Status"><Label color="yellow" isCompact>applying</Label></Td></Tr>
                </Tbody>
              </Table>
              <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
                Everything the Operator reconciles is settable in the CR and shown here with reconcile status — no imperative <code>kubectl edit</code>, no divergence between Git and the cluster.
              </Content>
            </CardBody>
          </Card>
          <Card style={{ marginTop: 'var(--rh-space-lg)' }}>
            <CardHeader actions={{ actions: <Button variant="secondary">Add registry connection</Button> }}>
              <CardTitle>Schema registry</CardTitle>
            </CardHeader>
            <CardBody>
              <Table aria-label="Schema registry" variant="compact">
                <Thead><Tr><Th>Connection</Th><Th>API</Th><Th>Artifacts</Th><Th>Findings</Th></Tr></Thead>
                <Tbody>
                  <Tr>
                    <Td dataLabel="Connection">event-contracts (prod)</Td>
                    <Td dataLabel="API">Registry v3</Td>
                    <Td dataLabel="Artifacts">112 (Avro 90 · JSON Schema 18 · Protobuf 4)</Td>
                    <Td dataLabel="Findings"><Label color="yellow" isCompact>6 compatibility warnings</Label> — payments-api consumes 2 of the flagged schemas</Td>
                  </Tr>
                  <Tr>
                    <Td dataLabel="Connection">event-contracts (stage)</Td>
                    <Td dataLabel="API">Registry v3</Td>
                    <Td dataLabel="Artifacts">112</Td>
                    <Td dataLabel="Findings"><Label color="green" isCompact>in sync</Label></Td>
                  </Tr>
                </Tbody>
              </Table>
              <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
                Schema compatibility findings appear as incidents with the same triage/ticket flow as code findings — the Kafka contract risk in the Waves charter comes from here.
              </Content>
            </CardBody>
          </Card>
        </Tab>
      </Tabs>

      {/* revoke API-key confirmation (port of modalRevoke) */}
      <Modal variant="small" isOpen={revokeOpen} onClose={() => setRevokeOpen(false)} aria-label="Revoke API key?">
        <ModalHeader title="Revoke API key?" labelId="revoke-title" />
        <ModalBody>
          <p>The key stops authenticating immediately. Anything still using it (automation, integrations) will fail with 401 until re-issued.</p>
        </ModalBody>
        <ModalFooter>
          <Button variant="danger" onClick={() => setRevokeOpen(false)}>Revoke</Button>
          <Button variant="link" onClick={() => setRevokeOpen(false)}>Cancel</Button>
        </ModalFooter>
      </Modal>
    </>
  );
}

/* ---------- helpers ---------- */

function SwitchMock({ id }: { id: string }) {
  const [on, setOn] = useState(false);
  return (
    <label className="pf-v6-c-switch" htmlFor={id}>
      <input className="pf-v6-c-switch__input" type="checkbox" id={id} checked={on} onChange={e => setOn(e.target.checked)} />
      <span className="pf-v6-c-switch__toggle" />
      <span className="pf-v6-c-switch__label pf-m-off" aria-hidden="true">off</span>
    </label>
  );
}

function StakeholderPager({ people }: { people: Array<{ name: string; email: string; func: string }> }) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const rows = people;
  const slice = rows.slice((page - 1) * perPage, page * perPage);
  return (
    <>
      <Table aria-label="Stakeholders" variant="compact">
        <Thead><Tr><Th>Name</Th><Th>Email</Th><Th>Job function</Th><Th>Groups</Th><Th>Business services</Th></Tr></Thead>
        <Tbody>
          {slice.map(p => (
            <Tr key={p.name}>
              <Td dataLabel="Name"><b>{p.name}</b></Td>
              <Td dataLabel="Email"><a href="#" onClick={e => e.preventDefault()}>{p.email}</a></Td>
              <Td dataLabel="Job function">{p.func}</Td>
              <Td dataLabel="Groups">{MOCK_GROUPS.filter(g => g.members.includes(p.name)).map(g => g.name).join(', ') || <span className="u-muted">—</span>}</Td>
              <Td dataLabel="Business services">{(STAKE_OVERRIDES as Record<string, { bsvcs?: string[] }>)[p.name]?.bsvcs?.length ? (STAKE_OVERRIDES as Record<string, { bsvcs?: string[] }>)[p.name].bsvcs!.join(', ') : <span className="u-muted">—</span>}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
      <Pagination itemCount={rows.length} perPage={perPage} page={page}
        onSetPage={(_e, p) => setPage(p)} onPerPageSelect={(_e, pp) => { setPerPage(pp); setPage(1); }}
        widgetId="stake-pagination" titles={{ items: 'stakeholders' }} />
    </>
  );
}

function AuditPager() {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const slice = AUDIT_LOG.slice((page - 1) * perPage, page * perPage);
  return (
    <>
      <Table aria-label="Cross-tenant audit trail" variant="compact">
        <Thead><Tr><Th>Time</Th><Th>Actor</Th><Th>Action</Th><Th>Target</Th></Tr></Thead>
        <Tbody>
          {slice.map((e, i) => (
            <Tr key={i}>
              <Td dataLabel="Time">{e.ts}</Td>
              <Td dataLabel="Actor">{e.actor}</Td>
              <Td dataLabel="Action"><code>{e.action}</code></Td>
              <Td dataLabel="Target">{dec(e.target)}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
      <Pagination itemCount={AUDIT_LOG.length} perPage={perPage} page={page}
        onSetPage={(_e, p) => setPage(p)} onPerPageSelect={(_e, pp) => { setPerPage(pp); setPage(1); }}
        widgetId="audit-pagination" titles={{ items: 'audit entries' }} />
    </>
  );
}
