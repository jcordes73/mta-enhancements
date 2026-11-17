import { Card, CardBody, CardFooter, CardHeader, CardTitle, Grid, GridItem, Title, Label, Content, ContentVariants, List, ListItem } from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { useApp, useScoped, type Persona } from '../state/appState';
import { useHub } from '../api/hub';
import { PM_WAVE_WINDOWS } from '../data/generated';
import { Trans } from 'react-i18next';
import { useT } from '../i18n';
import { fmtDate } from '../i18n/i18n';
import type { AppRow, CredRow, EvidenceRow, TicketRow, TrendRow } from '../api/hub';

/* Persona landing — aligned with the mock's lp-* landings:
   a red persona-blurb banner ("that role's first question") for everyone,
   and the architect's landing is a full port of the mock's lp-architect
   (store-derived KPIs, the per-service hurts table, the run-trend bars).
   Every number derives live from the hub data (apps/creds/evidence/
   tickets/waves/trend) — no narrative constants. */

/* The mock's persona questions (design #36: one landing per persona) — the banner
   renders full-sentence keys (BANNER_KEY below; i18n-additions.json carries the
   per-locale renderings with the declined persona forms; EN falls back to the
   key itself, byte-exact). */
const BANNER_KEY: Record<Persona, string> = {
  architect: `Architect's first question: \u201cWhere is the portfolio hurting?\u201d`,
  pm: `Project mgr's first question: \u201cAre the waves on track?\u201d`,
  pgm: `Program mgr's first question: \u201cAre the teams' waves coordinated?\u201d`,
  migrator: `Migrator's first question: \u201cWhat is assigned to me?\u201d`,
  admin: `Admin's first question: \u201cIs my organization's migration on track?\u201d`,
  padmin: `Platform admin's first question: \u201cWhich organizations need attention?\u201d`,
};

const RISK_RANK: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
const RISK_COLOR: Record<string, string> = {
  High: 'var(--pf-t--global--color--status--danger--default)',
  Medium: 'var(--pf-t--global--color--status--warning--default)',
  Low: 'var(--pf-t--global--color--status--success--default)',
};

/* Port of the mock's waveGateFacts (the Waves screen's own gate rule):
   open tickets, red verification suites, quota-blocked apps, or
   expiring/unverified credentials in use ⇒ the wave's gate is failing. */
function gateFacts(position: number, apps: AppRow[], creds: CredRow[], evidence: Record<string, EvidenceRow>, tickets: Record<string, TicketRow>) {
  const members = apps.filter(a => String(a.wave) === String(position));
  const openTk = members.filter(a => { const t = tickets[a.name]; return t && t.outcome !== 'closed'; }).length;
  const quota = members.filter(a => a.state === 'quota').length;
  let suites = 0, red = 0;
  members.forEach(a => { const e = evidence[a.name]; if (e && e.total) { suites += e.total; red += e.red || 0; } });
  const credUse: Record<string, string[]> = {};
  members.forEach(a => { if (a.credName) (credUse[a.credName] ??= []).push(a.name); });
  const expiring = creds.filter(c => c.expLabel === 'expiring' && credUse[c.name]).length;
  const unverUsed = creds.filter(c => c.verifiedLabel === 'unverified' && credUse[c.name]).length;
  return { members: members.length, red, quota, failing: openTk > 0 || red > 0 || quota > 0 || expiring > 0 || unverUsed > 0 };
}

export function Home() {
  const { state } = useApp();
  const { apps, path } = useScoped();
  const { data } = useHub();
  const t = useT();

  return (
    <>
     {/* header + architect landing are migrated to key-based i18n (data-i18n-live
         fences the legacy DOM walker off this subtree); GenericLanding below is not */}
     <div data-i18n-live>
      <Title headingLevel="h1" size="2xl" className="page-title">{t('Home')}</Title>
      <Content component={ContentVariants.p} className="page-subtitle">
        {t("One landing per persona — it answers that role's first question")}
      </Content>
      <Content component={ContentVariants.small} className="u-muted">
        {t('Data scope: {{scope}} — organizations are isolated', { scope: path })}
      </Content>
      <div className="persona-blurb" style={{ marginBlockStart: 'var(--pf-t--global--spacer--sm)' }}>
        <b>{t(BANNER_KEY[state.persona])}</b>
      </div>
     </div>

      {state.persona === 'architect'
        ? <ArchitectLanding apps={apps as AppRow[]} creds={data.creds} evidence={data.evidence} tickets={data.tickets} waves={data.waves} trend={data.trend} />
        : <GenericLanding apps={apps as AppRow[]} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Architect landing — full port of the mock's lp-architect: four store-derived KPI cards, the per-service hurts table,
   and the run-trend bars.                                              */
/* ------------------------------------------------------------------ */
function ArchitectLanding({ apps, creds, evidence, tickets, waves, trend }: {
  apps: AppRow[]; creds: CredRow[]; evidence: Record<string, EvidenceRow>;
  tickets: Record<string, TicketRow>; waves: Array<{ position: number }>; trend: TrendRow[];
}) {
  const t = useT();
  const total = apps.length;
  /* Effort rollup */
  const pts = apps.reduce((n, a) => n + (a.pts || 0), 0);
  /* Combined risk: the worst assessment present is the headline */
  const riskCount: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
  apps.forEach(a => { if (RISK_RANK[a.risk as string]) riskCount[a.risk as string]++; });
  const unassessed = apps.filter(a => !RISK_RANK[a.risk as string]).length;
  const worst = (['High', 'Medium', 'Low'] as const).find(r => riskCount[r] > 0);
  const riskMeta = (['High', 'Medium', 'Low'] as const).filter(r => riskCount[r])
    .map(r => t(r === 'High' ? '{{n}} high' : r === 'Medium' ? '{{n}} medium' : '{{n}} low', { n: riskCount[r] })).join(' · ')
    + (unassessed ? ` · ${t('{{n}} unassessed', { n: unassessed })}` : '') + ' · ' + t('provenance shown');
  /* Analysis coverage: donut arcs per analysis state */
  const current = apps.filter(a => a.state === 'succeeded' && !a.stale).length;
  const stale = apps.filter(a => a.stale).length;
  const flight = apps.filter(a => ['running', 'quota', 'queued'].includes(a.state)).length;
  const failed = apps.filter(a => a.state === 'failed').length;
  const notstarted = apps.filter(a => a.state === 'notstarted').length;
  const share = total ? Math.round(current / total * 100) : 0;
  /* Waves on track: the Waves screen's gate rule over active waves */
  const active = waves.filter(wv => apps.some(a => String(a.wave) === String(wv.position)));
  const failing = active.filter(wv => gateFacts(wv.position, apps, creds, evidence, tickets).failing);

  /* Where the portfolio hurts: per-business-service rollup, worst effort
     first — zero-effort services stay visible (no analysis = no estimate IS
     the hurt). Row click opens Applications pre-filtered to the service. */
  const byBsvc = Object.entries(apps.reduce<Record<string, { n: number; pts: number; worst: string | null; cur: number }>>((acc, a) => {
    const k = a.bsvc || '—';
    const b = acc[k] ?? (acc[k] = { n: 0, pts: 0, worst: null, cur: 0 });
    b.n++; b.pts += a.pts || 0;
    if (RISK_RANK[a.risk as string] && (!b.worst || RISK_RANK[a.risk as string] > RISK_RANK[b.worst])) b.worst = a.risk as string;
    if (a.state === 'succeeded' && !a.stale) b.cur++;
    return acc;
  }, {})).sort((x, y) => y[1].pts - x[1].pts);

  /* Trends: open incidents per analysis run, last five runs — the
     −% delta computes; the latest bar is green (improving) */
  const runs = trend.slice(-5);
  const maxOpen = Math.max(...runs.map(r => r.open), 1);
  const firstRun = runs[0];
  const lastRun = runs[runs.length - 1];
  const delta = firstRun && firstRun.open ? Math.round((lastRun.open - firstRun.open) / firstRun.open * 100) : 0;

  const donutC = 2 * Math.PI * 15.5;
  const donutSegs = [
    { n: current, color: 'var(--pf-t--global--color--status--success--default)', label: 'current' },
    { n: stale, color: 'var(--pf-t--global--color--status--warning--default)', label: 'stale' },
    { n: flight, color: 'var(--pf-t--global--color--status--custom--default)', label: 'in flight' },
    { n: failed, color: 'var(--pf-t--global--color--status--danger--default)', label: 'failed' },
    { n: notstarted, color: 'var(--pf-t--global--color--border--default)', label: 'not started' },
  ].filter(sg => sg.n > 0);
  let donutOff = 0;
  const donutArcs = donutSegs.map(sg => {
    const len = sg.n / total * donutC;
    const dash = Math.max(len - 0.7, 1);
    const seg = (
      <circle key={sg.label} cx="22" cy="22" r="15.5" fill="none" stroke={sg.color} strokeWidth="6"
        strokeDasharray={`${dash} ${donutC - dash}`} strokeDashoffset={-donutOff}
        transform="rotate(-90 22 22)"><title>{sg.n} {sg.label}</title></circle>
    );
    donutOff += len;
    return seg;
  });

  return (
    <Grid hasGutter data-i18n-live style={{ marginBlockStart: 'var(--pf-t--global--spacer--lg)' }}>
      <GridItem span={3}>
        <Card isCompact isFullHeight>
          <CardHeader><CardTitle>{t('Effort rollup')}</CardTitle></CardHeader>
          <CardBody>
            <div className="kpi">{pts.toLocaleString('en-US')}<small>{t('story points · {{n}} apps', { count: total, n: total })}</small></div>
          </CardBody>
          <CardFooter><a href="#scr=inventory">{t('View applications →')}</a></CardFooter>
        </Card>
      </GridItem>
      <GridItem span={3}>
        <Card isCompact isFullHeight>
          <CardHeader><CardTitle>{t('Combined risk')}</CardTitle></CardHeader>
          <CardBody>
            <div className="kpi" style={worst ? { color: RISK_COLOR[worst] } : undefined}>
              {worst ? t(worst) : '—'}<small>{riskMeta}</small>
            </div>
            {/* magnitude as shape: segment widths by count, min 4% */}
            <div className="stackBar" role="img" aria-label="Risk distribution across applications">
              {([['High', riskCount.High], ['Medium', riskCount.Medium], ['Low', riskCount.Low], ['unassessed', unassessed]] as const)
                .filter(([, n]) => n > 0)
                .map(([name, n]) => (
                  <b key={name} title={`${name}: ${n} of ${total} applications`} style={{
                    width: `${Math.max(4, Math.round(n / total * 100))}%`,
                    background: name === 'unassessed' ? 'var(--pf-t--global--color--status--info--default)' : RISK_COLOR[name],
                  }} />
                ))}
            </div>
          </CardBody>
          <CardFooter><a href="#scr=inventory">{t('View applications →')}</a></CardFooter>
        </Card>
      </GridItem>
      <GridItem span={3}>
        <Card isCompact isFullHeight>
          <CardHeader><CardTitle>{t('Analysis coverage')}</CardTitle></CardHeader>
          <CardBody>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--rh-space-md)' }}>
              <svg width="44" height="44" viewBox="0 0 44 44" role="img" aria-label={`Analysis coverage ${share}% of ${total} applications — ${donutSegs.map(sg => `${sg.n} ${sg.label}`).join(', ')}`} style={{ flex: 'none' }}>
                <circle cx="22" cy="22" r="15.5" fill="none" style={{ stroke: 'var(--pf-t--global--border--color--default)' }} strokeWidth="6" />
                {donutArcs}
              </svg>
              <div className="kpi">{share}%<small>{t('stale: {{n}}', { n: stale })}{flight ? ` · ${t('{{n}} in flight', { n: flight })}` : ''}</small></div>
            </div>
          </CardBody>
          <CardFooter><a href="#scr=inventory">{t('View applications →')}</a></CardFooter>
        </Card>
      </GridItem>
      <GridItem span={3}>
        <Card isCompact isFullHeight>
          <CardHeader><CardTitle>{t('Waves on track')}</CardTitle></CardHeader>
          <CardBody>
            <div className="kpi" style={{ color: 'var(--pf-t--global--color--status--warning--default)' }}>
              {t('{{n}} at risk', { n: failing.length })}<small>{t('of {{m}} active waves have failing gates', { count: active.length, m: active.length })}</small>
            </div>
            <div style={{ display: 'flex', gap: 'var(--rh-space-xs)', marginBlockStart: 'var(--rh-space-md)', flexWrap: 'wrap' }}>
              {active.map(wv => {
                const f = gateFacts(wv.position, apps, creds, evidence, tickets);
                return (
                  <a key={wv.position} href="#scr=waves" style={{ textDecoration: 'none' }}
                    title={`Wave ${wv.position} gate ${f.failing ? 'failing' : 'passing'} (${f.members} application${f.members === 1 ? '' : 's'})`}>
                    <Label color={f.failing ? 'red' : 'green'}>W{wv.position} {t(f.failing ? 'failing' : 'passing')}</Label>
                  </a>
                );
              })}
              {!active.length && <span className="u-muted">{t('no waves planned in this scope')}</span>}
            </div>
          </CardBody>
          <CardFooter><a href="#scr=waves">{t('Open Migration waves →')}</a></CardFooter>
        </Card>
      </GridItem>

      <GridItem span={6}>
        <Card isFullHeight>
          <CardHeader><CardTitle>{t('Where the portfolio hurts')}</CardTitle></CardHeader>
          <CardBody>
            <Table aria-label="Effort rollup per business service" variant="compact">
              <Thead>
                <Tr><Th>{t('Domain')}</Th><Th>{t('Effort')}</Th><Th>{t('Risk')}</Th><Th>{t('Coverage')}</Th></Tr>
              </Thead>
              <Tbody>
                {byBsvc.map(([name, b]) => (
                  <Tr key={name} isClickable
                    onClick={() => { location.hash = '#scr=inventory&bsvc=' + encodeURIComponent(name); }}>
                    <Td dataLabel="Domain">{name} {t('({{n}} apps)', { count: b.n, n: b.n })}</Td>
                    <Td dataLabel="Effort">{t('{{n}} pts', { count: b.pts, n: b.pts.toLocaleString('en-US') })}</Td>
                    <Td dataLabel="Risk">
                      {b.worst
                        ? <Label color={b.worst === 'High' ? 'red' : b.worst === 'Medium' ? 'yellow' : 'green'}>{t(b.worst)}</Label>
                        : <span className="u-muted">&mdash;</span>}
                    </Td>
                    <Td dataLabel="Coverage">{Math.round(b.cur / b.n * 100)}%</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </CardBody>
        </Card>
      </GridItem>
      <GridItem span={6}>
        <Card isFullHeight>
          <CardHeader><CardTitle>{t('Trends')}</CardTitle></CardHeader>
          <CardBody>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--rh-space-md)', height: 90, padding: 'var(--rh-space-xs) var(--rh-space-xs) 0' }}>
              {runs.map((r, i) => {
                const last = i === runs.length - 1;
                return (
                  <div key={r.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--rh-space-xs)' }}>
                    {last
                      ? <span style={{ fontSize: 'var(--rh-font-size-body-text-xs)', color: 'var(--pf-t--global--color--status--success--default)' }}><b>{r.open}</b></span>
                      : <span className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)' }}>{r.open}</span>}
                    <div style={{
                      width: '100%',
                      background: last ? 'var(--pf-t--global--color--status--success--default)' : 'var(--pf-t--global--color--status--custom--default)',
                      height: Math.max(4, Math.round(r.open / maxOpen * 52)),
                    }} />
                  </div>
                );
              })}
            </div>
            <div className="u-muted" style={{ display: 'flex', gap: 'var(--rh-space-md)', padding: 'var(--rh-space-xs) var(--rh-space-xs) 0', fontSize: 'var(--rh-font-size-body-text-xs)' }}>
              {runs.map(r => <div key={r.date} style={{ flex: 1, textAlign: 'center' }}>{fmtDate(r.date)}</div>)}
            </div>
            <div className="u-muted" style={{ marginBlockStart: 'var(--rh-space-md)' }}>
              {t('Open incidents per analysis run, last {{n}} runs —', { n: runs.length })}{' '}
              {/* <b> markers travel inside the translations (i18n-additions.json); ja/tr
                  reorder the words around the bold figures — hence Trans, not string concat.
                  EN falls back to `defaults` (bold preserved, byte-exact). */}
              <Trans
                i18nKey="{{open}} on {{date}}, {{delta}} since {{since}}"
                defaults="<b>{{open}}</b> on {{date}}, <b>{{delta}}</b> since {{since}}"
                values={{ open: lastRun?.open, date: lastRun ? fmtDate(lastRun.date) : '', delta: `${delta > 0 ? '+' : ''}${delta}%`, since: firstRun ? fmtDate(firstRun.date) : '' }}
                components={{ b: <b /> }}
              />
              <br />
              {t('Verification pass rate')} <b>{lastRun?.pass}%</b> {t('(latest run)')}
            </div>
          </CardBody>
          <CardFooter><a href="#scr=reports">{t('Open Reports →')}</a></CardFooter>
        </Card>
      </GridItem>
    </Grid>
  );
}

/* ------------------------------------------------------------------ */
/* Other personas keep their landing cards (pm/pgm/migrator/admin/padmin
   parity with the mock is tracked separately in MIGRATION.md).         */
/* ------------------------------------------------------------------ */
function GenericLanding({ apps }: { apps: AppRow[] }) {
  const totalPts = apps.reduce((n, a) => n + ((a.pts as number) || 0), 0);
  const inFlight = apps.filter(a => a.state === 'running');
  const riskHigh = apps.filter(a => a.risk === 'High').length;
  const riskMed = apps.filter(a => a.risk === 'Medium').length;
  const riskLow = apps.filter(a => a.risk === 'Low').length;
  const unassessed = apps.filter(a => a.riskKind === 'unassessed').length;
  const analyzed = apps.filter(a => ['succeeded', 'running', 'quota'].includes(a.state as string)).length;
  const stale = apps.filter(a => a.stale).length;
  const quota = apps.filter(a => a.state === 'quota');
  const waved = apps.filter(a => a.wave).length;

  const byBsvc = Object.entries(
    apps.reduce<Record<string, number>>((acc, a) => {
      acc[a.bsvc as string] = (acc[a.bsvc as string] || 0) + ((a.pts as number) || 0);
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <Grid hasGutter style={{ marginTop: 'var(--pf-t--global--spacer--lg)' }}>
      <GridItem span={3}>
        <Card isCompact isFullHeight>
          <CardHeader><CardTitle>Effort rollup</CardTitle></CardHeader>
          <CardBody>
            <div className="kpi">{totalPts.toLocaleString()} <span className="u-muted">pts</span></div>
            <Content component={ContentVariants.small} className="u-muted">
              {inFlight.length} in-flight — provisional totals
            </Content>
          </CardBody>
        </Card>
      </GridItem>
      <GridItem span={3}>
        <Card isCompact isFullHeight>
          <CardHeader><CardTitle>Combined risk</CardTitle></CardHeader>
          <CardBody>
            <div className="kpi">
              <Label color="red">{riskHigh} high</Label>{' '}
              <Label color="yellow">{riskMed} med</Label>{' '}
              <Label color="green">{riskLow} low</Label>
            </div>
            <Content component={ContentVariants.small} className="u-muted">
              {unassessed} unassessed — provenance per #32
            </Content>
          </CardBody>
        </Card>
      </GridItem>
      <GridItem span={3}>
        <Card isCompact isFullHeight>
          <CardHeader><CardTitle>Analysis coverage</CardTitle></CardHeader>
          <CardBody>
            <div className="kpi">{analyzed} / {apps.length}</div>
            <Content component={ContentVariants.small} className="u-muted">
              {stale} stale results
            </Content>
          </CardBody>
        </Card>
      </GridItem>
      <GridItem span={3}>
        <Card isCompact isFullHeight>
          <CardHeader><CardTitle>Wave-assigned</CardTitle></CardHeader>
          <CardBody>
            <div className="kpi">{waved} / {apps.length}</div>
            <Content component={ContentVariants.small} className="u-muted">
              waves 1–4 · {quota.length} quota-blocked
            </Content>
          </CardBody>
        </Card>
      </GridItem>

      <GridItem span={6}>
        <Card isFullHeight>
          <CardHeader><CardTitle>Where the portfolio hurts</CardTitle></CardHeader>
          <CardBody>
            <List isPlain>
              {byBsvc.map(([bsvc, pts]) => (
                <ListItem key={bsvc}>
                  <b>{bsvc}</b> — {pts.toLocaleString()} pts
                </ListItem>
              ))}
            </List>
          </CardBody>
        </Card>
      </GridItem>
      <GridItem span={6}>
        <Card isFullHeight>
          <CardHeader><CardTitle>Waves</CardTitle></CardHeader>
          <CardBody>
            <List isPlain>
              {Object.entries(PM_WAVE_WINDOWS).map(([w, win]) => (
                <ListItem key={w}>
                  <b>Wave {w}</b> — {win}
                </ListItem>
              ))}
            </List>
          </CardBody>
        </Card>
      </GridItem>
    </Grid>
  );
}
