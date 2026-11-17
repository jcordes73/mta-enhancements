import { useEffect, useMemo, useState } from 'react';
import {
  Card, CardBody, CardHeader, CardTitle, Title, Content, ContentVariants, Toolbar, ToolbarContent, ToolbarItem,
  SearchInput, Label, Badge, Modal, ModalHeader, ModalBody, ModalFooter, Pagination,
  DescriptionList, DescriptionListGroup, DescriptionListTerm, DescriptionListDescription,
  Tabs, Tab, TabTitleText,
  Button, Alert, Menu, MenuList, MenuItem, MenuGroup, MenuToggle, MenuContent,
  EmptyState, EmptyStateBody, EmptyStateActions,
  Form, FormGroup, TextInput, TextArea, FormSelect, FormSelectOption,
} from '@patternfly/react-core';
import { PlusIcon, SearchIcon } from '@patternfly/react-icons';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { useApp, useScoped, TEAM_BY_ID, can } from '../state/appState';
import { useHub, type IncRow, type AppRow } from '../api/hub';
import { api } from '../api/client';

type Row = AppRow;

const STATE_LABEL: Record<string, { text: string; color: 'green' | 'blue' | 'orange' | 'grey' | 'red' }> = {
  succeeded: { text: 'Succeeded', color: 'green' },
  running: { text: 'Running', color: 'blue' },
  quota: { text: 'Quota-blocked', color: 'orange' },
  notstarted: { text: 'Not started', color: 'grey' },
  failed: { text: 'Failed', color: 'red' },
};

/* ---------- filter-category toolbar (port of the mock's consolidated
   FilterToolbar, MTA-8.3-style): one category dropdown, the inline control
   for the chosen category, applied values as removable chips, Clear-all. */
type Cat = 'name' | 'archetypes' | 'binary' | 'repo' | 'platforms' | 'bsvc' | 'creds' | 'tags' | 'risk' | 'state';
const CATS: { cat: Cat; label: string; group: string }[] = [
  { cat: 'name', label: 'Name', group: 'Application' },
  { cat: 'archetypes', label: 'Archetypes', group: 'Application' },
  { cat: 'binary', label: 'Artifact', group: 'Application' },
  { cat: 'repo', label: 'Repository type', group: 'Application' },
  { cat: 'platforms', label: 'Source platforms', group: 'Environment' },
  { cat: 'bsvc', label: 'Business service', group: 'Environment' },
  { cat: 'creds', label: 'Credential type', group: 'Environment' },
  { cat: 'tags', label: 'Tags', group: 'Environment' },
  { cat: 'risk', label: 'Risk', group: 'Assessment' },
  { cat: 'state', label: 'Analysis', group: 'Assessment' },
];
const CAT_GROUPS = ['Application', 'Environment', 'Assessment'];

/* Applications inventory — mock parity: tabs (Applications / Archetypes &
   cohorts), filter-category toolbar with chips, bulk selection + actions,
   sortable 9-column table, pagination, empty state, Create/Import/Export. */
export function Inventory() {
  const { state, set } = useApp();
  const { apps } = useScoped();
  const { data, reload } = useHub();

  /* deep-linked tab (RHDS tabs pattern — &tab=archetypes), riding the app
     state like the Agentic/Config tabs so syncHash keeps it in the URL */
  const tab = state.invTab === 'archetypes' ? 1 : 0;
  const setTab = (t: number) => set({ invTab: t === 1 ? 'archetypes' : 'apps' });
  const [cat, setCat] = useState<Cat>('name');
  const [fName, setFName] = useState('');
  /* multi-value set filters; bsvc is seeded from the home hurts-table
     drill-through (#scr=inventory&bsvc=<name>) */
  const [sets, setSets] = useState<Record<string, string[]>>(() => ({
    bsvc: [decodeURIComponent((location.hash.match(/[?&]bsvc=([^&]+)/) || [])[1] || '')].filter(Boolean),
  }));
  const [repo, setRepo] = useState('');
  const [binary, setBinary] = useState('');
  /* saved-view chips (#2): the mock's three role-typical toggles — "Wave: 3"
     starts active (the architect's default opens on their active wave) */
  const [saved, setSaved] = useState({ stale: false, nowave: false, wave3: true });
  const [openMenu, setOpenMenu] = useState('');
  const [sortKey, setSortKey] = useState<'name' | 'pts' | 'wave' | 'bsvc' | 'age' | ''>('');
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkMsg, setBulkMsg] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [modal, setModal] = useState<Row | null>(null);

  /* close open menus on outside click */
  useEffect(() => {
    if (!openMenu) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-menu-root]')) setOpenMenu('');
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openMenu]);

  const anyFilter = Boolean(fName || repo || binary || Object.values(sets).some(s => s.length) ||
    saved.stale || saved.nowave || saved.wave3);
  const toggleSet = (key: string, v: string) => setSets(s => ({
    ...s,
    [key]: (s[key] || []).includes(v) ? (s[key] || []).filter(x => x !== v) : [...(s[key] || []), v],
  }));
  const clearFilters = () => {
    setFName(''); setSets({}); setRepo(''); setBinary('');
    setSaved({ stale: false, nowave: false, wave3: false });
    setPage(1);
  };
  /* saved chips toggle on click (mock: toggle + page reset in both directions); the × removes */
  const toggleSaved = (k: 'stale' | 'nowave' | 'wave3') => {
    setSaved(s => ({ ...s, [k]: !s[k] }));
    setPage(1);
  };

  const rows = useMemo(() => {
    const inSet = (key: string, val: string) => !(sets[key]?.length) || sets[key].includes(val);
    const overlap = (key: string, vals: string[]) => !(sets[key]?.length) || sets[key].some(s => vals.includes(s));
    let r = (apps as Row[]).filter(a =>
      (!fName || (a.name as string).toLowerCase().includes(fName.toLowerCase())) &&
      inSet('archetypes', a.archetype as string) &&
      inSet('platforms', (a.platform as string) || '') &&
      inSet('bsvc', a.bsvc as string) &&
      overlap('creds', (a.creds as string).split(' ').filter(Boolean)) &&
      overlap('tags', ((a.tags as string) || '').split(' ').filter(Boolean)) &&
      inSet('risk', (a.risk as string) || 'Unassessed') &&
      inSet('state', STATE_LABEL[a.state as string]?.text ?? String(a.state)) &&
      (repo === '' || a.repo === repo) &&
      (binary === '' || a.binary === binary) &&
      /* saved-view chips (mock matches(): stale / planning-gap / active wave) */
      (!saved.stale || a.stale) &&
      (!saved.nowave || !a.wave) &&
      (!saved.wave3 || a.wave === '3'));
    if (sortKey) {
      const val = (a: Row): string | number =>
        sortKey === 'name' ? a.name as string
          : sortKey === 'pts' ? (a.pts as number) || -1
            : sortKey === 'age' ? (a.age as number) ?? -1
              : sortKey === 'wave' ? (a.wave as string) || ''
                : a.bsvc as string;
      r = [...r].sort((a, b) => {
        const va = val(a), vb = val(b);
        const na = va === -1 || va === '', nb = vb === -1 || vb === '';
        if (na && nb) return 0;
        if (na) return 1;   // missing values sort last in both directions
        if (nb) return -1;
        return sortDir * (typeof va === 'number' && typeof vb === 'number'
          ? va - vb : String(va).localeCompare(String(vb)));
      });
    }
    return r;
  }, [apps, fName, sets, repo, binary, saved, sortKey, sortDir]);

  const pageRows = rows.slice((page - 1) * perPage, page * perPage);
  const maxPts = Math.max(...(apps as Row[]).map(a => (a.pts as number) || 0), 1);

  /* live option values for the multi-select categories */
  const options: Record<string, string[]> = useMemo(() => ({
    archetypes: [...new Set((apps as Row[]).map(a => a.archetype as string))].sort(),
    platforms: [...new Set((apps as Row[]).map(a => (a.platform as string) || '').filter(Boolean))].sort(),
    bsvc: [...new Set((apps as Row[]).map(a => a.bsvc as string))].sort(),
    creds: [...new Set((apps as Row[]).flatMap(a => (a.creds as string).split(' ').filter(Boolean)))].sort(),
    tags: [...new Set((apps as Row[]).flatMap(a => ((a.tags as string) || '').split(' ').filter(Boolean)))].sort(),
    risk: ['High', 'Medium', 'Low', 'Unassessed'],
    state: ['Succeeded', 'Running', 'Quota-blocked', 'Not started', 'Failed'],
  }), [apps]);

  /* applied chips: one per active value (the mock's invDynChips semantics) */
  const chips: { key: string; text: string }[] = [
    ...(fName ? [{ key: 'name', text: `Name: ${fName}` }] : []),
    ...Object.entries(sets).flatMap(([k, vs]) => vs.map(v => ({
      key: `${k}:${v}`,
      text: `${CATS.find(c => c.cat === k)?.label ?? k}: ${v}`,
    }))),
    ...(repo ? [{ key: 'repo', text: `Repository type: ${repo === 'git' ? 'Git' : 'Subversion'}` }] : []),
    ...(binary ? [{ key: 'binary', text: `Artifact: ${binary === 'binary' ? 'Associated artifact' : 'No associated artifact'}` }] : []),
  ];
  const dropChip = (key: string) => {
    const k = key.slice(0, key.indexOf(':'));
    const v = key.slice(key.indexOf(':') + 1);
    if (k === 'name') return setFName('');
    if (k === 'repo') return setRepo('');
    if (k === 'binary') return setBinary('');
    setSets(s => ({ ...s, [k]: (s[k] || []).filter(x => x !== v) }));
    setPage(1);
  };

  /* ---------- sorting (RHDS sortable headers: unsorted shows the stacked
     double-triangle glyph — the PF6 Th.sort default; aria-sort syncs) */
  const SORT_COLS: Record<string, number> = { name: 1, pts: 5, wave: 7, bsvc: 8, age: 9 };
  const thSort = (key: string, idx: number) => ({
    columnIndex: idx,
    sortBy: { index: sortKey && SORT_COLS[sortKey] === idx ? idx : -1, direction: sortDir === 1 ? 'asc' as const : 'desc' as const },
    onSort: (_e: unknown, _i: number, dir: 'asc' | 'desc') => {
      setSortKey(key as typeof sortKey);
      setSortDir(dir === 'asc' ? 1 : -1);
      setPage(1);
    },
  });

  /* ---------- selection + bulk actions ---------- */
  const canEdit = can(state.persona, 'update', 'applications');
  const canAnalyze = can(state.persona, 'create', 'analyses');
  const canCreate = can(state.persona, 'create', 'applications');
  const pageSel = pageRows.filter(a => sel.has(a.id)).length;
  const toggleRow = (id: string) => setSel(s => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const selPage = (on: boolean) => setSel(s => {
    const n = new Set(s);
    pageRows.forEach(a => on ? n.add(a.id) : n.delete(a.id));
    return n;
  });

  /* wave-membership PUT needs application UUIDs; AppRow.id maps name → id */
  const idOf = (name: string) => (apps as Row[]).find(a => a.name === name)?.id ?? '';

  const bulkAssign = async (waveId: string) => {
    setBulkMsg('');
    try {
      if (waveId === '__none__') {
        /* not scheduled: remove the selected apps from every wave holding them */
        const touched = data.waves.filter(w => w.members.some(m => sel.has(idOf(m))));
        for (const w of touched) {
          await api(`/waves/${w.id}`, {
            method: 'PUT',
            body: {
              name: w.name, position: w.position, startDate: w.start, endDate: w.end,
              memberIds: w.members.map(idOf).filter(id => !sel.has(id)),
            },
          });
        }
        setBulkMsg(`Removed ${sel.size} application${sel.size === 1 ? '' : 's'} from wave scheduling.`);
      } else {
        const w = data.waves.find(x => x.id === waveId);
        if (!w) return;
        const memberIds = [...new Set([...w.members.map(idOf), ...sel])];
        await api(`/waves/${w.id}`, {
          method: 'PUT',
          body: { name: w.name, position: w.position, startDate: w.start, endDate: w.end, memberIds },
        });
        setBulkMsg(`Assigned ${sel.size} application${sel.size === 1 ? '' : 's'} to ${w.name}.`);
      }
      setSel(new Set());
      await reload();
    } catch (e) {
      setBulkMsg(e instanceof Error ? e.message : 'Request failed');
    }
  };
  const bulkQueue = async () => {
    setBulkMsg('');
    try {
      await api('/batch/analyses', { method: 'POST', body: { applicationIds: [...sel] } });
      setBulkMsg(`Queued analysis for ${sel.size} application${sel.size === 1 ? '' : 's'}.`);
      setSel(new Set());
      await reload();
    } catch (e) {
      setBulkMsg(e instanceof Error ? e.message : 'Request failed');
    }
  };

  const exportCsv = () => {
    const esc = (v: unknown) => JSON.stringify(String(v ?? ''));
    const head = ['Application', 'Assessment', 'Review', 'Analysis', 'Effort', 'Risk', 'Wave', 'Business service', 'Last analysis'];
    const lines = [head.join(',')].concat(rows.map(a => [
      a.name,
      a.assess ? `Completed · ${a.assess}` : 'not started',
      a.review === 'approved' ? 'approved' : a.review === 'pending' ? 'pending' : 'not started',
      (STATE_LABEL[a.state]?.text ?? a.state) + (a.state === 'running' && a.pct ? ` ${a.pct}%` : ''),
      a.pts ?? '',
      a.risk || 'unassessed',
      a.wave ? `Wave ${a.wave}` : '',
      a.bsvc,
      a.age != null ? `${a.age}d ago${a.stale ? ' (stale)' : ''}` : 'never analyzed',
    ].map(esc).join(',')));
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const el = document.createElement('a');
    el.href = url;
    el.download = 'applications.csv';
    el.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Title headingLevel="h1" size="2xl" className="page-title">Applications</Title>
      <Content component={ContentVariants.p} className="page-subtitle">
        The single store of record — {rows.length} of {apps.length} applications in scope
      </Content>

      <Tabs activeKey={tab} onSelect={(_e, k) => setTab(k as number)} aria-label="Inventory tabs" style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
        <Tab eventKey={0} title={<TabTitleText>Applications</TabTitleText>} aria-label="Applications">
          <Card style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
            <CardBody>
              <Toolbar>
                <ToolbarContent>
                  {canEdit && (
                    <ToolbarItem data-menu-root>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--rh-space-xs)' }}>
                        <input
                          className="pf-v6-c-check__input"
                          type="checkbox"
                          aria-label="Select rows on this page"
                          checked={pageRows.length > 0 && pageSel === pageRows.length}
                          ref={el => { if (el) el.indeterminate = pageSel > 0 && pageSel < pageRows.length; }}
                          onChange={e => selPage(e.target.checked)}
                        />
                        <div style={{ position: 'relative' }}>
                          <MenuToggle
                            isExpanded={openMenu === 'selopts'}
                            aria-label="Selection options"
                            onClick={() => setOpenMenu(m => m === 'selopts' ? '' : 'selopts')}
                            style={{ minHeight: 0, paddingInline: 'var(--rh-space-xs)' }}
                          >▾</MenuToggle>
                          {openMenu === 'selopts' && (
                            <div style={{ position: 'absolute', top: 'calc(100% + 2px)', left: 0, zIndex: 300 }}>
                              <Menu aria-label="Selection options">
                                <MenuContent>
                                  <MenuList>
                                    <MenuItem onClick={() => { selPage(true); setOpenMenu(''); }}>Select page</MenuItem>
                                    <MenuItem onClick={() => { setSel(new Set(rows.map(a => a.id))); setOpenMenu(''); }}>Select all matching</MenuItem>
                                    <MenuItem
                                      isDisabled={sel.size === 0}
                                      onClick={() => { setSel(new Set()); setOpenMenu(''); }}
                                    >Select none</MenuItem>
                                  </MenuList>
                                </MenuContent>
                              </Menu>
                            </div>
                          )}
                        </div>
                      </div>
                    </ToolbarItem>
                  )}
                  <ToolbarItem data-menu-root>
                    <div style={{ position: 'relative' }}>
                      <MenuToggle
                        isExpanded={openMenu === 'cat'}
                        aria-label="Filter category"
                        onClick={() => setOpenMenu(m => m === 'cat' ? '' : 'cat')}
                      >Filter: {CATS.find(c => c.cat === cat)?.label} ▾</MenuToggle>
                      {openMenu === 'cat' && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 2px)', left: 0, zIndex: 300 }}>
                          <Menu aria-label="Filter category">
                            <MenuContent>
                              {CAT_GROUPS.map(g => (
                                <MenuGroup key={g} label={g}>
                                  <MenuList>
                                    {CATS.filter(c => c.group === g).map(c => (
                                      <MenuItem
                                        key={c.cat}
                                        isSelected={cat === c.cat}
                                        onClick={() => { setCat(c.cat); setOpenMenu(''); }}
                                      >{c.label}</MenuItem>
                                    ))}
                                  </MenuList>
                                </MenuGroup>
                              ))}
                            </MenuContent>
                          </Menu>
                        </div>
                      )}
                    </div>
                  </ToolbarItem>
                  <ToolbarItem>
                    {cat === 'name' ? (
                      <SearchInput
                        placeholder="Filter by name…"
                        value={fName}
                        onChange={(_e, v) => { setFName(v); setPage(1); }}
                        onClear={() => { setFName(''); setPage(1); }}
                        aria-label="Name filter"
                      />
                    ) : cat === 'repo' ? (
                      <FormSelect
                        value={repo}
                        onChange={(_e, v) => { setRepo(v as string); setPage(1); }}
                        aria-label="Filter by repository type"
                        style={{ width: '190px' }}
                      >
                        <FormSelectOption key="all" value="" label="All" />
                        <FormSelectOption key="git" value="git" label="Git" />
                        <FormSelectOption key="subversion" value="subversion" label="Subversion" />
                      </FormSelect>
                    ) : cat === 'binary' ? (
                      <FormSelect
                        value={binary}
                        onChange={(_e, v) => { setBinary(v as string); setPage(1); }}
                        aria-label="Filter by artifact"
                        style={{ width: '190px' }}
                      >
                        <FormSelectOption key="all" value="" label="All" />
                        <FormSelectOption key="binary" value="binary" label="Associated artifact" />
                        <FormSelectOption key="none" value="none" label="No associated artifact" />
                      </FormSelect>
                    ) : (
                      <div data-menu-root style={{ position: 'relative' }}>
                        <MenuToggle
                          isExpanded={openMenu === 'val'}
                          aria-label={`Filter by ${CATS.find(c => c.cat === cat)?.label}`}
                          onClick={() => setOpenMenu(m => m === 'val' ? '' : 'val')}
                        >Filter by {CATS.find(c => c.cat === cat)?.label.toLowerCase()}… ▾</MenuToggle>
                        {openMenu === 'val' && (
                          <div style={{ position: 'absolute', top: 'calc(100% + 2px)', left: 0, zIndex: 300, maxHeight: '320px', overflow: 'auto' }}>
                            <Menu aria-label={`Filter by ${CATS.find(c => c.cat === cat)?.label}`} onSelect={(_e, itemId) => toggleSet(cat, String(itemId))}>
                              <MenuContent>
                                <MenuList>
                                  {(options[cat] || []).map(v => (
                                    <MenuItem
                                      key={v}
                                      hasCheckbox
                                      isSelected={(sets[cat] || []).includes(v)}
                                      itemId={v}
                                    >{v}</MenuItem>
                                  ))}
                                </MenuList>
                              </MenuContent>
                            </Menu>
                          </div>
                        )}
                      </div>
                    )}
                  </ToolbarItem>
                  {([
                    ['stale', 'Stale > 30d'],
                    ['nowave', '— Not scheduled'],
                    ['wave3', 'Wave: 3'],
                  ] as const).map(([k, labelText]) => (
                    <ToolbarItem key={k}>
                      {/* saved-view chip: click-to-toggle span mirroring the mock's
                          pf-v6-c-label[data-filter]; active = .on (brand outline, weight 600) */}
                      <span
                        className={`pf-v6-c-label pf-m-teal saved-chip${saved[k] ? ' on' : ''}`}
                        role="button"
                        tabIndex={0}
                        aria-pressed={saved[k]}
                        onClick={() => toggleSaved(k)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSaved(k); } }}
                      >
                        <span className="pf-v6-c-label__content"><span className="pf-v6-c-label__text">{labelText}</span></span>
                        {saved[k] && (
                          <span className="pf-v6-c-label__actions">
                            <button
                              className="pf-v6-c-button pf-m-plain"
                              type="button"
                              aria-label="Remove filter"
                              onClick={e => { e.stopPropagation(); toggleSaved(k); }}
                            >
                              <span className="pf-v6-c-button__icon">&times;</span>
                            </button>
                          </span>
                        )}
                      </span>
                    </ToolbarItem>
                  ))}
                  {chips.map(c => (
                    <ToolbarItem key={c.key}>
                      <Label color="teal" onClose={() => dropChip(c.key)}>{c.text}</Label>
                    </ToolbarItem>
                  ))}
                  {anyFilter && (
                    <ToolbarItem>
                      <Button variant="link" onClick={clearFilters}>Clear all filters</Button>
                    </ToolbarItem>
                  )}
                  <ToolbarItem align={{ default: 'alignEnd' }}>
                    <div style={{ display: 'flex', gap: 'var(--rh-space-sm)' }}>
                      {canCreate && (
                        <Button variant="primary" icon={<PlusIcon />} onClick={() => setCreateOpen(true)}>Create new</Button>
                      )}
                      <Button variant="secondary" onClick={() => { location.hash = '#scr=wizard'; }} icon={<span className="pf-v6-pficon pf-v6-pficon-import" aria-hidden="true" />}>Import</Button>
                      <Button variant="secondary" onClick={exportCsv} icon={<span className="pf-v6-pficon pf-v6-pficon-export" aria-hidden="true" />}>Export</Button>
                    </div>
                  </ToolbarItem>
                </ToolbarContent>
              </Toolbar>

              <Table aria-label="Applications inventory" variant="compact">
                <Thead>
                  <Tr>
                    {canEdit && (
                      <Th className="pf-v6-c-table__check">
                        <span className="pf-v6-screen-reader">Row select (select-all lives in the toolbar)</span>
                      </Th>
                    )}
                    <Th sort={thSort('name', 1)}>Application</Th>
                    <Th>Assessment</Th>
                    <Th>Review</Th>
                    <Th>Analysis state</Th>
                    <Th sort={thSort('pts', 5)}>Effort</Th>
                    <Th>Risk</Th>
                    <Th sort={thSort('wave', 7)}>Wave</Th>
                    <Th sort={thSort('bsvc', 8)}>Business service</Th>
                    <Th sort={thSort('age', 9)}>Last analysis</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {pageRows.map(a => {
                    const st = STATE_LABEL[a.state as string] ?? { text: String(a.state), color: 'grey' as const };
                    return (
                      <Tr key={a.id} onClick={() => setModal(a)}>
                        {canEdit && (
                          <Td className="pf-v6-c-table__check">
                            <input
                              className="pf-v6-c-check__input"
                              type="checkbox"
                              aria-label={`Select ${a.name}`}
                              checked={sel.has(a.id)}
                              onClick={e => e.stopPropagation()}
                              onChange={() => toggleRow(a.id)}
                            />
                          </Td>
                        )}
                        <Td dataLabel="Application">
                          <b>{a.name}</b>{' '}
                          <Label isCompact color="teal">{a.tag}</Label>
                        </Td>
                        <Td dataLabel="Assessment">{assessLabel(a.assess)}</Td>
                        <Td dataLabel="Review">{reviewLabel(a.review)}</Td>
                        <Td dataLabel="Analysis state">
                          <Label color={st.color} isCompact>{st.text}</Label>
                          {a.state === 'running' ? ` ${a.pct}%` : ''}
                          {(a.incidents ?? 0) > 0 && (
                            <>
                              {' · '}
                              <a
                                href={`#scr=incidents&app=${encodeURIComponent(a.name)}`}
                                onClick={e => e.stopPropagation()}
                              >{a.incidents} incidents</a>
                            </>
                          )}
                        </Td>
                        <Td dataLabel="Effort">
                          {a.pts ? (
                            <span>
                              {a.pts.toLocaleString('en-US')}
                              {a.ptsNote ? <span className="u-muted"> {a.ptsNote}</span> : null}
                              <span className="pts-bar" aria-hidden="true"><span style={{ width: `${(a.pts / maxPts) * 100}%` }} /></span>
                            </span>
                          ) : <span className="u-muted">—</span>}
                        </Td>
                        <Td dataLabel="Risk">
                          {a.risk ? <Label color={riskColor(a.risk)} isCompact>{a.risk}</Label> : <Label isCompact color="grey">—</Label>}
                          {a.riskKind === 'inherited'
                            ? <span className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)' }}> inherited ← <a href="#scr=inventory&tab=archetypes" onClick={e => { e.stopPropagation(); setTab(1); }}>{a.archetype}</a></span>
                            : a.riskKind === 'own' ? <span className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)' }}> own assessment</span> : null}
                        </Td>
                        <Td dataLabel="Wave">{a.wave ? `Wave ${a.wave}` : <span className="u-muted">—</span>}</Td>
                        <Td dataLabel="Business service">{a.bsvc}</Td>
                        <Td dataLabel="Last analysis">
                          {a.age != null
                            ? <>{a.age}d ago {a.stale ? <Label isCompact color="yellow">stale</Label> : null}</>
                            : <span className="u-muted">—</span>}
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>

              {rows.length === 0 && (
                <EmptyState titleText="No applications match" headingLevel="h4" icon={SearchIcon} style={{ padding: 'var(--rh-space-xl)' }}>
                  <EmptyStateBody>
                    Every saved view stays reproducible — share the URL, the filters ride in the hash.
                  </EmptyStateBody>
                  <EmptyStateActions>
                    <Button variant="secondary" onClick={clearFilters}>Clear all filters</Button>
                  </EmptyStateActions>
                </EmptyState>
              )}

              {/* bulk actions appear when rows are selected — real hub endpoints
                 (PUT /waves/{id}, POST /batch/analyses), RBAC-gated per persona */}
              {sel.size > 0 && (canEdit || canAnalyze) && (
                <Alert
                  isInline
                  variant="info"
                  title={`${sel.size} application${sel.size === 1 ? '' : 's'} selected`}
                  style={{ marginTop: 'var(--rh-space-md)' }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--rh-space-md)', alignItems: 'center' }}>
                    {canEdit && (
                      <div data-menu-root style={{ position: 'relative' }}>
                        <MenuToggle
                          isExpanded={openMenu === 'assign'}
                          aria-label="Assign selected applications to a wave"
                          onClick={() => setOpenMenu(m => m === 'assign' ? '' : 'assign')}
                        >Assign to wave ▾</MenuToggle>
                        {openMenu === 'assign' && (
                          <div style={{ position: 'absolute', top: 'calc(100% + 2px)', right: 0, zIndex: 300 }}>
                            <Menu aria-label="Assign to wave">
                              <MenuContent>
                                <MenuList>
                                  {data.waves.map(w => (
                                    <MenuItem key={w.id} onClick={() => { setOpenMenu(''); bulkAssign(w.id); }}>{w.name}</MenuItem>
                                  ))}
                                  <MenuItem onClick={() => { setOpenMenu(''); bulkAssign('__none__'); }}>— not scheduled —</MenuItem>
                                </MenuList>
                              </MenuContent>
                            </Menu>
                          </div>
                        )}
                      </div>
                    )}
                    {canAnalyze && (
                      <Button variant="secondary" onClick={bulkQueue} aria-label="Queue analysis for the selected applications">Queue analysis</Button>
                    )}
                    {bulkMsg && <span className="u-muted">{bulkMsg}</span>}
                  </div>
                </Alert>
              )}

              {rows.length > 0 && (
                <Pagination
                  itemCount={rows.length}
                  perPage={perPage}
                  page={page}
                  onSetPage={(_e, p) => setPage(p)}
                  onPerPageSelect={(_e, pp) => { setPerPage(pp); setPage(1); }}
                  widgetId="inv-pagination"
                  titles={{ items: 'applications' }}
                />
              )}
              <Content component={ContentVariants.small} className="u-muted" style={{ display: 'block', marginTop: 'var(--rh-space-sm)' }}>
                Server-side pagination + virtualization for thousands of rows · bulk actions in the toolbar
              </Content>
            </CardBody>
          </Card>
        </Tab>

        <Tab eventKey={1} title={<TabTitleText>Archetypes &amp; cohorts</TabTitleText>} aria-label="Archetypes and cohorts">
          <Archetypes />
        </Tab>
      </Tabs>

      {/* key resets the modal's tab state per application */}
      <AppModal key={modal?.id ?? 'none'} app={modal} onClose={() => setModal(null)} />
      <CreateAppModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async () => { setCreateOpen(false); await reload(); }}
      />
    </>
  );
}

function riskColor(r: string): 'red' | 'yellow' | 'green' {
  return r === 'High' ? 'red' : r === 'Medium' ? 'yellow' : 'green';
}
function assessLabel(v?: string) {
  return v ? <Label isCompact color="blue">Completed · {v}</Label> : <span className="u-muted">not started</span>;
}
function reviewLabel(v: string) {
  return v === 'approved' ? <Label isCompact color="green">approved</Label>
    : v === 'pending' ? <Label isCompact color="orange">pending</Label>
      : <span className="u-muted">not started</span>;
}
function teamName(id: string) {
  return TEAM_BY_ID[id]?.name ?? (id.charAt(0).toUpperCase() + id.slice(1));
}

/* ---------- Archetypes & cohorts tab (live reads: GET /archetypes +
   org applications; the management write verbs stay with the CRUD
   work package) ---------- */
function Archetypes() {
  const { data } = useHub();
  const archs = data.archetypes;
  const [cohort, setCohort] = useState('');
  const current = archs.find(a => a.name === cohort) ?? archs[0];
  const members = current ? data.apps.filter(a => a.archetype === current.name) : [];

  return (
    <>
      <Card style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
        <CardHeader>
          <CardTitle>Archetypes</CardTitle>
        </CardHeader>
        <CardBody>
          <Table aria-label="Archetypes" variant="compact">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Description</Th>
                <Th>Tags</Th>
                <Th>Membership rule</Th>
                <Th>Applications</Th>
              </Tr>
            </Thead>
            <Tbody>
              {archs.map(a => (
                <Tr key={a.id}>
                  <Td dataLabel="Name"><b>{a.name}</b></Td>
                  <Td dataLabel="Description">{a.description || <span className="u-muted">—</span>}</Td>
                  <Td dataLabel="Tags">
                    {a.tags.length
                      ? a.tags.map(t => <Label key={t} isCompact color="teal" style={{ marginRight: 'var(--rh-space-xs)' }}>{t}</Label>)
                      : <span className="u-muted">—</span>}
                  </Td>
                  <Td dataLabel="Membership rule">
                    {a.criteria.length
                      ? a.criteria.map(c => <Label key={c} isCompact color="purple" style={{ marginRight: 'var(--rh-space-xs)' }}>{c}</Label>)
                      : <span className="u-muted">—</span>}
                  </Td>
                  <Td dataLabel="Applications">{a.memberCount}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          {archs.length === 0 && (
            <Content component={ContentVariants.p} className="u-muted">
              No archetypes in scope — create them in Administration once archetype CRUD lands.
            </Content>
          )}
        </CardBody>
      </Card>
      {current && (
        <Card style={{ marginTop: 'var(--rh-space-lg)' }}>
            <CardHeader
              actions={{
                actions: <FormSelect
                  value={current.name}
                  onChange={(_e, v) => setCohort(v as string)}
                  aria-label="Cohort archetype"
                  style={{ width: '220px' }}
                >
                  {archs.map(a => <FormSelectOption key={a.id} value={a.name} label={a.name} />)}
                </FormSelect>,
                hasNoOffset: true,
              }}
            >
              <CardTitle>
              {current.name} cohort
              <Content component={ContentVariants.small} className="u-muted" style={{ display: 'block' }}>
                the dependency graph defines the cohort, not manual lists — members below derive from live applications
              </Content>
            </CardTitle>
          </CardHeader>
          <CardBody>
            <Content component={ContentVariants.p} style={{ marginBottom: 'var(--rh-space-md)' }}>
              {members.length} applications · {members.filter(a => a.assess).length} assessed ·{' '}
              {members.filter(a => a.risk === 'High').length} high risk
            </Content>
            <Table aria-label={`${current.name} cohort members`} variant="compact">
              <Thead>
                <Tr>
                  <Th>Member</Th>
                  <Th>Risk</Th>
                  <Th>Wave</Th>
                </Tr>
              </Thead>
              <Tbody>
                {members.map(a => (
                  <Tr key={a.id}>
                    <Td dataLabel="Member"><b>{a.name}</b></Td>
                    <Td dataLabel="Risk">
                      {a.risk ? <Label color={riskColor(a.risk)} isCompact>{a.risk}</Label> : <span className="u-muted">unassessed</span>}
                    </Td>
                    <Td dataLabel="Wave">{a.wave ? `Wave ${a.wave}` : <span className="u-muted">—</span>}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </CardBody>
        </Card>
      )}
    </>
  );
}

/* ---------- application create modal (real POST /applications) ---------- */
function CreateAppModal({ isOpen, onClose, onCreated }: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const { state } = useApp();
  const { data } = useHub();
  /* real team UUIDs for POST /applications — the tenancy tree carries slugs */
  const teams = useMemo(() => data.teams.filter(t => t.org === state.org), [data.teams, state.org]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [bsvcId, setBsvcId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [archId, setArchId] = useState('');
  const [tags, setTags] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(''); setDesc(''); setRepoUrl(''); setBsvcId('');
      setTeamId(teams[0]?.id ?? ''); setArchId(''); setTags(''); setErr('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const submit = async () => {
    if (!name.trim() || !bsvcId || !teamId) {
      setErr('Name, business service and team are required.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await api('/applications', {
        method: 'POST',
        body: {
          name: name.trim(),
          description: desc || undefined,
          repositoryUrl: repoUrl || undefined,
          businessServiceId: bsvcId,
          teamId,
          archetypeId: archId || undefined,
          tags: tags.split(/[\s,]+/).filter(Boolean),
        },
      });
      await onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal variant="medium" isOpen={isOpen} onClose={onClose} aria-label="Create application">
      <ModalHeader title="Create application" labelId="app-create-title" />
      <ModalBody>
        <Form>
          <FormGroup label="Name" isRequired fieldId="app-create-name">
            <TextInput id="app-create-name" value={name} onChange={(_e, v) => setName(v)} isRequired />
          </FormGroup>
          <FormGroup label="Description" fieldId="app-create-desc">
            <TextArea id="app-create-desc" value={desc} onChange={(_e, v) => setDesc(v)} />
          </FormGroup>
          <FormGroup label="Repository URL" fieldId="app-create-repo">
            <TextInput id="app-create-repo" value={repoUrl} onChange={(_e, v) => setRepoUrl(v)} placeholder="https://git.example.com/org/app" />
          </FormGroup>
          <FormGroup label="Business service" isRequired fieldId="app-create-bsvc">
            <FormSelect id="app-create-bsvc" value={bsvcId} onChange={(_e, v) => setBsvcId(v as string)} aria-label="Business service">
              <FormSelectOption key="empty" value="" label="Select a business service…" />
              {data.bsvcs.map(b => <FormSelectOption key={b.id} value={b.id} label={b.name} />)}
            </FormSelect>
          </FormGroup>
          <FormGroup label="Team" isRequired fieldId="app-create-team">
            <FormSelect id="app-create-team" value={teamId} onChange={(_e, v) => setTeamId(v as string)} aria-label="Team">
              <FormSelectOption key="empty" value="" label="Select a team…" />
              {teams.map(t => <FormSelectOption key={t.id} value={t.id} label={t.name} />)}
            </FormSelect>
          </FormGroup>
          <FormGroup label="Archetype" fieldId="app-create-arch">
            <FormSelect id="app-create-arch" value={archId} onChange={(_e, v) => setArchId(v as string)} aria-label="Archetype">
              <FormSelectOption key="empty" value="" label="None" />
              {data.archetypes.map(a => <FormSelectOption key={a.id} value={a.id} label={a.name} />)}
            </FormSelect>
          </FormGroup>
          <FormGroup label="Tags" fieldId="app-create-tags">
            <TextInput id="app-create-tags" value={tags} onChange={(_e, v) => setTags(v)} placeholder="space- or comma-separated" />
          </FormGroup>
          {err && <Content component={ContentVariants.small} style={{ color: 'var(--rh-color-red-60)' }}>{err}</Content>}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={submit} isDisabled={busy} isLoading={busy}>Create</Button>
        <Button variant="link" onClick={onClose} isDisabled={busy}>Cancel</Button>
      </ModalFooter>
    </Modal>
  );
}

/* ---------- application detail modal (port of the mock's openAppRow) ----------
   Row click opens the mock's tabbed app modal, rendered from live hub data.
   Scope decisions (recorded in MIGRATION.md):
   - tabs ride only on data the hub contract serves: Details / Tags / Review /
     Tasks / Platform / Related incidents; the mock's Reports and Dependencies
     tabs (run comparison, artifact inventory) have no live read yet.
   - write verbs (Queue analysis, Edit, Delete) stay with the CRUD work
     package — the screen footer says the same. ---------- */
const TASK_COLOR: Record<string, 'red' | 'grey' | 'blue' | 'yellow'> = {
  Failed: 'red', Queued: 'grey', Running: 'blue', Postponed: 'yellow',
};
const RISK_PROV: Record<string, string> = {
  inherited: 'inherited ← EAP8-archetype',
  own: 'own assessment',
  unassessed: 'unassessed',
};

/* same mapping the triage queue uses for incident-state labels */
function incidentLabelColor(c: string): 'green' | 'blue' | 'orange' | 'red' | 'yellow' | 'grey' | 'purple' | 'teal' {
  const map: Record<string, 'green' | 'blue' | 'orange' | 'red' | 'yellow' | 'grey' | 'purple' | 'teal'> = {
    green: 'green', blue: 'blue', orange: 'orange', red: 'red', yellow: 'yellow',
    grey: 'grey', gray: 'grey', purple: 'purple', teal: 'teal', cyan: 'teal', outline: 'grey',
  };
  return map[c] || 'grey';
}

function AppModal({ app, onClose }: { app: Row | null; onClose: () => void }) {
  const { data } = useHub();          // unconditional: the body branches below
  const [tab, setTab] = useState(0);
  if (!app) return null;

  const incidents = data.incidents[app.name] as { total: number; pts: string; rows: IncRow[] } | undefined;
  const tasks = data.tasks.filter(t => t.app === app.name);
  const riskProv = RISK_PROV[app.riskKind];
  const maxPts = Math.max(...data.apps.map(x => x.pts || 0), 1);   // same scale as the table's effort bars

  return (
    <Modal variant="large" isOpen onClose={onClose} aria-label="Application detail">
      <ModalHeader
        title={<>
          {app.name}
          <Content component={ContentVariants.small} className="u-muted" style={{ display: 'block' }}>
            {app.bsvc} · {app.wave ? `Wave ${app.wave}` : 'no wave assigned'}
          </Content>
        </>}
        labelId="app-modal-title"
      />
      <ModalBody>
        {/* summary strip (the mock's secondary-background strip): Effort · Risk · Analysis · Last analysis */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 'var(--rh-space-lg) var(--rh-space-2xl)', alignItems: 'center',
          padding: 'var(--rh-space-md) var(--rh-space-lg)', margin: '0 0 var(--rh-space-lg)',
          background: 'var(--pf-t--global--background--color--secondary--default)',
          borderRadius: 'var(--pf-t--global--border--radius--medium)',
        }}>
          <div>
            <div className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)' }}>Effort</div>
            <div style={{ fontSize: 'var(--rh-font-size-body-text-lg)', fontWeight: 600 }}>
              {app.pts ? <span>{app.pts} pts<span className="pts-bar" aria-hidden="true"><span style={{ width: `${(app.pts / maxPts) * 100}%` }} /></span></span> : <span className="u-muted">—</span>}
            </div>
          </div>
          <div>
            <div className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)' }}>Risk{riskProv ? ` (${riskProv})` : ''}</div>
            <div>{app.risk ? <Label color={riskColor(app.risk)}>{app.risk}</Label> : <span className="u-muted">unassessed</span>}</div>
          </div>
          <div>
            <div className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)' }}>Analysis</div>
            <div><Label color={STATE_LABEL[app.state]?.color ?? 'grey'}>{STATE_LABEL[app.state]?.text ?? app.state}</Label>{app.state === 'running' && app.pct ? ` ${app.pct}%` : ''}</div>
          </div>
          <div>
            <div className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)' }}>Last analysis</div>
            <div>
              {app.age != null ? <>{app.age}d ago {app.stale ? <Badge isRead>stale</Badge> : null}</> : <span className="u-muted">never analyzed</span>}
            </div>
          </div>
        </div>

        <Tabs activeKey={tab} onSelect={(_e, k) => setTab(k as number)} aria-label="Application detail">
          <Tab eventKey={0} title={<TabTitleText>Details</TabTitleText>} aria-label="Details">
            <DescriptionList style={{ marginTop: 'var(--rh-space-lg)' }}>
              <DescriptionListGroup>
                <DescriptionListTerm>Wave</DescriptionListTerm>
                <DescriptionListDescription>{app.wave ? `Wave ${app.wave}` : <span className="u-muted">—</span>}</DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Business service</DescriptionListTerm>
                <DescriptionListDescription>{app.bsvc}</DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Team</DescriptionListTerm>
                <DescriptionListDescription>{teamName(app.team)}</DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Archetype</DescriptionListTerm>
                <DescriptionListDescription>{app.archetype || <span className="u-muted">—</span>}</DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Credentials</DescriptionListTerm>
                <DescriptionListDescription>
                  {app.creds || '—'}{app.credName ? <> · <b>{app.credName}</b> <span className="u-muted">(team-owned — Credentials view)</span></> : null}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Repository</DescriptionListTerm>
                <DescriptionListDescription>{app.repo || '—'}{app.binary === 'binary' ? ' · binary artifact' : ''}</DescriptionListDescription>
              </DescriptionListGroup>
            </DescriptionList>
          </Tab>

          <Tab eventKey={1} title={<TabTitleText>Tags</TabTitleText>} aria-label="Tags">
            <div style={{ marginTop: 'var(--rh-space-lg)' }}>
              {(app.tags || '').split(' ').filter(Boolean).map(t => (
                <Label key={t} color="teal" style={{ marginRight: 'var(--rh-space-md)' }}>{t}</Label>
              ))}
              {!(app.tags || '').trim() && <span className="u-muted">No tags — add them when application CRUD lands.</span>}
            </div>
          </Tab>

          <Tab eventKey={2} title={<TabTitleText>Review</TabTitleText>} aria-label="Review">
            <DescriptionList style={{ marginTop: 'var(--rh-space-lg)' }}>
              <DescriptionListGroup>
                <DescriptionListTerm>Assessment</DescriptionListTerm>
                <DescriptionListDescription>{assessLabel(app.assess)}</DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Review</DescriptionListTerm>
                <DescriptionListDescription>{reviewLabel(app.review)}</DescriptionListDescription>
              </DescriptionListGroup>
            </DescriptionList>
            <Content component={ContentVariants.small} className="u-muted">
              Review sign-off and assessment editing are role-gated verbs — they arrive with the CRUD work package.
            </Content>
          </Tab>

          <Tab eventKey={3} title={<TabTitleText>Tasks</TabTitleText>} aria-label="Tasks">
            <div style={{ marginTop: 'var(--rh-space-lg)' }}>
              {tasks.length ? (
                <Table aria-label={`Tasks for ${app.name}`} variant="compact">
                  <Thead>
                    <Tr><Th>ID</Th><Th>State</Th><Th>Kind</Th><Th>Age</Th></Tr>
                  </Thead>
                  <Tbody>
                    {tasks.map(t => (
                      <Tr key={t.id}>
                        <Td dataLabel="ID">{t.id}</Td>
                        <Td dataLabel="State"><Label color={TASK_COLOR[t.state] ?? 'grey'} isCompact>{t.state}</Label></Td>
                        <Td dataLabel="Kind">{t.kind}</Td>
                        <Td dataLabel="Age">{t.age}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              ) : (
                <Content component={ContentVariants.p} className="u-muted">
                  No tasks for this application — the <a href="#scr=tasks">Task manager</a> holds the full queue.
                </Content>
              )}
            </div>
          </Tab>

          <Tab eventKey={4} title={<TabTitleText>Platform</TabTitleText>} aria-label="Platform">
            <DescriptionList style={{ marginTop: 'var(--rh-space-lg)' }}>
              <DescriptionListGroup>
                <DescriptionListTerm>Source platform</DescriptionListTerm>
                <DescriptionListDescription>
                  {app.platform || <span className="u-muted">not set — manage platforms in Administration → Registries</span>}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Credentials</DescriptionListTerm>
                <DescriptionListDescription>{app.creds || '—'}</DescriptionListDescription>
              </DescriptionListGroup>
            </DescriptionList>
          </Tab>

          <Tab eventKey={5} title={<TabTitleText>Related incidents</TabTitleText>} aria-label="Related incidents">
            <div style={{ marginTop: 'var(--rh-space-lg)' }}>
              {incidents && incidents.rows.length ? (
                <>
                  <Content component={ContentVariants.p} style={{ marginBottom: 'var(--rh-space-md)' }}>
                    {incidents.total} incidents · {incidents.pts} pts in the triage queue
                  </Content>
                  <Table aria-label={`Incidents for ${app.name}`} variant="compact">
                    <Thead>
                      <Tr><Th>Incident</Th><Th>State</Th><Th>Effort</Th></Tr>
                    </Thead>
                    <Tbody>
                      {incidents.rows.map((r, i) => (
                        <Tr key={r[6] ?? `${app.name}-${i}`}>
                          <Td dataLabel="Incident">{r[0]}</Td>
                          <Td dataLabel="State"><Label color={incidentLabelColor(r[3])} isCompact>{r[2]}</Label></Td>
                          <Td dataLabel="Effort">{r[1] || <span className="u-muted">—</span>}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </>
              ) : (
                <Content component={ContentVariants.p} className="u-muted">
                  {app.state === 'notstarted'
                    ? 'No incidents yet — this application has not been analyzed. Queue an analysis to collect findings.'
                    : 'No open incidents in the triage queue for this application.'}
                </Content>
              )}
              <Content component={ContentVariants.p} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
                Full queue with writable triage states: <a href="#scr=incidents">open the triage queue →</a>
              </Content>
            </div>
          </Tab>
        </Tabs>
      </ModalBody>
    </Modal>
  );
}
