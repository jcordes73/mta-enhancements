import { Fragment, useMemo, useState } from 'react';
import {
  Card, CardBody, CardHeader, CardTitle, Title, Content, ContentVariants, Tabs, Tab, TabTitleText,
  Label, Button, List, ListItem, Grid, GridItem, Pagination,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
/* hand-rolled pf-v6-c-progress markup (combined-risks distribution bars) needs the
   component stylesheet — normally pulled in by the Progress JS module we don't use */
import '@patternfly/react-styles/css/components/Progress/progress.css';
import { useApp, useScoped } from '../state/appState';
import { useHub, type HubData } from '../api/hub';

type Row = HubData['trend'][number];
type AgentRun = HubData['agentRuns'][number];

/* hub-backed stores — bound at the top of Reports() (all tabs render under it) */
let TREND: Row[] = [];
let RUNS: AgentRun[] = [];

/* ---------- Combined risks (static matrix, #32 item 5) ---------- */
const COMBINED = [
  {
    cat: 'Architecture — State mgmt', pct: 55, share: '18 of 100+', shareNote: '<1% … systemic',
    apps: ['cust-portal', 'claims-web', 'invoicing', 'payments-api'],
    mitigation: 'externalize HTTP session state (Infinispan / external cache) — apply the EAP8 cohort\u2019s shared replacement pattern',
    rationale: '<1% of code, but systemic: 4 of the portfolio\u2019s 10 highest-effort applications sit in this category',
  },
  {
    cat: 'Cloud readiness', pct: 20, share: '9 of 100+', shareNote: null,
    apps: ['policy-engine', 'notification-router', 'ledger-sync', 'docs-portal'],
    mitigation: 'add health probes and externalized configuration (Quarkus / Spring Boot runtime views); re-assess before the wave gate',
    rationale: 'concentrated in Wave 4 — the gate requires cloud-ready posture before cutover, so these apps block the earliest risk',
  },
];

/* ---------- Questionnaire answers (static sample grid, #45) ---------- */
const ANSWERS = [
  { q: 'EAP8-archetype v3', section: 'Architecture', question: 'How is the application packaged and run?', answer: 'Single deployable (WAR/EAR)', risk: 'Medium', app: 'payments-api' },
  { q: 'EAP8-archetype v3', section: 'Architecture', question: 'How does the application look up backing services?', answer: 'JNDI lookup', risk: 'High', app: 'payments-api' },
  { q: 'EAP8-archetype v3', section: 'Cloud readiness', question: 'Is configuration externalized?', answer: 'Partial — some hard-coded endpoints', risk: 'Medium', app: 'claims-web' },
  { q: 'EAP8-archetype v3', section: 'Data & transactions', question: 'Are distributed (XA) transactions used?', answer: 'Yes — 2 datasources', risk: 'High', app: 'cust-portal' },
  { q: 'EAP8-archetype v3', section: 'Security & compliance', question: 'Which auth model does the application use?', answer: 'JAAS (migrates to Jakarta Security)', risk: 'Medium', app: 'payments-api' },
  { q: 'Quarkus baseline v1', section: 'Architecture', question: 'How is the application packaged and run?', answer: 'Jar with embedded runtime', risk: 'Low', app: 'policy-engine' },
  { q: 'Quarkus baseline v1', section: 'Cloud readiness', question: 'Are health probes exposed?', answer: 'Liveness + readiness', risk: 'Low', app: 'notification-router' },
];

/* ---------- Dependencies (static per-app artifacts + relations, #24/#23) ---------- */
const DEPS = {
  pa: {
    name: 'payments-api',
    counts: '214 artifacts total · 2 with CVE signals · 1 conflict — counts roll up to the application row and the inventory risk view',
    artifacts: [
      { gav: 'com.example.shared:payments-contract', version: '2.4.1', scope: 'api', depth: 'direct', conflict: null, vuln: { c: 'green', t: 'no known CVEs' } },
      { gav: 'log4j:log4j', version: '[1.2,2.0) → 1.2.17', scope: 'runtime', depth: 'direct', conflict: null, vuln: { c: 'red', t: '2 CVEs' }, link: 'view incidents' },
      { gav: 'com.example.platform:orm-runtime', version: '5.1.0', scope: 'runtime', depth: 'direct', conflict: null, vuln: { muted: 'proprietary — no advisory data' } },
      { gav: 'com.fasterxml.jackson.core:jackson-databind', version: '[2.15,2.16) → 2.15.3', scope: 'runtime', depth: 'depth 2 — via payments-contract', conflict: { c: 'yellow', t: 'managed by BOM' }, vuln: { c: 'green', t: 'no known CVEs' } },
      { gav: 'com.example.platform:naming-client', version: '8.0.0', scope: 'runtime', depth: 'depth 3 — via orm-runtime', conflict: null, vuln: { muted: 'proprietary — no advisory data' } },
    ],
    consumes: [
      <Fragment key="pa-c1"><b>ledger-sync</b> — kafka topic <code>payments.settled</code> <a href="#scr=inventory">open in inventory</a></Fragment>,
      <Fragment key="pa-c2"><b>customer-api</b> — REST <a href="#scr=inventory">open in inventory</a></Fragment>,
      <Fragment key="pa-c3">proprietary naming service — JNDI lookups <span className="u-muted">(answers the archetype questionnaire&apos;s lookup question)</span></Fragment>,
    ],
    consumedBy: [
      <Fragment key="pa-cb1"><b><a href="#scr=inventory">claims-web</a></b> — REST (drives the Wave 3 &rarr; Wave 4 edge) <a href="#scr=waves">open in waves</a></Fragment>,
      <Fragment key="pa-cb2">3 APIs&apos; consumers · 1 tracker · 1 proxy <a href="#scr=inventory">jump to cohort</a></Fragment>,
    ],
  },
  inv: {
    name: 'invoicing',
    counts: '147 artifacts so far (partial — the running analysis is at 61%) · 1 CVE signal · counts are provisional — remaining artifacts stream in as the run completes',
    artifacts: [
      { gav: 'weblogic:weblogic-jndi', version: '14.1.1', scope: 'provided', depth: 'direct', conflict: null, vuln: { c: 'yellow', t: '1 CVE' } },
      { gav: 'javax:javax.naming', version: '—', scope: 'runtime', depth: 'direct', conflict: null, vuln: { muted: '—' } },
    ],
    consumes: [
      <Fragment key="inv-c1">WebLogic naming service — JNDI lookups <span className="u-muted">(mirrors the archetype questionnaire&apos;s lookup question)</span></Fragment>,
      <Fragment key="inv-c2">database ×1 · REST ×2 — from the wave&apos;s test charter</Fragment>,
    ],
    consumedBy: [
      <span key="inv-cb1" className="u-muted">relations populate as the analysis completes (61%) — reverse edges derive from the resolved graph</span>,
    ],
  },
} as const;

/* ---------- Rule coverage (static matrices, #9/#6/#8/#26) ---------- */
const RULE_ROWS = [
  { rule: 'weblogic-to-eap · JNDI 0001', src: 'bundled', apps: 18, matches: 24, fp: '0%', valid: { c: 'green', t: 'valid' }, note: null },
  { rule: 'jakarta-ee-10 · javax→jakarta 90002', src: 'bundled', apps: 12, matches: 41, fp: '7%', valid: { c: 'green', t: 'valid' }, note: null },
  { rule: 'logging · log4j 1.x 5101', src: 'bundled', apps: 18, matches: 9, fp: '33%', valid: { c: 'yellow', t: 'warnings' }, note: '2 hints without story points' },
  { rule: 'orm-hints · hint-replacement 2200', src: 'bundled', apps: 6, matches: 3, fp: '0%', valid: { c: 'green', t: 'valid' }, note: null },
  { rule: 'platform-custom · proprietary-orm 0010', src: 'organization', apps: 18, matches: 6, fp: '0%', valid: { c: 'outline', t: 'not validated' }, note: 'validate now' },
];

const RISK_LABEL = (r: string) => (r === 'High' ? 'red' : r === 'Medium' ? 'yellow' : 'green') as 'red' | 'yellow' | 'green';

export function Reports() {
  const { apps, path } = useScoped();
  const { data } = useHub();
  TREND = data.trend;
  RUNS = data.agentRuns;
  const [tab, setTab] = useState(0);

  return (
    <>
      <Title headingLevel="h1" size="2xl" className="page-title">Reports</Title>
      <Content component={ContentVariants.p} className="page-subtitle">
        Combined risk, provenance, dependencies, and agent-run evidence — {path}
      </Content>
      <Tabs activeKey={tab} onSelect={(_e, k) => setTab(k as number)} aria-label="Report tabs" style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
        <Tab eventKey={0} title={<TabTitleText>Combined risks</TabTitleText>} aria-label="Combined risks"><CombinedRisks /></Tab>
        <Tab eventKey={1} title={<TabTitleText>Risk provenance</TabTitleText>} aria-label="Risk provenance"><Provenance apps={apps as unknown as Array<Record<string, unknown>>} /></Tab>
        <Tab eventKey={2} title={<TabTitleText>Trends</TabTitleText>} aria-label="Trends"><Trends /></Tab>
        <Tab eventKey={3} title={<TabTitleText>Dependencies</TabTitleText>} aria-label="Dependencies"><Dependencies /></Tab>
        <Tab eventKey={4} title={<TabTitleText>Agent runs</TabTitleText>} aria-label="Agent runs"><AgentRuns apps={apps as unknown as Array<Record<string, unknown>>} /></Tab>
        <Tab eventKey={5} title={<TabTitleText>Rule coverage</TabTitleText>} aria-label="Rule coverage"><RuleCoverage /></Tab>
        <Tab eventKey={6} title={<TabTitleText>Questionnaire answers</TabTitleText>} aria-label="Questionnaire answers"><Answers /></Tab>
      </Tabs>
    </>
  );
}

/* ---------- tab 1: combined risks ---------- */
function CombinedRisks() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
      <CardHeader><CardTitle>Identified risks — grouped by section</CardTitle></CardHeader>
      <CardBody>
        <Table aria-label="Identified risks" variant="compact">
          <Thead>
            <Tr><Th screenReaderText="Expandable" /><Th>Category</Th><Th>Distribution</Th><Th>Apps affected</Th></Tr>
          </Thead>
          <Tbody>
            {COMBINED.map(c => (
              <CombinedRows key={c.cat} c={c} open={open === c.cat} onToggle={() => setOpen(open === c.cat ? null : c.cat)} />
            ))}
          </Tbody>
        </Table>
        <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
          Affected apps, mitigation, and rationale in the expanded row · risk never encoded in color alone
        </Content>
      </CardBody>
    </Card>
  );
}

function CombinedRows({ c, open, onToggle }: { c: (typeof COMBINED)[number]; open: boolean; onToggle: () => void }) {
  return (
    <>
      <Tr>
        <Td expand={{ rowIndex: 0, isExpanded: open, onToggle }} />
        <Td dataLabel="Category">{c.cat}</Td>
        <Td dataLabel="Distribution">
          <div className="pf-v6-c-progress pf-m-sm" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.pct} aria-label={`${c.cat} distribution`}>
            <div className="pf-v6-c-progress__bar"><div className="pf-v6-c-progress__indicator" style={{ width: `${c.pct}%`, background: 'var(--pf-t--global--color--status--danger--default)' }} /></div>
          </div>
        </Td>
        <Td dataLabel="Apps affected">
          <Label color="teal" isCompact>{c.share}</Label>{c.shareNote && <>{' '}<span className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)' }}>{c.shareNote}</span></>}
        </Td>
      </Tr>
      <Tr isExpanded={open}>
        <Td />
        <Td colSpan={3}>
          <Content component={ContentVariants.small} className="u-muted" style={{ marginBottom: 'var(--rh-space-xs)' }}>Apps affected — top 4</Content>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--rh-space-md)', alignItems: 'center', marginBottom: 'var(--rh-space-md)' }}>
            {c.apps.map(a => <Label key={a} color="teal"><a href="#scr=inventory" style={{ color: 'inherit', textDecoration: 'none' }}>{a}</a></Label>)}
            <span className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)' }}>click an app to open its detail</span>
          </div>
          <div style={{ marginBottom: 'var(--rh-space-md)' }}><b>Mitigation:</b> {c.mitigation}</div>
          <div><b>Rationale:</b> {c.rationale}</div>
        </Td>
      </Tr>
    </>
  );
}

/* ---------- tab 2: risk provenance (derived, #32 item 6) ---------- */
function Provenance({ apps }: { apps: Array<Record<string, unknown>> }) {
  const [facets, setFacets] = useState<string[]>([]);
  /* pagination (mock defect-log row 106) — hidden at zero results (row 87) */
  const [provPage, setProvPage] = useState(1);
  const [provPer, setProvPer] = useState(10);
  const rows = apps.map(a => {
    const kind = String(a.riskKind ?? 'unassessed');
    const prov = kind === 'inherited' ? 'inherited' : kind === 'own' ? 'own' : 'unassessed';
    const provText = kind === 'inherited' ? 'inherited ← EAP8-archetype view group assessment'
      : kind === 'own' ? 'own assessment' : 'unassessed';
    return { a, prov, provText };
  });
  const counts: Record<string, number> = {};
  rows.forEach(r => { counts[r.prov] = (counts[r.prov] || 0) + 1; });
  const order = ['own', 'inherited', 'unassessed'].filter(k => counts[k]);
  const visible = rows.filter(r => !facets.length || facets.includes(r.prov));
  const provPageC = Math.min(provPage, Math.max(1, Math.ceil(visible.length / provPer)));
  const provRows = visible.slice((provPageC - 1) * provPer, provPageC * provPer);
  return (
    <Card style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
      <CardHeader><CardTitle>Risk provenance</CardTitle></CardHeader>
      <CardBody>
        <div style={{ display: 'flex', gap: 'var(--rh-space-md)', marginBottom: 'var(--rh-space-md)' }}>
          {order.map(k => (
            <Label key={k} color="teal" onClick={() => setFacets(f => f.includes(k) ? f.filter(x => x !== k) : [...f, k])} style={{ cursor: 'pointer' }}>
              {facets.includes(k) ? '✓ ' : ''}{k} ({counts[k]})
            </Label>
          ))}
        </div>
        <Table aria-label="Risk provenance" variant="compact">
          <Thead><Tr><Th>Application</Th><Th>Risk</Th><Th>Provenance</Th></Tr></Thead>
          <Tbody>
            {provRows.map(({ a, provText }) => (
              <Tr key={a.name as string}>
                <Td dataLabel="Application"><a href="#scr=inventory">{a.name as string}</a></Td>
                <Td dataLabel="Risk">{a.risk
                  ? <Label color={RISK_LABEL(a.risk as string)} isCompact>{a.risk as string}</Label>
                  : <Label variant="outline" isCompact>—</Label>}</Td>
                <Td dataLabel="Provenance">{provText}</Td>
              </Tr>
            ))}
            {visible.length === 0 && (
              <Tr><Td colSpan={3}><span className="u-muted">No applications match the provenance filter — clear a facet chip.</span></Td></Tr>
            )}
          </Tbody>
        </Table>
        {visible.length > 0 && (
          <Pagination
            itemCount={visible.length} page={provPageC} perPage={provPer} variant="bottom" isCompact
            onSetPage={(_e, p) => setProvPage(p)}
            onPerPageSelect={(_e, pp) => { setProvPer(pp); setProvPage(1); }}
            style={{ marginTop: 'var(--rh-space-md)' }}
          />
        )}
        <div style={{ marginTop: 'var(--rh-space-md)' }}>
          <Button variant="secondary">⬇ Export CSV/JSON</Button> <span className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)' }}></span>
        </div>
      </CardBody>
    </Card>
  );
}

/* ---------- tab 3: trends ---------- */
function Trends() {
  const [series, setSeries] = useState<'open' | 'pass'>('open');
  const [count, setCount] = useState(5);
  const data = TREND.slice(-count);
  const val = (r: Row) => (series === 'pass' ? r.pass : r.open);
  const fmt = (v: number) => (series === 'pass' ? v + '%' : String(v));
  const max = Math.max(...data.map(val));
  const first = data[0], last = data[data.length - 1];
  const delta = first && val(first) ? Math.round((val(last) - val(first)) / val(first) * 100) : 0;
  const head = series === 'pass' ? 'Verification pass rate' : 'Open incidents per analysis run';
  return (
    <div style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
      <Card>
        <CardHeader actions={{ actions: <Button variant="link" component="a" href="#scr=inventory" title="Opens the app-detail modal in run-comparison mode (rides with the Inventory screen)">Open in run comparison →</Button> }}>
          <CardTitle>Analysis diff — payments-api <Label variant="outline" style={{ marginLeft: 'var(--rh-space-md)' }}>sample run pair</Label></CardTitle>
        </CardHeader>
        <CardBody>
          <Table aria-label="Analysis diff" variant="compact">
            <Thead><Tr><Th>Change</Th><Th>Incident</Th><Th>Why</Th></Tr></Thead>
            <Tbody>
              <Tr><Td><Label color="red" isCompact>new</Label></Td><Td>log4j 1.x ×2 — direct dependency <code>log4j:log4j</code> moved in-scope</Td><Td>dependency update (direct, run 47)</Td></Tr>
              <Tr><Td><Label color="green" isCompact>resolved</Label></Td><Td>HTTP session replication ×9 — migration commit 8f3e2c1</Td><Td>source change</Td></Tr>
              <Tr><Td><Label color="yellow" isCompact>changed</Label></Td><Td>ORM hint replacement — effort 3 → 8 pts</Td><Td>rule hint updated in <code>orm-hints 2200</code></Td></Tr>
            </Tbody>
          </Table>
          <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
            <code>GET /applications/{'{id}'}/analysis/diff?from=42&amp;to=47</code> — the same endpoint IDE extensions and CI use; new incidents here feed the wave re-validation check
          </Content>
        </CardBody>
      </Card>
      <Card style={{ marginTop: 'var(--rh-space-lg)' }}>
        <CardHeader><CardTitle>Trends</CardTitle></CardHeader>
        <CardBody>
          <div style={{ display: 'flex', gap: 'var(--rh-space-md)', marginBottom: 'var(--rh-space-md)', flexWrap: 'wrap' }}>
            <Label color="teal" onClick={() => setSeries('open')} style={{ cursor: 'pointer' }}>{series === 'open' ? '✓ ' : ''}Open incidents</Label>
            <Label color="teal" onClick={() => setSeries('pass')} style={{ cursor: 'pointer' }}>{series === 'pass' ? '✓ ' : ''}Verification pass rate</Label>
            <Label color="teal" onClick={() => setCount(5)} style={{ cursor: 'pointer' }}>{count === 5 ? '✓ ' : ''}Last 5 runs</Label>
            <Label color="teal" onClick={() => setCount(3)} style={{ cursor: 'pointer' }}>{count === 3 ? '✓ ' : ''}Last 3</Label>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--rh-space-md)', height: 130, padding: 'var(--rh-space-xs) var(--rh-space-xs) 0' }}>
            {data.map((r, i) => {
              const lastBar = i === data.length - 1;
              return (
                <div key={r.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--rh-space-xs)' }}>
                  {lastBar
                    ? <span style={{ fontSize: 'var(--rh-font-size-body-text-xs)', color: 'var(--pf-t--global--color--status--success--default)' }}><b>{fmt(val(r))}</b></span>
                    : <span className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)' }}>{fmt(val(r))}</span>}
                  <div style={{ width: '100%', background: lastBar ? 'var(--pf-t--global--color--status--success--default)' : 'var(--pf-t--global--color--status--custom--default)', height: Math.max(4, Math.round(val(r) / max * 92)) }} />
                </div>
              );
            })}
          </div>
          <div className="u-muted" style={{ display: 'flex', gap: 'var(--rh-space-md)', padding: 'var(--rh-space-xs) var(--rh-space-xs) 0', fontSize: 'var(--rh-font-size-body-text-xs)' }}>
            {data.map(r => <div key={r.date} style={{ flex: 1, textAlign: 'center' }}>{r.date}</div>)}
          </div>
          <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
            {head}, last {data.length} runs — <b>{fmt(val(last))}</b> on {last.date}
            {delta !== 0 && first ? <>, <b>{delta > 0 ? '+' : '−'}{Math.abs(delta)}%</b> since {first.date}</> : ''}
            {' · wave planned-vs-actual feed'}
            {series === 'open' && <> <br />Verification pass rate <b>{last.pass}%</b> (latest run)</>}
          </Content>
        </CardBody>
      </Card>
    </div>
  );
}

/* ---------- tab 4: dependencies ---------- */
function Dependencies() {
  const [app, setApp] = useState<'pa' | 'inv'>('pa');
  const d = DEPS[app];
  return (
    <div style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
      <Card>
        <CardHeader actions={{ actions: <>
          <Button variant="secondary">View dependencies.yaml</Button>{' '}
          <Button variant="secondary">⬇ Export SBOM</Button>
          <span className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)' }}></span>
        </> }}>
          <CardTitle>
            Artifact inventory — {d.name}
            <select
              className="pf-v6-c-form-control"
              value={app}
              onChange={e => setApp(e.target.value as 'pa' | 'inv')}
              aria-label="Switch application"
              style={{ display: 'inline-block', marginLeft: 'var(--rh-space-md)', verticalAlign: 'middle', width: 'auto' }}
            >
              <option value="pa">payments-api</option>
              <option value="inv">invoicing</option>
            </select>
          </CardTitle>
        </CardHeader>
        <CardBody>
          <Table aria-label="Artifact inventory" variant="compact">
            <Thead><Tr>
              <Th>Artifact (groupId:artifactId)</Th><Th>Version</Th><Th>Scope</Th><Th>Depth</Th><Th>Conflict</Th><Th>Vulnerabilities</Th>
            </Tr></Thead>
            <Tbody>
              {d.artifacts.map(a => (
                <Tr key={a.gav}>
                  <Td dataLabel="Artifact"><code>{a.gav}</code></Td>
                  <Td dataLabel="Version">{a.version.includes('→') ? <><code>{a.version.split(' →')[0]}</code> → {a.version.split('→ ')[1]}</> : a.version}</Td>
                  <Td dataLabel="Scope">{a.scope}</Td>
                  <Td dataLabel="Depth">{a.depth}</Td>
                  <Td dataLabel="Conflict">{a.conflict ? <Label color={a.conflict.c as 'yellow'} isCompact>{a.conflict.t}</Label> : <span className="u-muted">—</span>}</Td>
                  <Td dataLabel="Vulnerabilities">
                    {'muted' in a.vuln && a.vuln.muted ? <span className="u-muted">{a.vuln.muted}</span>
                      : <><Label color={(a.vuln as { c: 'green' | 'red' | 'yellow' }).c} isCompact>{(a.vuln as { t: string }).t}</Label>{'link' in a && a.link && <>{' '}<a href="#scr=incidents">{a.link}</a></>}</>}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>{d.counts}</Content>
        </CardBody>
      </Card>
      <Card style={{ marginTop: 'var(--rh-space-lg)' }}>
        <CardHeader><CardTitle>Graph-derived relations — {d.name}</CardTitle></CardHeader>
        <CardBody>
          <Grid hasGutter>
            <GridItem span={6}>
              <Content component={ContentVariants.small} className="u-muted" style={{ marginBottom: 'var(--rh-space-md)' }}>Consumes (outbound){app === 'inv' ? ' — partial' : ''}</Content>
              <List isPlain>{d.consumes.map((li, i) => <ListItem key={i}>{li}</ListItem>)}</List>
            </GridItem>
            <GridItem span={6}>
              <Content component={ContentVariants.small} className="u-muted" style={{ marginBottom: 'var(--rh-space-md)' }}>Consumed by (reverse)</Content>
              <List isPlain>{d.consumedBy.map((li, i) => <ListItem key={i}>{li}</ListItem>)}</List>
            </GridItem>
          </Grid>
        </CardBody>
      </Card>
    </div>
  );
}

/* ---------- tab 5: agent runs (KPIs derived from the scoped store, #20/#41) ---------- */
function AgentRuns({ apps }: { apps: Array<Record<string, unknown>> }) {
  const { state } = useApp();
  const names = useMemo(() => new Set(apps.map(a => a.name as string)), [apps]);
  const scopedRuns = useMemo(() => RUNS.filter(r => names.has(r.app as string)), [names]);
  const parseKm = (v: unknown) => { const m = /^([\d.]+)(M|k)/.exec(String(v ?? '').trim()); return m ? parseFloat(m[1]) * (m[2] === 'M' ? 1e6 : 1e3) : 0; };
  const fmtTok = (n: number) => (n >= 1e6 ? (Math.round(n / 1e5) / 10) + 'M' : Math.round(n / 1e3) + 'k');
  const p = scopedRuns.reduce((t, r) => t + parseKm(String((r as AgentRun).tokDetail || '0/0').split('/')[0]), 0);
  const c = scopedRuns.reduce((t, r) => t + parseKm(String((r as AgentRun).tokDetail || '0/0').split('/')[1] || '0'), 0);
  const cost = scopedRuns.reduce((t, r) => t + (parseFloat(String((r as AgentRun).cost).replace(/[^0-9.]/g, '')) || 0), 0);
  const failed = scopedRuns.filter(r => r.state === 'failed').length;
  const stateLabel = (s: string) => (
    s === 'succeeded' ? <Label color="green" isCompact>succeeded</Label>
      : s === 'running' ? <Label color="blue" isCompact>running</Label>
      : s === 'failed' ? <Label color="red" isCompact>failed</Label>
      : <Label variant="outline" isCompact>{s}</Label>
  );
  return (
    <div style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
      <Grid hasGutter style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
        <GridItem span={4}><Card isPlain><CardBody>
          <div className="u-muted">Runs this month</div>
          <div className="kpi"><b>{scopedRuns.length}</b>{failed > 0 && <>{' '}<Label color="red">{failed} failed</Label></>}</div>
        </CardBody></Card></GridItem>
        <GridItem span={4}><Card isPlain><CardBody>
          <div className="u-muted">Tokens this month</div>
          <div className="kpi"><b>{fmtTok(p + c)}</b> <span className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)' }}>{fmtTok(p)} prompt / {fmtTok(c)} completion</span></div>
        </CardBody></Card></GridItem>
        <GridItem span={4}><Card isPlain><CardBody>
          <div className="u-muted">Estimated cost (MaaS showback)</div>
          <div className="kpi"><b>${cost.toFixed(2)}</b> <span className="u-muted"> · {state.org === 'nwf' ? 'Northwind Financial' : state.org} scope</span> <a href="#scr=config">per-gateway rollup →</a></div>
        </CardBody></Card></GridItem>
      </Grid>
      <Card>
        <CardBody>
          <Table aria-label="Agent run rollup" variant="compact">
            <Thead><Tr>
              <Th>Run</Th><Th>Application</Th><Th>Stage</Th><Th>State</Th><Th>Duration</Th><Th>Gateway / model</Th><Th>Tokens</Th><Th>Est. cost</Th>
            </Tr></Thead>
            <Tbody>
              {scopedRuns.slice(0, 3).map(r => (
                <Tr key={String(r.id)}>
                  <Td><b>#{String(r.id).slice(0, 4)}</b> {r.name}{r.events ? '' : ''}</Td>
                  <Td><a href="#scr=inventory">{r.app as string}</a></Td>
                  <Td>{r.phase as string}</Td>
                  <Td>{stateLabel(r.state as string)}</Td>
                  <Td>{r.duration as string}</Td>
                  <Td>{r.gw as string} · {r.model as string}{r.gw === 'llm-gateway-2' && <>{' '}<Label color="purple" isCompact>premium tier</Label></>}</Td>
                  <Td>{r.tokens as string} <span className="u-muted">{r.tokDetail as string}</span></Td>
                  <Td>{r.cost as string}</Td>
                </Tr>
              ))}
              {scopedRuns.length === 0 && (
                <Tr><Td colSpan={8}><span className="u-muted">No agent runs in this scope — the rollup totals what the records in scope carry.</span></Td></Tr>
              )}
            </Tbody>
          </Table>
          <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
            <b>1 – {Math.min(3, scopedRuns.length)}</b> of <b>{scopedRuns.length}</b> runs · most recent first · <a href="#scr=config">which gateways did they use?</a>
          </Content>
        </CardBody>
      </Card>
      <A2ACard />
      <WorkflowAuthoring />
    </div>
  );
}

/* A2A Agent Cards (static, #16) */
function A2ACard() {
  const cards = [
    { agent: 'analyzer-jboss-eap-7-to-8', stage: 'analysis', cred: 'out-of-band (Hub token exchange)', src: { c: 'blue', t: 'shipped' } },
    { agent: 'planner-spring-boot-to-quarkus', stage: 'plan', cred: 'out-of-band (Hub token exchange)', src: { c: 'blue', t: 'shipped' } },
    { agent: 'rewriter-spring-boot-to-quarkus', stage: 'execute', cred: 'out-of-band (Hub token exchange)', src: { c: 'blue', t: 'shipped' } },
    { agent: 'verifier-citrus', stage: 'verify', cred: 'out-of-band (Hub token exchange)', src: { c: 'blue', t: 'shipped' } },
    { agent: 'remediation-internal', stage: 'remediation', cred: 'out-of-band (org-managed)', src: { c: 'yellow', t: 'registered · curator approved' } },
  ];
  return (
    <Card style={{ marginTop: 'var(--rh-space-lg)' }}>
      <CardHeader><CardTitle>Agent Cards (A2A) <Label color="orange" style={{ marginLeft: 'var(--rh-space-md)' }}>Developer Preview</Label></CardTitle></CardHeader>
      <CardBody>
        <Content component={ContentVariants.p} style={{ fontSize: 'var(--rh-font-size-body-text-sm)', marginBottom: 'var(--rh-space-md)' }}>
          <b>5 factory agents</b> published as A2A servers · protocol v1.0 · card endpoint <code>{'https://mta-hub.apps.example.com/a2a/agents/<agent>/.well-known/agent-card.json'}</code> · discoverable by any standard A2A client, not only MTA&apos;s internal orchestration
        </Content>
        <Table aria-label="A2A Agent Cards" variant="compact">
          <Thead><Tr><Th>Agent</Th><Th>Stage</Th><Th>Protocol</Th><Th>Card</Th><Th>Credentials</Th><Th>Source</Th></Tr></Thead>
          <Tbody>
            {cards.map(c => (
              <Tr key={c.agent}>
                <Td><code>{c.agent}</code></Td>
                <Td>{c.stage}</Td>
                <Td>A2A v1.0</Td>
                <Td>extended · auth: OAuth 2.1</Td>
                <Td>{c.cred}</Td>
                <Td><Label color={c.src.c as 'blue' | 'yellow'} isCompact>{c.src.t}</Label></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
          <b>1 – 5</b> of <b>16</b> agents · the other 11 are plan/execute/verify triplets per migration path · registry changes are audited · <a href="#scr=config">curation queue →</a>
        </Content>
        <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-xs)' }}>
          <b>Interop pairing:</b> A2A Agent Cards declare <i>who the agents are</i> (discovery, capability, skills); the MCP server exposes <i>what they can do</i> as tools — together they replace today&apos;s unstructured file handoffs on shared Git branches with standard protocols. <a href="#scr=config">MCP server →</a>
        </Content>
      </CardBody>
    </Card>
  );
}

/* Workflow authoring (static, #49) */
function WorkflowAuthoring() {
  const wfs = [
    { name: 'eap8-default', sub: 'factory triplet, shipped', ver: 'v1', status: { c: 'green', t: 'active' }, since: null, stages: 'plan → execute → verify', gates: '—', cohort: 'includeFor: EAP 7', last: <>WR-8 → · 1h 12m</>, actions: ['View YAML'] },
    { name: 'payments-policy-gated', sub: 'org workflow · third-party policy agent from the registry', ver: 'v3', status: { c: 'green', t: 'active' }, since: 'since 2026-10-28', stages: 'plan → policy-check → execute → verify (citrus)', gates: 'suite green + migration-lead accept', cohort: 'archetype: payments-api', last: <>2026-10-30 · passed</>, actions: ['Edit YAML', 'New version'] },
    { name: 'claims-refresh-first', sub: 'org workflow · dependency refresh ahead of planning', ver: 'v1', status: { c: 'yellow', t: 'draft' }, since: null, stages: 'dependency-refresh → plan → execute → verify', gates: 'suite green before wave gate', cohort: 'archetype: claims-batch', last: <span className="u-muted">—</span>, actions: ['Edit YAML'] },
  ];
  return (
    <Card style={{ marginTop: 'var(--rh-space-lg)' }}>
      <CardHeader actions={{ actions: <>
        <Button variant="primary">New workflow</Button>{' '}
        <Button variant="secondary">Edit YAML</Button>
      </> }}>
        <CardTitle>Workflow authoring</CardTitle>
      </CardHeader>
      <CardBody>
        <Content component={ContentVariants.p} style={{ fontSize: 'var(--rh-font-size-body-text-sm)', marginBottom: 'var(--rh-space-md)' }}>
          The factory&apos;s plan → execute → verify triplets are the <b>built-in</b> workflow set; organizations compose their own from registered agents and the factory&apos;s governance applies to the result by construction
        </Content>
        <Table aria-label="Workflows" variant="compact">
          <Thead><Tr>
            <Th>Workflow</Th><Th>Version</Th><Th>Status</Th><Th>Stages</Th><Th>Gates</Th><Th>Bound cohorts</Th><Th>Last run</Th><Th screenReaderText="Actions" />
          </Tr></Thead>
          <Tbody>
            {wfs.map(w => (
              <Tr key={w.name}>
                <Td><b>{w.name}</b> <Label variant="outline" isCompact>{w.status.t === 'draft' ? '' : 'built-in'}</Label>{w.status.t === 'draft' && null}<br /><span className="u-muted">{w.sub}</span></Td>
                <Td>{w.ver}</Td>
                <Td><Label color={w.status.c as 'green' | 'yellow'} isCompact>{w.status.t}</Label>{w.since && <span className="u-muted"> {w.since}</span>}</Td>
                <Td>{w.stages}</Td>
                <Td>{w.gates}</Td>
                <Td><Label color="teal" isCompact>{w.cohort}</Label></Td>
                <Td>{w.last}</Td>
                <Td>{w.actions.map(a => <Button key={a} variant="secondary" size="sm">{a}</Button>)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
          Same governance envelope as factory runs — every stage stamps token/cost showback, runs under per-stage OpenShell policy boundaries, honours queue quotas, and lands in the audit log. Activation follows draft → validate → activate with version history kept, and in-flight runs finish on the version they started with.
        </Content>
      </CardBody>
    </Card>
  );
}

/* ---------- tab 6: rule coverage ---------- */
function RuleCoverage() {
  return (
    <div style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
      <Card>
        <CardHeader actions={{ actions: <Button variant="secondary">Validate all custom rulesets</Button> }}>
          <CardTitle>Rule coverage matrix</CardTitle>
        </CardHeader>
        <CardBody>
          <Table aria-label="Rule coverage matrix" variant="compact">
            <Thead><Tr>
              <Th>Ruleset · rule</Th><Th>Source</Th><Th>Apps analyzed</Th><Th>Matches</Th><Th>False-positive rate</Th><Th>Validation</Th>
            </Tr></Thead>
            <Tbody>
              {RULE_ROWS.map(r => (
                <Tr key={r.rule}>
                  <Td><code>{r.rule.split(' · ')[0]}</code> · {r.rule.split(' · ')[1]}</Td>
                  <Td>{r.src}</Td>
                  <Td>{r.apps}</Td>
                  <Td>{r.matches}</Td>
                  <Td>{r.fp}</Td>
                  <Td><Label color={undefined} variant={r.valid.c === 'outline' ? 'outline' : undefined} {...(r.valid.c !== 'outline' ? { color: r.valid.c as 'green' | 'yellow' } : {})} isCompact>{r.valid.t}</Label>{r.note && <>{' '}{r.note === 'validate now' ? <a href="#" onClick={e => e.preventDefault()}>{r.note}</a> : <span className="u-muted">{r.note}</span>}</>}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
            False-positive markings on incidents roll up here — the loop closes: triage decision → coverage matrix → rules iteration
          </Content>
        </CardBody>
      </Card>
      <Card style={{ marginTop: 'var(--rh-space-lg)' }}>
        <CardHeader><CardTitle>Rule result transparency</CardTitle></CardHeader>
        <CardBody>
          <Table aria-label="Rule result transparency" variant="compact">
            <Thead><Tr><Th>Incident</Th><Th>Rule</Th><Th>Rule file</Th><Th>Effort hint source</Th></Tr></Thead>
            <Tbody>
              <Tr><Td>WebLogic JNDI lookup ×3 — <a href="#scr=inventory">invoicing</a></Td><Td><code>JNDI 0001</code></Td><Td><code>rules/weblogic-to-eap/jndi-0001.yaml</code></Td><Td>rule hint (5 pts) · confirmed by 2 triagers in this cohort</Td></Tr>
              <Tr><Td>javax → jakarta ×41 — <a href="#scr=inventory">payments-api</a></Td><Td><code>90002</code></Td><Td><code>rules/jakarta-ee-10/javax-to-jakarta.yaml</code></Td><Td>rule hint (1 pt) · cohort-verified</Td></Tr>
              <Tr><Td>ORM hint replacement — <a href="#scr=inventory">risk-scoring</a></Td><Td><code>2200</code></Td><Td><code>rules/orm-hints/hint-replacement.yaml</code></Td><Td>triager override (8 pts, was rule hint 3 pts)</Td></Tr>
            </Tbody>
          </Table>
        </CardBody>
      </Card>
      <Card style={{ marginTop: 'var(--rh-space-lg)' }}>
        <CardHeader><CardTitle>Hub ↔ IDE round-trip</CardTitle></CardHeader>
        <CardBody>
          <List>
            <ListItem><b>Triage sync:</b> a triage decision made here (or in the IDE) is written through the triage API and appears on both surfaces — actor and timestamp included</ListItem>
            <ListItem><b>Rules round-trip:</b> IDE-authored custom rules validate against the same engine (<code>POST /rulesets/validate</code>) and publish into the coverage matrix above</ListItem>
            <ListItem><b>SSO:</b> the IDE extension authenticates against the same OIDC identity as the Hub — assignments, team scope, and audit attribution carry over</ListItem>
          </List>
        </CardBody>
      </Card>
    </div>
  );
}

/* ---------- tab 7: questionnaire answers ---------- */
function Answers() {
  return (
    <Card style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
      <CardHeader><CardTitle>Questionnaire answers</CardTitle></CardHeader>
      <CardBody>
        <Table aria-label="Questionnaire answers" variant="compact">
          <Thead><Tr><Th>Questionnaire</Th><Th>Section</Th><Th>Question</Th><Th>Answer</Th><Th>Risk</Th><Th>Application</Th></Tr></Thead>
          <Tbody>
            {ANSWERS.map((a, i) => (
              <Tr key={i}>
                <Td>{a.q}</Td><Td>{a.section}</Td><Td>{a.question}</Td><Td>{a.answer}</Td>
                <Td><Label color={RISK_LABEL(a.risk)} isCompact>{a.risk}</Label></Td>
                <Td><a href="#scr=inventory">{a.app}</a></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
          7 of 45 recorded answers shown — the grid samples the completed assessments in the inventory (payments-api, claims-web, cust-portal, policy-engine, notification-router); answers are recorded per application and version
        </Content>
      </CardBody>
    </Card>
  );
}
