import { useState } from 'react';
import {
  Card, CardBody, CardHeader, CardTitle, Title, Content, ContentVariants, Tabs, Tab, TabTitleText,
  Label, Button, Modal, ModalHeader, ModalBody,
  Alert, ProgressStepper, ProgressStep as Step, Split, SplitItem,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import RhMicronsCaretDownIcon from '@patternfly/react-icons/dist/esm/icons/rh-microns-caret-down-icon';
import { useApp, useScoped, can, TEAM_BY_ID } from '../state/appState';
import { useHub, type HubData, type AppRow } from '../api/hub';
import { dec } from '../utils/decode';

type Row = AppRow;
type Ticket = HubData['tickets'][string];
type Evidence = HubData['evidence'][string];

/* hub-backed stores — bound at the top of Waves() (all consumers render under it) */
let APPS: Row[] = [];
let RUNS: Array<{ app: string; tokens: string; cost: string }> = [];
let EVIDENCE: Record<string, Evidence> = {};
let TICKETS: Record<string, Ticket> = {};
let CREDS: HubData['creds'] = [];
let WAVE_DEPS: HubData['deps'] = [];

/* static per-wave lane metadata — the mock's scr-waves bars, labels, planned→actual,
   composition and stakeholders are template statics; membership/gates/evidence/tickets derive */
const WAVE_META: Record<number, {
  label: string | null; labelColor: string;
  bar: { left: number; width: number; bg: string; fg?: string; text: string };
  planned: React.ReactNode; composition: React.ReactNode; stakeholders: React.ReactNode;
  detailChrome: boolean; defaultExpanded?: boolean;
}> = {
  1: {
    label: 'done', labelColor: 'green',
    bar: { left: 2, width: 22, bg: 'var(--pf-t--global--color--status--success--default)', text: '2026-09-01/2026-09-15 · 100%' },
    planned: <>2026-09-01/2026-09-15 &rarr; 2026-09-01/2026-09-15</>,
    composition: <span className="u-muted">&mdash;</span>,
    stakeholders: <>M. Keller</>,
    detailChrome: false,
  },
  2: {
    label: 'done', labelColor: 'green',
    bar: { left: 24, width: 20, bg: 'var(--pf-t--global--color--status--warning--default)', fg: 'var(--rh-color-yellow-80)', text: '2026-09-22/2026-10-03 · 88%' },
    planned: <>2026-09-22/2026-10-03 &rarr; 2026-10-05 <Label color="yellow" isCompact>+2d</Label></>,
    composition: <span className="u-muted">&mdash;</span>,
    stakeholders: <>M. Keller, P. Schmidt</>,
    detailChrome: false,
  },
  3: {
    label: 'blocked', labelColor: 'red',
    bar: { left: 44, width: 22, bg: 'var(--pf-t--global--color--status--danger--default)', text: '2026-10-13/2026-10-24 · 35% · gate failing' },
    planned: <>2026-10-13/2026-10-24 &rarr; running</>,
    composition: <><Label color="purple" isCompact>rule R-12 added 3 apps</Label>{' '}
      <RevalidateButton /></>,
    stakeholders: <>M. Keller, J. Cordes</>,
    detailChrome: true, defaultExpanded: true,
  },
  4: {
    label: null, labelColor: 'grey',
    bar: { left: 66, width: 24, bg: 'var(--pf-t--global--color--status--custom--default)', text: '2026-11-03/2026-11-21 · planned' },
    planned: <>2026-11-03/2026-11-21 &rarr; <span className="u-muted">&mdash;</span></>,
    composition: <span className="u-muted">&mdash;</span>,
    stakeholders: <><span className="u-muted">&mdash;</span> pending staffing</>,
    detailChrome: true,
  },
};

function RevalidateButton() {
  const { state } = useApp();
  const ok = can(state.persona, 'update', 'waves');
  return (
    <Button variant="secondary" size="sm" isDisabled={!ok}
      title={ok ? undefined : 'Missing scope waves:edit'}>
      re-validate
    </Button>
  );
}

/* ---------- derived aggregates (ports of buildWaveMembers / waveGateFacts) ---------- */
const fmtTok = (n: number) => (n >= 1e6 ? (Math.round(n / 1e5) / 10) + 'M' : Math.round(n / 1e3) + 'k');
function spendOf(name: string) {
  const rs = RUNS.filter(r => r.app === name);
  return {
    n: rs.length,
    tok: rs.reduce((t, r) => t + (parseInt(String(r.tokens).replace(/\D/g, ''), 10) || 0), 0),
    cost: rs.reduce((t, r) => t + (parseFloat(String(r.cost).replace(/[^0-9.]/g, '')) || 0), 0),
  };
}
function spendHtml(sp: { n: number; tok: number; cost: number }, bold?: boolean) {
  if (!sp.n) return <span className="u-muted">&mdash;</span>;
  return (
    <>
      {bold ? <b>${sp.cost.toFixed(2)}</b> : `$${sp.cost.toFixed(2)}`}{' '}
      <span className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)' }}>
        {fmtTok(sp.tok)} tokens · {sp.n} run{sp.n > 1 ? 's' : ''}
      </span>
    </>
  );
}

function gateFacts(members: Row[]) {
  const openTk = members.filter(a => TICKETS[a.name as string] && TICKETS[a.name as string].outcome !== 'closed').length;
  const quota = members.filter(a => a.state === 'quota');
  let suites = 0, red = 0;
  members.forEach(a => { const e = EVIDENCE[a.name as string]; if (e && e.total) { suites += e.total; red += e.red || 0; } });
  const credUse: Record<string, string[]> = {};
  members.forEach(a => { if (a.credName) (credUse[a.credName as string] = credUse[a.credName as string] || []).push(a.name as string); });
  const expiring = CREDS.filter(c => c.expLabel === 'expiring' && credUse[c.name]).map(c => ({ name: c.name, apps: credUse[c.name], when: c.expires }));
  const unverUsed = CREDS.filter(c => c.verifiedLabel === 'unverified' && credUse[c.name]).map(c => ({ name: c.name, apps: credUse[c.name] }));
  const teams = [...new Set(members.map(a => a.team as string).filter(Boolean))];
  const unverIdle = CREDS.filter(c => c.verifiedLabel === 'unverified' && teams.includes(c.team) && !credUse[c.name]);
  return { openTk, quota, suites, red, expiring, unverUsed, unverIdle, failing: openTk > 0 || red > 0 || quota.length > 0 || expiring.length > 0 || unverUsed.length > 0 };
}

const GATE_MARK = { ok: '\u2713', warn: '\u26a0', fail: '\u2715' };

/* ---------- one wave lane ---------- */
function WaveLane({ wv }: { wv: number }) {
  const { state } = useApp();
  const { apps } = useScoped();
  const meta = WAVE_META[wv];
  const members = apps.filter(a => String(a.wave) === String(wv)) as Row[];
  const [open, setOpen] = useState(!!meta.defaultExpanded);
  const [tab, setTab] = useState<'apps' | 'gate' | 'verify' | 'tickets'>('apps');

  /* stats cells (dash when no sampled members, like the mock) */
  const stateLabel: Record<string, string> = { succeeded: 'succeeded', running: 'running', quota: 'quota-blocked' };
  const states: Record<string, number> = {};
  let sum = 0, unest = 0, partial = false;
  const risks: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
  let unass = 0;
  members.forEach(a => {
    const pts = parseInt(String(a.pts ?? ''), 10);
    if (!isNaN(pts)) sum += pts; else unest++;
    if (a.state === 'running') partial = true;
    const sk = stateLabel[a.state as string] || String(a.state);
    states[sk] = (states[sk] || 0) + 1;
    const k = a.risk as string | undefined;
    if (k && risks[k] !== undefined) risks[k]++; else unass++;
  });
  const dash = <span className="u-muted">&mdash;</span>;
  const f = gateFacts(members);

  const tname = (id: string) => TEAM_BY_ID[id]?.name ?? id;
  /* pgm coordination strip (port of renderPgmCoord — pgm persona only) */
  const coord = state.persona === 'pgm' ? (() => {
    const ts = [...new Set(members.map(a => a.team as string))];
    const wq = members.filter(a => a.state === 'quota');
    const edgeFor = WAVE_DEPS.map(d => {
      const fa = APPS.find(a => a.name === d.from), ta = APPS.find(a => a.name === d.to);
      if (!fa || !ta || !fa.wave || !ta.wave || +fa.wave === +ta.wave) return null;
      const ft = TEAM_BY_ID[fa.team], tt = TEAM_BY_ID[ta.team];
      const cross = ft && tt && ft.id !== tt.id;
      if (+fa.wave === wv) return <>Dependency edge out: {d.from} (team {ft?.name ?? fa.team}) &rarr; {d.to} (team {tt?.name ?? ta.team}, Wave {ta.wave}) &mdash; {cross ? <><b>crosses a team boundary</b>, sequence is a program decision.</> : <>stays within team {ft?.name ?? fa.team}, no cross-team ordering constraint.</>}</>;
      if (+ta.wave === wv) return <>Dependency edge in: &larr; {d.from} (team {ft?.name ?? fa.team}, Wave {fa.wave}) &mdash; {cross ? <><b>crosses a team boundary</b>.</> : <>stays within team {tt?.name ?? ta.team}.</>}</>;
      return null;
    }).filter(Boolean) as React.ReactNode[];
    if (!members.length) {
      return <div style={{ marginBottom: 'var(--rh-space-md)' }}><b>Cross-team coordination</b> <span className="u-muted">no sampled members &mdash; the coordination view fills in as the wave is planned.</span></div>;
    }
    return (
      <div style={{ marginBottom: 'var(--rh-space-md)' }}>
        <b>Cross-team coordination</b>{' '}
        <span className="u-muted">Contributing teams:</span> {ts.map(tname).join(', ')}{' '}
        {ts.length > 1
          ? <Label color="orange" isCompact>Cross-team — one change window, one escalation path</Label>
          : <Label color="green" isCompact>Single team</Label>}
        {wq.length > 0 && <> · <b>Quota-blocked:</b> {wq.map(a => `${a.name} (team ${tname(a.team as string)})`).join(', ')} &mdash; the raise path is a program-level decision.</>}
        {edgeFor.length > 0 && <> · {edgeFor.map((e, i) => <span key={i}>{i > 0 ? ' · ' : ''}{e}</span>)}</>}
      </div>
    );
  })() : null;

  const tbbRows = members.filter(a => TICKETS[a.name as string]);

  return (
    <div className="wave-exec">
      <div className="lane" style={{ marginBottom: 'var(--rh-space-xs)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--rh-space-md)' }}>
          <button
            className={`pf-v6-c-button pf-m-plain pf-v6-c-table__button${open ? ' pf-m-expanded' : ''}`}
            type="button"
            aria-expanded={open}
            aria-controls={`wave-members-${wv}`}
            aria-label={`Toggle Wave ${wv} execution details`}
            onClick={() => setOpen(o => !o)}
          >
            <span className="pf-v6-c-table__toggle-icon">
              {/* standard PF6 toggle icon — the same one react-table's CollapseColumn renders; the
                  .wave-exec rotation rules in index.css flip it on pf-m-expanded */}
              <RhMicronsCaretDownIcon />
            </span>
          </button>
          <b>Wave {wv}</b>{' '}
          {meta.label && <Label color={meta.labelColor as 'green' | 'red'}>{meta.label}</Label>}
        </span>
        <div className="track">
          <div
            className="bar"
            style={{
              left: `${meta.bar.left}%`, width: `${meta.bar.width}%`, background: meta.bar.bg,
              ...(meta.bar.fg ? { color: meta.bar.fg } : {}),
            }}
          >{meta.bar.text}</div>
        </div>
      </div>
      <div className="wave-stats">
        <div className="wave-stat"><div className="wave-stat-k">Members</div><div className="wave-stat-v">
          {members.length
            ? <Label color={wv === 4 ? 'grey' : 'teal'} variant={wv === 4 ? 'outline' : undefined}>{members.length} sampled application{members.length > 1 ? 's' : ''}</Label>
            : <><span className="u-muted">&mdash;</span> no sampled applications</>}
        </div></div>
        <div className="wave-stat"><div className="wave-stat-k">Planned &rarr; actual</div><div className="wave-stat-v">{meta.planned}</div></div>
        <div className="wave-stat"><div className="wave-stat-k">Composition</div><div className="wave-stat-v">{meta.composition}</div></div>
        <div className="wave-stat"><div className="wave-stat-k">Stakeholders</div><div className="wave-stat-v">{meta.stakeholders}</div></div>
        <div className="wave-stat"><div className="wave-stat-k">Analysis</div><div className="wave-stat-v">
          {!members.length ? dash : ['succeeded', 'running', 'quota-blocked'].filter(k => states[k]).map(k => `${states[k]} ${k}`).join(' · ')}
        </div></div>
        <div className="wave-stat"><div className="wave-stat-k">Risk</div><div className="wave-stat-v">
          {!members.length ? dash
            : <>{['High', 'Medium', 'Low'].filter(k => risks[k]).map(k => `${risks[k]} ${k.toLowerCase()}`).join(' · ')}
              {unass > 0 && <span className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)' }}> · {unass} unassessed</span>}</>}
        </div></div>
        <div className="wave-stat"><div className="wave-stat-k">Total effort</div><div className="wave-stat-v">
          {!members.length ? dash
            : <><b>{sum.toLocaleString('en-US')}</b>{unest > 0 && <span className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)' }}> (+{unest} unestimated)</span>}</>}
        </div></div>
        <div className="wave-stat"><div className="wave-stat-k">Agent spend</div><div className="wave-stat-v">
          {!members.length ? dash
            : spendHtml(members.reduce((a, m) => { const sp = spendOf(m.name as string); a.tok += sp.tok; a.cost += sp.cost; a.n += sp.n; return a; }, { n: 0, tok: 0, cost: 0 }), true)}
        </div></div>
      </div>
      {open && (
        <div className="wave-exec-detail" id={`wave-members-${wv}`}>
          {coord}
          {!meta.detailChrome
            ? <span className="u-muted">no sampled applications &mdash; completed before the sample window</span>
            : members.length === 0
              ? <span className="u-muted">no sampled members in the current scope &mdash; the coordination view fills in as the wave is planned.</span>
              : (
                <>
                  <GateSteps facts={f} />
                  <Tabs activeKey={tab} onSelect={(_e, k) => setTab(k as typeof tab)} aria-label={`Wave ${wv} detail tabs`} className="pf-m-compact" style={{ marginBottom: 'var(--rh-space-lg)' }}>
                    <Tab eventKey="apps" title={<TabTitleText>Applications <span className="u-muted"> {members.length}</span></TabTitleText>} aria-label="Applications">
                      <MembersTable members={members} sum={sum} unest={unest} partial={partial} />
                    </Tab>
                    <Tab eventKey="gate" title={<TabTitleText>Gate status {f.failing
                      ? <span style={{ color: 'var(--pf-t--global--color--status--danger--default)' }} aria-label="gate failing">✕</span>
                      : <span style={{ color: 'var(--pf-t--global--color--status--success--default)' }} aria-label="gate passing">✓</span>}
                    </TabTitleText>} aria-label="Gate status">
                      <Card>
                        <CardHeader><CardTitle>Gate status</CardTitle></CardHeader>
                        <CardBody>
                          <GateList facts={f} />
                          <div style={{ marginTop: 'var(--rh-space-md)', fontSize: 'var(--rh-font-size-body-text-xs)' }}>
                            Overall:{' '}
                            {f.failing
                              ? <><Label color="red">BLOCKED</Label> — the conditions above name what is failing</>
                              : <><Label color="green">ON TRACK</Label> — all gate conditions met</>}
                          </div>
                        </CardBody>
                      </Card>
                    </Tab>
                    <Tab eventKey="verify" title={<TabTitleText>Verification evidence</TabTitleText>} aria-label="Verification evidence">
                      <Card>
                        <CardHeader><CardTitle>Verification evidence</CardTitle></CardHeader>
                        <CardBody>
                          <VerifyTable members={members} />
                          <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
                            Suites: repo path / CI job / image — executed in the sandbox, results as run artifacts
                          </Content>
                        </CardBody>
                      </Card>
                    </Tab>
                    <Tab eventKey="tickets" title={<TabTitleText>Tickets <span className="u-muted">{tbbRows.length ? ` ${tbbRows.length}` : ''}</span></TabTitleText>} aria-label="Tickets">
                      <TicketsPanel rows={tbbRows} />
                    </Tab>
                  </Tabs>
                </>
              )}
        </div>
      )}
    </div>
  );
}

function GateSteps({ facts: f }: { facts: ReturnType<typeof gateFacts> }) {
  const step = (key: string, variant: 'success' | 'warning' | 'danger', title: string, desc: string) => (
    <Step key={key} id={`gate-step-${key}`} titleId={`gate-step-title-${key}`} variant={variant} description={desc}>{title}</Step>
  );
  return (
    <ProgressStepper style={{ marginBottom: 'var(--rh-space-md)' }}>
      {step('tk', f.openTk ? 'danger' : 'success', 'Tickets closed', f.openTk ? `${f.openTk} ticket(s) still open` : 'no open tickets')}
      {step('quota', f.quota.length ? 'danger' : 'success', 'No quota blocks', f.quota.length ? f.quota.map(a => a.name).join(', ') + ' quota-blocked' : 'no quota-blocked applications')}
      {step('suites', f.suites ? (f.red ? 'danger' : 'success') : 'warning', 'Verification green', f.suites ? (f.red ? `${f.red} of ${f.suites} suites red` : `all ${f.suites} suites passing`) : 'no suites executed yet')}
      {step('cred', (f.expiring.length || f.unverUsed.length) ? 'warning' : 'success', 'Credentials ready', (f.expiring.length ? `${f.expiring.length} expiring; ` : '') + (f.unverUsed.length ? `${f.unverUsed.length} unverified in use` : 'credentials verified'))}
    </ProgressStepper>
  );
}

function GateList({ facts: f }: { facts: ReturnType<typeof gateFacts> }) {
  const li = (color: 'red' | 'green' | 'yellow', mark: string, html: React.ReactNode, key: string) => (
    <li key={key}><Label color={color}>{mark}</Label> {html}</li>
  );
  const credHtml = (
    <>
      Credentials verified —{' '}
      {f.expiring.length
        ? <><b>{f.expiring.length} expiring</b> ({f.expiring.map(c => `${c.name} → ${c.apps.join(', ')}`).join('; ')}{f.expiring.length === 1 ? `; ${f.expiring[0].when}` : ''})</>
        : 'all member credentials ok'}
      {f.unverUsed.length
        ? <>; <b>{f.unverUsed.length} unverified in use</b> ({f.unverUsed.map(c => `${c.name} → ${c.apps.join(', ')}`).join('; ')})</>
        : f.unverIdle.length
          ? <>; the {f.unverIdle.length} unverified {f.unverIdle.length > 1 ? 'are' : 'is'} unassigned (no gate impact)</>
          : null}
      {' '}
    </>
  );
  return (
    <ul className="pf-v6-c-list">
      {li(f.openTk ? 'red' : 'green', f.openTk ? GATE_MARK.fail : GATE_MARK.ok, <>Tickets closed — {f.openTk ? <b>{f.openTk} open</b> : 'none open'}</>, 'tk')}
      {li('green', GATE_MARK.ok, 'Zero blocking incidents', 'inc')}
      {f.quota.length
        ? li('red', GATE_MARK.fail, <><b>{f.quota.length} quota-blocked</b> task{f.quota.length > 1 ? 's' : ''} — {f.quota.map(a => a.name).join(', ')}</>, 'quota')
        : li('green', GATE_MARK.ok, 'No quota-blocked tasks', 'quota')}
      {f.suites
        ? (f.red
            ? li('red', GATE_MARK.fail, <>Integration tests green — <b>{f.red} of {f.suites} suites red</b></>, 'suites')
            : li('green', GATE_MARK.ok, <>Integration tests green — all {f.suites} suites passing</>, 'suites'))
        : li('yellow', GATE_MARK.warn, 'No suites executed for the current members yet', 'suites')}
      {li(f.expiring.length || f.unverUsed.length ? 'yellow' : 'green', f.expiring.length || f.unverUsed.length ? GATE_MARK.warn : GATE_MARK.ok, credHtml, 'cred')}
    </ul>
  );
}

function MembersTable({ members, sum, unest, partial }: { members: Row[]; sum: number; unest: number; partial: boolean }) {
  const stateLabel: Record<string, { text: string; color: 'green' | 'blue' | 'orange' | 'grey' | 'red' }> = {
    succeeded: { text: 'Succeeded', color: 'green' },
    running: { text: 'Running', color: 'blue' },
    quota: { text: 'Quota-blocked', color: 'orange' },
  };
  const notes: string[] = [];
  if (unest) notes.push(`${unest} app${unest > 1 ? 's' : ''} unestimated — analysis in flight`);
  if (partial) notes.push('running analyses may still add effort');
  return (
    <Table aria-label="Wave applications" variant="compact">
      <Thead>
        <Tr>
          <Th>Application</Th><Th>Analysis</Th><Th>Effort</Th><Th>Risk</Th><Th>Business service</Th><Th>Agent spend</Th>
        </Tr>
      </Thead>
      <Tbody>
        {members.map(a => {
          const st = stateLabel[a.state as string] ?? { text: String(a.state), color: 'grey' as const };
          return (
            <Tr key={a.name as string}>
              <Td dataLabel="Application"><b>{a.name as string}</b></Td>
              <Td dataLabel="Analysis"><Label color={st.color} isCompact>{st.text}</Label></Td>
              <Td dataLabel="Effort">{a.pts ? `${a.pts} pts` : <span className="u-muted">—</span>}</Td>
              <Td dataLabel="Risk">{a.risk ? <Label color={a.risk === 'High' ? 'red' : a.risk === 'Medium' ? 'yellow' : 'green'} isCompact>{a.risk as string}</Label> : <span className="u-muted">unassessed</span>}</Td>
              <Td dataLabel="Business service">{a.bsvc as string}</Td>
              <Td dataLabel="Agent spend">{spendHtml(spendOf(a.name as string))}</Td>
            </Tr>
          );
        })}
        <Tr>
          <Td colSpan={2}><b>Total effort</b>{notes.length > 0 && <span className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)' }}> ({notes.join('; ')})</span>}</Td>
          <Td dataLabel="Effort"><b>{sum.toLocaleString('en-US')}</b></Td>
          <Td />
          <Td dataLabel="Agent spend">{spendHtml(members.reduce((a, m) => { const sp = spendOf(m.name as string); a.tok += sp.tok; a.cost += sp.cost; a.n += sp.n; return a; }, { n: 0, tok: 0, cost: 0 }), true)}</Td>
        </Tr>
      </Tbody>
    </Table>
  );
}

function VerifyTable({ members }: { members: Row[] }) {
  return (
    <Table aria-label="Verification evidence" variant="compact">
      <Thead>
        <Tr><Th>Member</Th><Th>Charter coverage</Th><Th>Suites</Th><Th>Result</Th></Tr>
      </Thead>
      <Tbody>
        {members.map(a => {
          const e = EVIDENCE[a.name as string] || ({} as Evidence);
          const res = e.total ? (e.red ? { c: 'red' as const, t: `${e.red} red` } : { c: 'green' as const, t: 'green' }) : { c: undefined, t: 'not run' };
          return (
            <Tr key={a.name as string}>
              <Td dataLabel="Member"><a href="#scr=inventory">{a.name as string}</a></Td>
              <Td dataLabel="Charter coverage">{e.cov ? dec(e.cov) : <span className="u-muted">&mdash;</span>}</Td>
              <Td dataLabel="Suites">{e.total ? `${e.run} of ${e.total} run` : 'not run'}</Td>
              <Td dataLabel="Result">{res.c ? <Label color={res.c} isCompact>{res.t}</Label> : <Label variant="outline" isCompact>{res.t}</Label>}</Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
}

function TicketsPanel({ rows }: { rows: Row[] }) {
  const [ticket, setTicket] = useState<string | null>(null);
  return (
    <>
      <Content component={ContentVariants.p} style={{ margin: 'var(--rh-space-lg) 0 var(--rh-space-xs)', fontWeight: 600 }}>
        Tickets — tracker export &amp; sync outcome
      </Content>
      <Table aria-label="Wave tickets" variant="compact">
        <Thead>
          <Tr><Th>Ticket</Th><Th>App</Th><Th>External key</Th><Th>Sync outcome</Th><Th>Last attempt</Th></Tr>
        </Thead>
        <Tbody>
          {rows.map(a => {
            const t = TICKETS[a.name as string];
            return (
              <Tr key={a.name as string} onClick={t.drawer ? () => setTicket(a.name as string) : undefined}>
                <Td dataLabel="Ticket">{dec(t.title)}</Td>
                <Td dataLabel="App">{t.drawer ? a.name as string : <a href="#scr=inventory">{a.name as string}</a>}</Td>
                <Td dataLabel="External key">{t.key || <span className="u-muted">&mdash;</span>}</Td>
                <Td dataLabel="Sync outcome">
                  <Label color={t.oc === 'outline' ? undefined : t.oc as 'green' | 'red'} variant={t.oc === 'outline' ? 'outline' : undefined} isCompact>{t.outcome}</Label>
                  {' '}
                  {/* the mock embeds a raw re-link <button> + anno span in t.detail for the
                      failed-sync row (t.drawer) — rendered as real controls here */}
                  {t.drawer
                    ? <>410 Gone — ticket moved projects <Button variant="secondary" size="sm" onClick={e => { e.stopPropagation(); setTicket(a.name as string); }}>re-link</Button></>
                    : dec(t.detail)}
                </Td>
                <Td dataLabel="Last attempt">{dec(t.when)}</Td>
              </Tr>
            );
          })}
          {rows.length === 0 && (
            <Tr><Td colSpan={5}><span className="u-muted">No tickets exported for this wave&rsquo;s current members</span></Td></Tr>
          )}
        </Tbody>
      </Table>
      <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
        Wave work, rendered with its wave; the tracker-side view — 30-day aggregates, connection health, insecure toggle, SPI — lives in Administration &rarr; Tracker sync
      </Content>
      <TicketModal app={ticket} onClose={() => setTicket(null)} />
    </>
  );
}

/* ---------- ticket drawer (port of tpl-drawer-ticket) — the claims-web failed sync ---------- */
function TicketModal({ app, onClose }: { app: string | null; onClose: () => void }) {
  if (!app) return null;
  return (
    <Modal variant="medium" isOpen onClose={onClose} aria-label="Ticket detail">
      <ModalHeader
        title={<>MIG-425 — ORM hint replacement <Label color="red">sync failed</Label></>}
        labelId="ticket-modal-title"
      />
      <ModalBody>
        <Content component={ContentVariants.small} className="u-muted">
          Wave 4 / {app} · Jira Cloud (jira-cloud-prod) · exported by the wave planner · created 2h ago
        </Content>
        <Card isPlain style={{ border: '1px solid var(--pf-t--global--border--color--subtle)', marginTop: 'var(--rh-space-lg)' }}>
          <CardHeader><CardTitle component="h4" className="u-muted">Ticket state</CardTitle></CardHeader>
          <CardBody>
            <span style={{ fontSize: 'var(--rh-font-size-body-text-sm)' }}>
              Jira status: <b>In Progress</b> <span className="u-muted">· last confirmed 2h ago by the 30s refresh cycle</span>
            </span>
          </CardBody>
        </Card>
        <Card isPlain style={{ border: '1px solid var(--pf-t--global--border--color--subtle)', marginTop: 'var(--rh-space-lg)' }}>
          <CardHeader><CardTitle component="h4" className="u-muted">Attempt history</CardTitle></CardHeader>
          <CardBody>
            <Table aria-label="Attempt history" variant="compact">
              <Thead><Tr><Th>#</Th><Th>When</Th><Th>Operation</Th><Th>Server response</Th></Tr></Thead>
              <Tbody>
                <Tr><Td>3</Td><Td>38m ago</Td><Td>status refresh</Td><Td><Label color="red" isCompact>410 Gone</Label> ticket moved projects — re-link suggested</Td></Tr>
                <Tr><Td>2</Td><Td>1h 06m ago</Td><Td>status refresh</Td><Td><Label color="red" isCompact>404 Not Found</Label></Td></Tr>
                <Tr><Td>1</Td><Td>2h ago</Td><Td>create + initial sync</Td><Td><Label color="green" isCompact>201 Created</Label> issue key MIG-425 issued</Td></Tr>
              </Tbody>
            </Table>
            <div className="pf-v6-c-code-block" style={{ margin: 'var(--rh-space-md) 0 0 0' }}>
              <div className="pf-v6-c-code-block__header"><span className="u-muted">last response body</span></div>
              <pre className="pf-v6-c-code-block__pre"><code>{`HTTP/1.1 410 Gone\n{"errorMessages":["The issue no longer exists in project MIG"],"errors":{}}`}</code></pre>
            </div>
          </CardBody>
        </Card>
        <Split hasGutter style={{ marginTop: 'var(--rh-space-lg)' }}>
          <SplitItem><Button variant="secondary">Retry status refresh</Button></SplitItem>
          <SplitItem><Button variant="primary">Re-link to moved ticket&hellip;</Button></SplitItem>
        </Split>
        <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
          Retry is guarded: backoff between attempts, next attempt scheduled — not fire-and-forget.
        </Content>
        <Alert variant="info" isInline title="A failing sync is not a failing connection" style={{ marginTop: 'var(--rh-space-lg)' }}>
          <p>The tracker page shows the connection as <b>degraded</b> (identity probe passes, syncs fail); the per-ticket cause lives here.</p>
        </Alert>
      </ModalBody>
    </Modal>
  );
}

/* ---------- the screen ---------- */
export function Waves() {
  const { state } = useApp();
  const { apps, path } = useScoped();
  const { data } = useHub();

  /* bind the hub stores before any child renders (WaveLane etc. read the module bindings) */
  APPS = data.apps as Row[];
  RUNS = data.agentRuns;
  EVIDENCE = data.evidence;
  TICKETS = data.tickets;
  CREDS = data.creds;
  WAVE_DEPS = data.deps;

  const ours = APPS.some(a => a.wave && TEAM_BY_ID[a.team]?.org === state.org);   // waves exist for the org whose apps are members
  const assigned = apps.filter(a => a.wave).length;
  const unassigned = apps.length - assigned;
  const teamName = state.team ? TEAM_BY_ID[state.team]?.name : null;

  // lane visibility: hidden for non-nwf orgs; team-scoped views hide member-less waves
  const laneVisible = (wv: number) => ours && (!state.team || apps.some(a => String(a.wave) === String(wv)));

  // dependency-edge note (wave 4's span, port of waveEdge-4)
  const edges = WAVE_DEPS.map(d => {
    const fa = APPS.find(a => a.name === d.from), ta = APPS.find(a => a.name === d.to);
    if (!fa || !ta || !fa.wave || !ta.wave || +fa.wave === +ta.wave) return null;
    if (+fa.wave === 4 || +ta.wave === 4) {
      return <>dependency edge: Wave {fa.wave} &rarr; Wave {ta.wave} ( <a href="#scr=inventory">{d.from}</a> {d.verb} <a href="#scr=inventory">{d.to}</a> )</>;
    }
    return null;
  }).filter(Boolean) as React.ReactNode[];

  return (
    <>
      <Title headingLevel="h1" size="2xl" className="page-title">Migration waves</Title>
      <Content component={ContentVariants.p} className="page-subtitle">
        From static list + dates to progress, gates, timeline, and evidence · {path}
      </Content>

      <Card style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
        <CardHeader><CardTitle>Wave execution — timeline, membership &amp; plan adherence</CardTitle></CardHeader>
        <CardBody>
          <div className="gantt">
            <div className="lane" id="waveHeadLane" style={{ marginBottom: 'var(--rh-space-md)', ...(ours ? {} : { display: 'none' }) }}>
              <span />
              <div className="month-labels"><span>Sep</span><span>Oct</span><span>Nov</span></div>
            </div>
            {[1, 2, 3, 4].map(wv => (
              <div key={wv} style={laneVisible(wv) ? undefined : { display: 'none' }}>
                <WaveLane wv={wv} />
              </div>
            ))}
            {!ours && (
              <div className="u-muted" style={{ margin: 'var(--rh-space-md) 0 0 170px' }}>
                No migration waves for this organization yet — wave planning starts from the Applications toolbar (Wave assignment)
              </div>
            )}
            {ours && (
              <div className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)', margin: 'var(--rh-space-md) 0 0 170px' }}>
                {edges.length ? edges.map((e, i) => <span key={i}>{e}{i < edges.length - 1 ? ' · ' : ''}</span>) : 'no inter-wave dependency edge among the current members'}
                {' '} · dates accept plain dates
              </div>
            )}
          </div>
          <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
            <b>{assigned} of the {apps.length} sampled applications</b>{teamName ? ` (team ${teamName})` : ''} are wave-assigned{unassigned > 0 ? <>; the other {unassigned} are not yet scheduled — assignment lives on the Applications toolbar (Wave filter) and moves between waves via the bulk action</> : ''}
          </Content>
        </CardBody>
      </Card>
    </>
  );
}
