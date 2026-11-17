import { useMemo, useState } from 'react';
import {
  Alert, Button, Card, CardBody, CardHeader, CardTitle, Content, ContentVariants,
  DescriptionList, DescriptionListDescription, DescriptionListGroup, DescriptionListTerm,
  Label, Modal, ModalHeader, ModalBody, Pagination, Title,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { useApp, useScoped, can } from '../state/appState';
import { useHub, type TaskRow } from '../api/hub';
import { dec } from '../utils/decode';

/* task queue — hub data (/tasks), adapted in src/api/hub.tsx; the 'Postponed'
   display state derives from a QUEUED task carrying a quota label */
const TASKS: TaskRow[] = [];

const STATE_COLOR: Record<string, 'red' | 'grey' | 'blue' | 'yellow'> = {
  Failed: 'red', Queued: 'grey', Running: 'blue', Postponed: 'yellow',
};

/* ---------- task detail modal (port of tpl-drawer-task, sampled #494 record) ---------- */
function TaskModal({ task, onClose }: { task: TaskRow | null; onClose: () => void }) {
  if (!task) return null;
  return (
    <Modal variant="large" isOpen onClose={onClose} aria-label="Task detail">
      <ModalHeader title={<>{`Task #${task.id}`} <Label color={STATE_COLOR[task.state]}>{task.state}</Label></>} labelId="task-modal-title" />
      <ModalBody>
        <Content component={ContentVariants.small} className="u-muted">
          <a href="#scr=inventory">{task.app}</a> · {task.kind} · created by svc-discovery
        </Content>
        {task.errorCode === 'PVC_RWX_DENIED' && (
          <Alert variant="danger" isInline title="Root cause" style={{ marginTop: 'var(--rh-space-lg)' }}>
            <div className="pf-v6-c-code-block" style={{ margin: 'var(--rh-space-md) 0' }}>
              <div className="pf-v6-c-code-block__header"><span className="u-muted">stderr</span><Button variant="link" size="sm">Copy</Button></div>
              <pre className="pf-v6-c-code-block__pre"><code className="pf-v6-c-code-block__code">mkdir /cache/m2: permission denied</code></pre>
            </div>
            <p>The Maven cache volume is mounted read-only for this task&apos;s service account.<br />
              <b>Action:</b> verify the PVC is RWX-enabled (Suggestion 31 §storage), then retry.</p>
          </Alert>
        )}
        <DescriptionList isCompact style={{ margin: 'var(--rh-space-lg) 0' }}>
          <DescriptionListGroup>
            <DescriptionListTerm>Sandbox</DescriptionListTerm>
            <DescriptionListDescription><code>{`task-${task.id}-ws`}</code> — <a href="#" onClick={e => e.preventDefault()}>pod logs (in-UI)</a></DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Attempts</DescriptionListTerm>
            <DescriptionListDescription>2 (auto-retried once)</DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Audit</DescriptionListTerm>
            <DescriptionListDescription>triggered by <code>svc-discovery</code> via API key · 09:14</DescriptionListDescription>
          </DescriptionListGroup>
        </DescriptionList>
        <Content component={ContentVariants.small} className="u-muted">
          Structured events: Created → Ready (2m) → Postponed ×3 (rule: Dependency) → Running{task.state === 'Failed' ? ' → Failed' : ''} (full timeline on the sampled #494 record)
        </Content>
        <div style={{ marginTop: 'var(--rh-space-md)' }}>
          <Button variant="secondary">Show technical details (YAML/JSON)</Button>
        </div>
      </ModalBody>
    </Modal>
  );
}

/* ---------- the screen ---------- */
export function Tasks() {
  const { state } = useApp();
  const { apps } = useScoped();
  const { data } = useHub();
  const names = useMemo(() => new Set(apps.map(a => a.name as string)), [apps]);
  TASKS.length = 0;
  data.tasks.forEach(x => TASKS.push(x));

  /* queue health header — derived live from the same rows */
  const qh = useMemo(() => {
    const queued = TASKS.filter(x => x.state === 'Queued' || x.state === 'Postponed');
    const failed = TASKS.filter(x => x.state === 'Failed');
    const quota = TASKS.filter(x => !!x.quota);
    const oldest = queued.reduce((m, x) => Math.max(m, x.ageMin), 0);
    return { queued: queued.length, failed: failed.length, quota: quota.length, oldest, oldestTxt: oldest >= 60 ? `${Math.floor(oldest / 60)}h ${oldest % 60}m` : `${oldest}m` };
  }, [data]);

  /* filter state — the two chips are machine-readable and removable (removing stops constraining) */
  const [stateChip, setStateChip] = useState<string[] | null>(['Failed', 'Postponed']);
  const [kindChip, setKindChip] = useState<string | null>('analysis');
  const [appFilter, setAppFilter] = useState('All');
  const [ageFilter, setAgeFilter] = useState('Any age');

  /* selection (page/all/none) + sort + pager */
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<{ idx: 'id' | 'age'; dir: 'asc' | 'desc' }>({ idx: 'id', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [detail, setDetail] = useState<TaskRow | null>(null);

  const canCancel = can(state.persona, 'cancel', 'tasks');

  const filtered = useMemo(() => {
    const rows = TASKS.filter(t => {
      if (!names.has(t.app)) return false;
      if (appFilter !== 'All' && t.app !== appFilter) return false;
      if (ageFilter === 'Under 1h' && !(t.ageMin <= 60)) return false;
      if (ageFilter === 'Over 1h' && !(t.ageMin > 60)) return false;
      if (stateChip && !stateChip.includes(t.state)) return false;
      if (kindChip && t.kind !== kindChip) return false;
      return true;
    });
    if (sortBy.idx === 'id') {
      rows.sort((a, b) => sortBy.dir === 'desc' ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id));
    } else {
      rows.sort((a, b) => sortBy.dir === 'desc' ? b.ageMin - a.ageMin : a.ageMin - b.ageMin);
    }
    return rows;
  }, [names, appFilter, ageFilter, stateChip, kindChip, sortBy]);

  const start = (page - 1) * perPage;
  const pageRows = filtered.slice(start, start + perPage);
  const pageSelCount = pageRows.filter(t => sel.has(t.id)).length;
  const allPageSel = pageRows.length > 0 && pageSelCount === pageRows.length;

  const togglePage = (checked: boolean) =>
    setSel(s => { const n = new Set(s); pageRows.forEach(t => checked ? n.add(t.id) : n.delete(t.id)); return n; });
  const selAllMatching = () => setSel(new Set(filtered.map(t => t.id)));
  const selNone = () => setSel(new Set());
  const selCount = sel.size;

  const sortParams = (key: 'id' | 'age', colIdx: number) => ({
    sort: {
      columnIndex: colIdx,
      sortBy: {
        index: sortBy.idx === key ? colIdx : undefined,
        direction: sortBy.idx === key ? sortBy.dir : undefined,
        defaultDirection: 'desc' as const,
      },
      onSort: (_e: React.MouseEvent, idx: number, dir: 'asc' | 'desc') =>
        setSortBy({ idx: idx === 5 ? 'age' : 'id', dir }),
    },
  });

  const appOptions = useMemo(() => ['All', ...Array.from(new Set(TASKS.map(t => t.app)))], []);

  return (
    <>
      <Title headingLevel="h1" size="2xl" className="page-title">Tasks</Title>
      <Content component={ContentVariants.p} className="page-subtitle">
        The migrator&apos;s daily surface — assigned work with decisions, not raw findings
      </Content>
      <Card style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
        <CardHeader><CardTitle>Task queue</CardTitle></CardHeader>
        <CardBody>
          <div className="qhealth">
            <div>
              <div className="big">{qh.queued} <span className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)', fontWeight: 400 }}>queued</span></div>
              <div className="u-muted">oldest waiting <b>{qh.oldestTxt}</b></div>
            </div>
            <div>
              <div className="big" style={{ color: 'var(--pf-t--global--color--status--danger--default)' }}>{qh.failed} <span className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)', fontWeight: 400 }}>failed</span></div>
              <div className="u-muted">cause grouped on the failure code</div>
            </div>
            <div>
              <div className="big" style={{ color: 'var(--pf-t--global--color--status--warning--default)' }}>{qh.quota} <span className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)', fontWeight: 400 }}>quota-blocked</span></div>
              <div className="u-muted">quota <b>concurrent-analyses</b> (8/8) → raise in CR</div>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <Button variant="danger" isDisabled={selCount === 0 || !canCancel}
                title={!canCancel ? 'Missing scope tasks:cancel' : undefined}
                onClick={() => { selNone(); }}>
                {`Cancel selected (${selCount})`}
              </Button>
            </div>
          </div>

          <div className="pf-v6-c-toolbar" style={{ marginTop: 'var(--rh-space-md)' }}>
            <div className="pf-v6-c-toolbar__content">
              <div className="pf-v6-c-toolbar__content-section">
                <div className="pf-v6-c-toolbar__group pf-m-filter-group">
                  {stateChip && (
                    <div className="pf-v6-c-toolbar__item">
                      <Label color="teal" onClose={() => setStateChip(null)}>State: {stateChip.join(', ')}</Label>
                    </div>
                  )}
                  {kindChip && (
                    <div className="pf-v6-c-toolbar__item">
                      <Label color="teal" onClose={() => setKindChip(null)}>Kind: {kindChip}</Label>
                    </div>
                  )}
                  <div className="pf-v6-c-toolbar__item">
                    <select className="pf-v6-c-form-control" aria-label="Application filter" style={{ width: 'auto' }}
                      value={appFilter} onChange={e => { setAppFilter(e.target.value); setPage(1); }}>
                      {appOptions.map(a => <option key={a} value={a}>{a === 'All' ? 'Application… (All)' : a}</option>)}
                    </select>
                  </div>
                  <div className="pf-v6-c-toolbar__item">
                    <select className="pf-v6-c-form-control" aria-label="Age filter" style={{ width: 'auto' }}
                      value={ageFilter} onChange={e => { setAgeFilter(e.target.value); setPage(1); }}>
                      <option>Any age</option><option>Under 1h</option><option>Over 1h</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Table aria-label="Task queue" variant="compact" style={{ marginTop: 'var(--rh-space-md)' }}>
            <Thead>
              <Tr>
                <Th className="pf-v6-c-table__check" style={{ width: 90 }}>
                  <input type="checkbox" className="pf-v6-c-check__input" aria-label="Select rows on this page"
                    checked={allPageSel} onChange={e => togglePage(e.target.checked)} style={{ cursor: 'pointer' }} />
                  {' '}
                  <details style={{ display: 'inline-block' }}>
                    <summary aria-label="Selection options" style={{ cursor: 'pointer', listStyle: 'none' }}>▾</summary>
                    <div style={{ position: 'absolute', zIndex: 10, background: 'var(--pf-t--global--background--color--primary--default)', border: '1px solid var(--pf-t--global--border--color--subtle)', borderRadius: 'var(--pf-t--global--border--radius--small)', padding: 'var(--rh-space-xs) 0' }}>
                      <button className="pf-v6-c-button pf-m-plain" style={{ width: '100%' }} onClick={() => togglePage(true)}>Select page</button>
                      <button className="pf-v6-c-button pf-m-plain" style={{ width: '100%' }} onClick={selAllMatching}>Select all matching</button>
                      <button className="pf-v6-c-button pf-m-plain" style={{ width: '100%', color: selCount === 0 ? 'var(--pf-t--global--text--color--disabled)' : undefined }}
                        aria-disabled={selCount === 0} title={selCount === 0 ? 'Nothing selected' : undefined} onClick={() => { if (selCount) selNone(); }}>Select none</button>
                    </div>
                  </details>
                </Th>
                <Th {...sortParams('id', 1)}>ID</Th>
                <Th>State</Th>
                <Th>Application</Th>
                <Th>Kind</Th>
                <Th {...sortParams('age', 5)}>Age</Th>
                <Th>Decision — not a dump</Th>
              </Tr>
            </Thead>
            <Tbody>
              {pageRows.length === 0 && (
                <Tr><Td colSpan={7}>
                  <Content component={ContentVariants.p} className="u-muted">
                    No tasks match the current filters or your organization scope — clear the state chip, the application filter, or the age filter.
                  </Content>
                </Td></Tr>
              )}
              {pageRows.map(t => (
                <Tr key={t.id} isClickable onClick={() => setDetail(t)}>
                  <Td className="pf-v6-c-table__check" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" className="pf-v6-c-check__input" aria-label={`Select task #${t.id}`}
                      checked={sel.has(t.id)} onChange={e => setSel(s => { const n = new Set(s); if (e.target.checked) n.add(t.id); else n.delete(t.id); return n; })}
                      style={{ cursor: 'pointer' }} />
                  </Td>
                  <Td dataLabel="ID">{`#${t.id}`}</Td>
                  <Td dataLabel="State"><Label color={STATE_COLOR[t.state]} isCompact>{t.state}</Label></Td>
                  <Td dataLabel="Application"><a href="#scr=inventory" onClick={e => e.stopPropagation()}>{t.app}</a></Td>
                  <Td dataLabel="Kind">{t.kind}</Td>
                  <Td dataLabel="Age">{t.age}</Td>
                  <Td dataLabel="Decision">{t.decision}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          {filtered.length > 0 && (
            <Pagination
              itemCount={filtered.length}
              perPage={perPage}
              page={page}
              onSetPage={(_e, p) => setPage(p)}
              onPerPageSelect={(_e, pp) => { setPerPage(pp); setPage(1); }}
              widgetId="task-pagination"
              titles={{ items: 'tasks' }}
            />
          )}
        </CardBody>
      </Card>
      <TaskModal task={detail} onClose={() => setDetail(null)} />
    </>
  );
}

/* dec() kept imported for parity with data-derived screens; task rows are static JSX above */
void dec;
