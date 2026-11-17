import { useMemo, useState } from 'react';
import {
  Card, CardBody, CardHeader, CardTitle, Title, Content, ContentVariants, Tabs, Tab, TabTitleText,
  Toolbar, ToolbarContent, ToolbarItem, SearchInput, Label, Modal, ModalHeader, ModalBody,
  Alert, DescriptionList, DescriptionListDescription, DescriptionListGroup, DescriptionListTerm,
  Button, Pagination, Split, SplitItem,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { useApp, useScoped, can } from '../state/appState';
import { useHub } from '../api/hub';
import { api } from '../api/client';
import type { AppRow, TicketRow } from '../api/hub';
import { dec } from '../utils/decode';

type Row = AppRow;
type IncRow = [string, string, string, string, string, string, string?]; // title, pts, state, stateColor, tracker, trackerColor, incidentKey
type Ticket = TicketRow;

/* Insights sample (upstream /insights/all parity, WP9): informational findings —
   no effort estimate, kept out of the triage queue. Ported from the mock's
   static insight rows. */
const INSIGHTS = [
  { key: 'hardcoded', title: 'Hard-coded hostnames and IP addresses', cat: 'Cloud readiness', catColor: 'teal', src: 'analysis — cloud-readiness ruleset', targets: 'OpenShift', apps: 'payments-api,invoicing,claims-batch', why: 'No effort estimate: the fix is environment configuration, not code — it informs the platform workstream and the Credentials/Identity registry setup, not the triage queue.' },
  { key: 'broker', title: 'Embedded message broker clients detected', cat: 'Technology usage', catColor: 'blue', src: 'analysis — technology-usage ruleset', targets: '— (platform fact)', apps: 'claims-batch,ledger-sync', why: 'A platform fact, not a violation: knowing where brokers are embedded shapes the dependency inventory.' },
  { key: 'ci', title: 'Verification suites exist but are not wired into CI', cat: 'Testing', catColor: 'orange', src: 'assessment questionnaire answer (v3)', targets: '—', apps: 'risk-scoring', why: 'Feeds the test charter and the wave gate evidence.' },
];

interface QueueRow {
  app: string;
  wave: string;
  title: string;
  pts: string;      // '' when missing
  state: string;
  stateColor: string;
  tracker: string;  // queue-cell value: raw row value, or the WAVE_TICKETS fallback on idx 0
  trackerColor: string;
  rawTracker: string;       // openIncidentFromRow passes r[4]/r[5] — no fallback in the modal
  rawTrackerColor: string;
  raw: IncRow;              // full group row (carries the sampled incidentKey for triage writes)
  idx: number;
}

const STATE_OPTIONS = ['All', 'Triage', 'In progress', 'Assigned'];

export function Incidents() {
  const { apps } = useScoped();
  const { data } = useHub();
  const INCIDENTS = data.incidents as unknown as Record<string, { total: number; pts: string; rows: IncRow[] }>;
  const TICKETS = data.tickets as unknown as Record<string, Ticket>;
  const [tab, setTab] = useState(0);
  const [mine, setMine] = useState(true);
  const [waves, setWaves] = useState<string[]>([]);
  const [st, setSt] = useState('All');
  const [query, setQuery] = useState('');
  /* Application chip, seeded from the inventory drill-through
     (#scr=incidents&app=<name> — the mock's incAppChip) — clearable. */
  const [appChip, setAppChip] = useState(() => decodeURIComponent(
    (location.hash.match(/[?&]app=([^&]+)/) || [])[1] || ''));
  const [sortKey, setSortKey] = useState<'app' | 'incident' | 'effort' | 'state' | ''>('');
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [modal, setModal] = useState<{ app: string; row: IncRow; idx: number } | null>(null);
  const [insight, setInsight] = useState<(typeof INSIGHTS)[number] | null>(null);

  // rows derive from scopedApps × APP_INCIDENTS (port of renderIncQueue)
  const allRows: QueueRow[] = useMemo(() => {
    const out: QueueRow[] = [];
    (apps as Row[]).forEach(a => {
      const inc = INCIDENTS[a.name as string];
      if (!inc || !inc.rows) return;
      const tk = TICKETS[a.name as string];
      inc.rows.forEach((r, idx) => {
        let tracker = '', trackerColor = '';
        if (r[4]) { tracker = r[4]; trackerColor = r[5] || 'outline'; }
        else if (idx === 0 && tk) { tracker = (tk.key ? tk.key + ' ' : '') + tk.outcome; trackerColor = tk.oc; }
        out.push({ app: a.name as string, wave: (a.wave as string) || '', title: dec(r[0]), pts: r[1], state: r[2], stateColor: r[3], tracker: dec(tracker), trackerColor, rawTracker: dec(r[4]), rawTrackerColor: r[5] || '', raw: r, idx });
      });
    });
    return out;
  }, [apps]);

  const waveOptions = useMemo(() => [...new Set(allRows.map(r => r.wave).filter(Boolean))], [allRows]);

  const filtered = useMemo(() => {
    let r = allRows.filter(row =>
      (st === 'All' || row.state === st) &&
      (!mine || !!TICKETS[row.app]) &&
      (waves.length === 0 || waves.includes(row.wave)) &&
      (!appChip || row.app === appChip) &&
      (!query || (row.app + ' ' + row.title).toLowerCase().includes(query.toLowerCase())));
    if (sortKey) {
      const val = (row: QueueRow): string | number =>
        sortKey === 'app' ? row.app : sortKey === 'effort' ? parseInt(row.pts, 10) : sortKey === 'incident' ? row.title : row.state;
      r = [...r].sort((a, b) => {
        const va = val(a), vb = val(b);
        if (sortKey === 'effort') {
          const na = isNaN(va as number), nb = isNaN(vb as number);
          if (na && nb) return 0;
          if (na) return 1;   // missing effort sorts last in both directions
          if (nb) return -1;
          return sortDir * ((va as number) - (vb as number));
        }
        return sortDir * String(va).localeCompare(String(vb));
      });
    }
    return r;
  }, [allRows, st, mine, waves, appChip, query, sortKey, sortDir]);

  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);

  const onSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => (d === 1 ? -1 : 1));
    else { setSortKey(key); setSortDir(1); }
    setPage(1);
  };
  /* only the active column carries index/direction — otherwise every header
     renders with an active sort arrow (mock row-86/92 glyph semantics) */
  const sortProps = (key: typeof sortKey, columnIndex: number) => ({
    sort: {
      sortBy: sortKey === key
        ? { index: columnIndex, direction: sortDir === 1 ? 'asc' : 'desc' as 'asc' | 'desc', defaultDirection: 'asc' as const }
        : { defaultDirection: 'asc' as const },
      onSort: () => onSort(key),
      columnIndex,
    },
  });

  return (
    <>
      <Title headingLevel="h1" size="2xl" className="page-title">Incidents</Title>
      <Content component={ContentVariants.p} className="page-subtitle">
        The migrator&apos;s daily surface — assigned work with decisions, not raw findings
      </Content>

      <Tabs activeKey={tab} onSelect={(_e, k) => setTab(k as number)} aria-label="Incidents sections" style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
        <Tab eventKey={0} title={<TabTitleText>Triage queue</TabTitleText>} aria-label="Triage queue">
          <Card style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
            <CardBody>
              <Toolbar>
                <ToolbarContent>
                  {appChip && (
                    <ToolbarItem>
                      <Label color="teal" onClose={() => { setAppChip(''); setPage(1); }}>
                        Application: {appChip}
                      </Label>
                    </ToolbarItem>
                  )}
                  <ToolbarItem>
                    <Label
                      color="teal"
                      onClick={() => { setMine(m => !m); setPage(1); }}
                      style={{ cursor: 'pointer' }}
                      textMaxWidth="200px"
                    >
                      {mine ? '✓ ' : ''}Assigned to me
                    </Label>
                  </ToolbarItem>
                  {waveOptions.map(w => (
                    <ToolbarItem key={w}>
                      <Label color="teal" onClick={() => { setWaves(ws => ws.includes(w) ? ws.filter(x => x !== w) : [...ws, w]); setPage(1); }} style={{ cursor: 'pointer' }}>
                        {waves.includes(w) ? '✓ ' : ''}Wave {w}
                      </Label>
                    </ToolbarItem>
                  ))}
                  <ToolbarItem>
                    <select
                      className="pf-v6-c-form-control"
                      value={st}
                      onChange={e => { setSt(e.target.value); setPage(1); }}
                      aria-label="Filter by State"
                      style={{ width: '170px' }}
                    >
                      {STATE_OPTIONS.map(o => <option key={o} value={o}>State: {o}</option>)}
                    </select>
                  </ToolbarItem>
                  <ToolbarItem>
                    <SearchInput
                      placeholder="Filter by incident…"
                      value={query}
                      onChange={(_e, v) => { setQuery(v); setPage(1); }}
                      onClear={() => { setQuery(''); setPage(1); }}
                      aria-label="Incident search"
                    />
                  </ToolbarItem>
                </ToolbarContent>
              </Toolbar>

              <Table aria-label="Incident triage queue" variant="compact">
                <Thead>
                  <Tr>
                    <Th {...sortProps('app', 0)}>Application</Th>
                    <Th {...sortProps('incident', 1)}>Incident</Th>
                    <Th {...sortProps('effort', 2)}>Effort</Th>
                    <Th {...sortProps('state', 3)}>State</Th>
                    <Th>Tracker</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {pageRows.map(r => (
                    <Tr key={r.app + r.idx} onClick={() => setModal({ app: r.app, row: r.raw, idx: r.idx })} isRowSelected={false}>
                      <Td dataLabel="Application"><b>{r.app}</b></Td>
                      <Td dataLabel="Incident">{r.title}</Td>
                      <Td dataLabel="Effort">{r.pts || <span className="u-muted">—</span>}</Td>
                      <Td dataLabel="State"><IncLabel color={r.stateColor} compact>{r.state}</IncLabel></Td>
                      <Td dataLabel="Tracker">
                        {r.tracker
                          ? <IncLabel color={r.trackerColor} compact>{r.tracker}</IncLabel>
                          : <span className="u-muted">—</span>}
                      </Td>
                    </Tr>
                  ))}
                  {pageRows.length === 0 && (
                    <Tr><Td colSpan={5}>
                      <Content component={ContentVariants.p} className="u-muted">
                        No incidents match the current filters — clear the state filter, the wave or Assigned-to-me chips, or the search.
                      </Content>
                    </Td></Tr>
                  )}
                </Tbody>
              </Table>
              {filtered.length > 0 && (
                <Pagination
                  itemCount={filtered.length}
                  perPage={perPage}
                  page={page}
                  onSetPage={(_e, p) => setPage(p)}
                  onPerPageSelect={(_e, pp) => { setPerPage(pp); setPage(1); }}
                  widgetId="inc-pagination"
                  titles={{ items: 'incidents' }}
                />
              )}
            </CardBody>
          </Card>
        </Tab>
        <Tab eventKey={1} title={<TabTitleText>Insights</TabTitleText>} aria-label="Insights">
          <Card style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
            <CardHeader><CardTitle>Insights — informational findings, no effort estimate</CardTitle></CardHeader>
            <CardBody>
              <Table aria-label="Insights" variant="compact">
                <Thead>
                  <Tr><Th>Insight</Th><Th>Category</Th><Th>Source</Th><Th>Target(s)</Th><Th>Affected applications</Th></Tr>
                </Thead>
                <Tbody>
                  {INSIGHTS.map(i => (
                    <Tr key={i.key} onClick={() => setInsight(i)}>
                      <Td dataLabel="Insight"><b>{i.title}</b></Td>
                      <Td dataLabel="Category">{i.cat}</Td>
                      <Td dataLabel="Source">{i.src}</Td>
                      <Td dataLabel="Target(s)">{i.targets}</Td>
                      <Td dataLabel="Affected applications">{i.apps.split(',').join(', ')}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </CardBody>
          </Card>
        </Tab>
      </Tabs>

      <IncidentModal modal={modal} onClose={() => setModal(null)} apps={apps as Row[]} />
      <InsightModal insight={insight} onClose={() => setInsight(null)} />
    </>
  );
}

function labelColor(c: string): 'green' | 'blue' | 'orange' | 'red' | 'yellow' | 'grey' | 'purple' | 'teal' {
  const map: Record<string, 'green' | 'blue' | 'orange' | 'red' | 'yellow' | 'grey' | 'purple' | 'teal'> = {
    green: 'green', blue: 'blue', orange: 'orange', red: 'red', yellow: 'yellow',
    grey: 'grey', gray: 'grey', purple: 'purple', teal: 'teal', cyan: 'teal', outline: 'grey',
  };
  return map[c] || 'grey';
}

/* the mock renders `pf-m-<stateColor>` labels; stateColor 'outline' maps to
   PF6's isOutline treatment, not a filled grey (queue states, 'Export queued') */
function IncLabel({ color, compact, children }: { color: string; compact?: boolean; children: React.ReactNode }) {
  if (color === 'outline') {
    return <Label variant="outline" isCompact={compact}>{children}</Label>;
  }
  return <Label color={labelColor(color)} isCompact={compact}>{children}</Label>;
}

/* ---------- incident triage modal (port of tpl-drawer-incident + openIncidentDetail) ---------- */
/* the template's statics (hint alert, triage-state card) show for every incident;
   openIncidentDetail rewrites title/meta/Rule/Tracker/Cohort/Effort/Open-file per row */
function incRuleFor(title: string): { name: string; path: string } {
  const slug = title.toLowerCase().replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[→←]/g, ' to ')
    .replace(/[×]/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const parts = slug.split('-').filter(Boolean);
  const tail = parts.slice(-2).join('-');
  return { name: tail.replace(/-/g, ' ') + ' 0001', path: 'rules/' + slug + '/' + tail + '-0001.yaml' };
}
const isCohortMember = (app: string, apps: Row[]) => apps.some(a => a.name === app && a.archetype === 'EAP8-archetype');

function IncidentModal({ modal, onClose, apps }: { modal: { app: string; row: IncRow; idx: number } | null; onClose: () => void; apps: Row[] }) {
  const { state } = useApp();
  const { reload } = useHub();
  const [triageBusy, setTriageBusy] = useState(false);
  const [triageMsg, setTriageMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!modal) return null;
  const [title, pts, st, stColor, tracker, trackerColor, incidentKey] = modal.row;
  const canResolve = can(state.persona, 'write', 'triage');
  const canTriage = can(state.persona, 'write', 'triage');
  const rule = incRuleFor(title);
  const cohort = isCohortMember(modal.app, apps);

  const writeTriage = async (newState: 'FALSE_POSITIVE' | 'RESOLVED') => {
    if (!incidentKey) return;
    setTriageBusy(true);
    setTriageMsg(null);
    try {
      await api(`/incidents/${encodeURIComponent(incidentKey)}/triage`, {
        method: 'PUT',
        body: { state: newState, comment: `${newState === 'RESOLVED' ? 'resolved' : 'false positive'} from the console triage queue` },
      });
      setTriageMsg({ ok: true, text: `Triage recorded: ${newState === 'RESOLVED' ? 'resolved' : 'false positive'} — the queue re-derives from the hub.` });
      reload();
    } catch (e) {
      setTriageMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setTriageBusy(false);
    }
  };
  return (
    <Modal variant="medium" isOpen onClose={onClose} aria-label="Incident detail">
      <ModalHeader
        title={<>{title} <IncLabel color={stColor}>{st}</IncLabel></>}
        labelId="inc-modal-title"
      />
      <ModalBody>
        <Content component={ContentVariants.small} className="u-muted">
          <a href="#scr=inventory" onClick={onClose}>{modal.app}</a> · assigned via team scope · {pts}
        </Content>

        <Alert variant="info" isInline title="Migration hint available" style={{ marginTop: 'var(--rh-space-lg)' }}>
          <p>All 3 occurrences share one replacement pattern. Apply, re-compile, and the verification suite checks the fix succeeds at startup.</p>
        </Alert>

        <DescriptionList isCompact columnModifier={{ default: '1Col' }} style={{ margin: 'var(--rh-space-lg) 0' }}>
          <DescriptionListGroup>
            <DescriptionListTerm>Rule</DescriptionListTerm>
            <DescriptionListDescription>
              {rule.name} · <code>{rule.path}</code>
            </DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Tracker</DescriptionListTerm>
            <DescriptionListDescription>
              {tracker
                ? <IncLabel color={trackerColor} compact>{tracker}</IncLabel>
                : <span className="u-muted">not exported to a tracker</span>}
              {' '}
            </DescriptionListDescription>
          </DescriptionListGroup>
          {cohort && (
            <DescriptionListGroup>
              <DescriptionListTerm>Cohort</DescriptionListTerm>
              <DescriptionListDescription>EAP8-archetype — same finding in 6 other members · <a href="#scr=inventory" onClick={onClose}>open cohort</a></DescriptionListDescription>
            </DescriptionListGroup>
          )}
          <DescriptionListGroup>
            <DescriptionListTerm>Effort</DescriptionListTerm>
            <DescriptionListDescription>{pts} · rule-derived{cohort ? ', confirmed twice in this cohort' : ''}</DescriptionListDescription>
          </DescriptionListGroup>
        </DescriptionList>

        <Split hasGutter style={{ marginTop: 'var(--pf-t--global--spacer--sm)' }}>
          <SplitItem>
            <Button variant="primary" isDisabled={!canResolve || triageBusy || !incidentKey}
              title={canResolve ? (incidentKey ? undefined : 'No sampled incident key for this group') : 'Missing scope triage:write'}
              onClick={() => void writeTriage('RESOLVED')}>
              Mark resolved
            </Button>
          </SplitItem>
          <SplitItem><Button variant="secondary">Open file</Button></SplitItem>
          <SplitItem>
            <Button variant="secondary" isDisabled={!canTriage || triageBusy || !incidentKey}
              title={canTriage ? (incidentKey ? undefined : 'No sampled incident key for this group') : 'Missing scope triage:write'}
              onClick={() => void writeTriage('FALSE_POSITIVE')}>
              Mark false positive
            </Button>
          </SplitItem>
          <SplitItem><Button variant="secondary">Assign to agent group</Button></SplitItem>
        </Split>
        {triageMsg && (
          <Alert variant={triageMsg.ok ? 'success' : 'danger'} isInline title={triageMsg.text} style={{ marginTop: 'var(--rh-space-md)' }} />
        )}

        <Card isPlain style={{ border: '1px solid var(--pf-t--global--border--color--subtle)', marginTop: 'var(--rh-space-lg)' }}>
          <CardHeader><CardTitle component="h4" className="u-muted">Triage state</CardTitle></CardHeader>
          <CardBody>
            <Table aria-label="Triage state" variant="compact">
              <Tbody>
                <Tr><Td>In progress</Td><Td>m.migrator · 2026-09-30 · &quot;pattern confirmed on the sampled occurrences, one needs a second look&quot;</Td></Tr>
                <Tr><Td>Comment added</Td><Td>a.weber@northwind-financial.com · 2026-09-29 · via IDE extension — synced both surfaces</Td></Tr>
              </Tbody>
            </Table>
          </CardBody>
        </Card>
      </ModalBody>
    </Modal>
  );
}

/* ---------- insight detail modal (port of openInsightDetail) ---------- */
function InsightModal({ insight, onClose }: { insight: (typeof INSIGHTS)[number] | null; onClose: () => void }) {
  if (!insight) return null;
  return (
    <Modal variant="medium" isOpen onClose={onClose} aria-label="Insight detail">
      <ModalHeader
        title={<>{insight.title} <IncLabel color={insight.catColor}>{insight.cat}</IncLabel></>}
        labelId="insight-modal-title"
      />
      <ModalBody>
        <Content component={ContentVariants.small} className="u-muted">
          Insight — informational finding, no effort estimate
        </Content>
        <DescriptionList isCompact columnModifier={{ default: '1Col' }} style={{ marginTop: 'var(--rh-space-lg)' }}>
          <DescriptionListGroup>
            <DescriptionListTerm>Category</DescriptionListTerm>
            <DescriptionListDescription>{insight.cat}</DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Source</DescriptionListTerm>
            <DescriptionListDescription>{insight.src}</DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Target(s)</DescriptionListTerm>
            <DescriptionListDescription>{insight.targets}</DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Affected applications</DescriptionListTerm>
            <DescriptionListDescription>{insight.apps.split(',').join(', ')}</DescriptionListDescription>
          </DescriptionListGroup>
        </DescriptionList>
        <Card isPlain style={{ border: '1px solid var(--pf-t--global--border--color--subtle)', marginTop: 'var(--rh-space-lg)' }}>
          <CardHeader><CardTitle component="h4">Why this is an insight, not an incident</CardTitle></CardHeader>
          <CardBody><Content component={ContentVariants.p} className="u-muted">{insight.why}</Content></CardBody>
        </Card>
      </ModalBody>
    </Modal>
  );
}
