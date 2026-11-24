/* Defect rows 145–151 — Review.md [CHANGE] batch (2026-11-18):
   145: Applications table — Tags, Progress, and Incidents become first-class columns
        (13 columns); the analysis-state cell carries the state only; unassessed risk renders
        an "Unassessed" label instead of the bare dash; Incidents is sortable (data-incidents);
        positional readers (openAppRow, invRowRisk/invRowBsvc, waveMemberData, wave rollup)
        re-pointed; the pick-one static tbody rows are gone (renderInventory fills at boot).
   146: Home — analysis-coverage donut enlarged to 64px with a per-status legend (labels +
        counts); the meta line carried the assessed / not-yet-assessed split (later removed,
        row 173); the Combined-risk
        card footer deep-links to Reports → Combined risks instead of Applications.
   147: Incidents drawer — comment composer inside the triage-state card (#33 item 1):
        attributed via PERSONA_LOGIN, appends to the history, clears the input, gated by
        incidents:triage.
   148: External ticket keys are links (MIG-412/418/425) — rendered from WAVE_TICKETS with a
        tracker title, stopPropagation-guarded against the row's openDrawer.
   149: Combined risks — "Distribution" column renamed "Relative share" (explained in an
        annotation); mitigations render as a table (two for State mgmt, one for Cloud).
   150: Archetypes & cohorts — Actions edit/delete icons tightened (mock-layer gap + padding).
   151: Inventory effort header relabeled "Effort (pts)" — disambiguates from the Incidents
        column (reviewer question; i18n keys added in 9 locales, plus Incidents/fr,
        Relative share/Comment/Add a triage comment in 9 locales). */
const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://mock.test/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
let pass = 0, fail = 0;
const OK = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); c ? pass++ : fail++; };
setTimeout(() => {
  const d = dom.window.document, w = dom.window;

  // ---- row 145: inventory column set ----
  const heads = [...d.querySelectorAll('#invHead th')].map(th => th.textContent.trim());
  OK('13 columns with Tags / Progress / Incidents first-class',
    heads.length === 13
    && heads[11] === 'Tags' && heads[5] === 'Progress #33' && heads[7] === 'Incidents' && heads[2] === 'Risk #32' && heads[3] === 'Wave'
    && d.querySelector('#invHead [data-sort="incidents"]'));
  const row = n => [...d.querySelectorAll('#invBody tr')].find(tr => tr.dataset.name === n);
  OK('tags moved out of the name cell into their own column (multi-tag app)',
    row('claims-web').cells[1].textContent.trim() === 'claims-web'
    && [...row('claims-web').cells[11].querySelectorAll('.pf-v6-c-label__text')].map(l => l.textContent).join(',') === 'ant,needs-review');
  OK('running app shows Progress % in its own column; not-started shows a dash',
    row('invoicing').cells[5].textContent.includes('61%') && row('billing-worker').cells[5].textContent.trim() === '\u2014');
  OK('succeeded app shows the Progress bar full in grey (row 185)',
    row('payments-api').cells[5].textContent.includes('100%')
    && !!row('payments-api').cells[5].querySelector('.miniBarDone i')
    && row('payments-api').cells[5].querySelector('.miniBarDone i').style.width === '100%');
  OK('incidents count is its own column with the deep link (effort stays separate)',
    row('claims-batch').cells[7].textContent.includes('88 incidents')
    && !!row('claims-batch').cells[7].querySelector('a[onclick*="showIncidentsForApp"]')
    && row('claims-batch').cells[8].textContent.includes('412'));
  OK('unassessed risk renders an Unassessed label instead of the bare dash',
    row('invoicing').cells[2].textContent.trim() === 'Unassessed'
    && row('billing-worker').cells[2].textContent.trim() === 'Unassessed');
  w.eval("invSort(document.querySelector('#invHead [data-sort=\"incidents\"]'), 'incidents')");
  const incPairs = [...d.querySelectorAll('#invBody tr')].map(tr => tr.dataset.incidents || '');
  const nonEmpty = incPairs.filter(v => v !== '').map(Number);
  OK('incidents column sorts numerically ascending (missing last)', 
    nonEmpty.every((v, i) => i === 0 || nonEmpty[i - 1] <= v)
    && incPairs.slice(nonEmpty.length).every(v => v === '')
    && d.querySelector('#invHead [data-sort="incidents"]').getAttribute('aria-sort') === 'ascending');
  // drill-down still resolves after the index shift
  row('claims-batch').click();
  const modal = d.getElementById('modalAppBody');
  OK('row drill-down: risk, wave, bsvc, effort resolve from the new positions',
    modal.textContent.includes('claims-batch') && modal.textContent.includes('Medium')
    && modal.textContent.includes('Wave 3') && modal.textContent.includes('Claims')
    && modal.textContent.includes('412'));
  OK('drill-down risk provenance comes from data-riskkind (inherited)',
    modal.textContent.includes('inherited'));
  w.eval('closeModals()');
  OK('risk filter menu still derives from the risk cell (invRowRisk)',
    w.eval('invRowRisk(document.querySelector("#invBody tr[data-name=\'payments-api\']"))') === 'high');

  // ---- row 146: home coverage card ----
  const bars = d.getElementById('homeCoverageBars');
  OK('coverage renders as a labeled bar chart with count + percentage share (rows 155/178)',
    !!bars && [...bars.querySelectorAll(':scope > a > div')].length === 5
    && [...bars.querySelectorAll(':scope > a > span')].every(s => /^\d+ \u00b7 \d+(\.\d+)?%$/.test(s.textContent.trim()))
    && bars.getAttribute('role') === null
    && [...bars.querySelectorAll(':scope > a')].every(a => a.getAttribute('onclick').startsWith("showAppsForCoverage('")));
  const legend = [...d.querySelectorAll('#homeCoverageBarLabels > div')].map(x => x.textContent.trim());
  OK('bar labels carry every analysis state', legend.length === 5
    && legend.some(t => /up to date/.test(t)) && legend.some(t => /not started/.test(t)));
  OK('meta line removed — assessment split lives on Combined risk only (row 173)',
    d.getElementById('homeCoverageMeta') === null
    && !/assessed/.test(d.getElementById('homeCoveragePct').closest('.kpi').textContent));
  const covCnt = d.getElementById('homeCoverageCount');
  OK('coverage KPI carries the fraction with its unit: "2 of 12 apps" (rows 171/174)',
    covCnt !== null && covCnt.textContent.trim() === '2 of 12 apps');
  const effTop = [...d.querySelectorAll('#lpArchEffortTop > a')];
  OK('effort rollup: top-3 apps by effort, ranked with pts labels (row 176)',
    effTop.length === 3
    && effTop[0].textContent.replace(/\s+/g, ' ').trim() === 'payments-api1,180 pts'
    && effTop[0].textContent.includes('1,180 pts')
    && effTop[1].textContent.includes('890 pts') && effTop[2].textContent.includes('610 pts')
    && effTop.every(a => a.getAttribute('onclick').startsWith("openApp('"))
    && effTop.every(a => a.querySelector('span[style*="height"]') !== null));
  OK('Combined-risk card footer deep-links to Reports \u2192 Combined risks',
    !!d.querySelector('#lpArchRiskBar') && w.eval('document.querySelector(\'a[onclick*="tab-combined"]\') !== null'));
  OK('Combined-risk chart: 4 clickable risk columns that filter Applications (rows 153/177)',
    [...d.querySelectorAll('#lpArchRiskBar > a')].length === 4
    && [...d.querySelectorAll('#lpArchRiskBar > a > div')].length === 4
    && d.getElementById('lpArchRiskBar').getAttribute('role') === null
    && [...d.querySelectorAll('#lpArchRiskBar > a')].every(a => a.getAttribute('onclick').startsWith("showAppsForRisk('"))
    && [...d.querySelectorAll('#lpArchRiskBar > a')].every(a => a.getAttribute('aria-label').includes(' of 12 applications')));
  const gauge = d.getElementById('lpArchTrendGauge');
  OK('trends burn-down gauge: fill = latest/baseline share, badge beside it (row 162)',
    gauge && !gauge.hidden && gauge.getAttribute('role') === 'img'
    && d.getElementById('lpArchTrendGaugeFill').style.width === '59%'
    && d.getElementById('lpArchTrendGaugeLabel').textContent.includes('−41% since Sep 8')
    && !d.getElementById('lpArchTrendCaption').textContent.includes('−41%'));
  OK('trends pass stacks sit side by side with the incidents bars per run (rows 159/161/179)',
    [...d.querySelectorAll('#lpArchTrendBars [role="img"][aria-label^="verification pass rate"]')].length === 5
    && [...d.querySelectorAll('#lpArchTrendBars [role="img"][aria-label^="verification pass rate"] > div')].length === 10
    && !!d.querySelector('#lpArchTrendBars [title*="open incidents (2026-11-03)"]')
    && !!d.querySelector('#lpArchTrendBars > div > div > a[onclick*="incidents"]')
    && !!d.querySelector('#lpArchTrendBars > div > div > a[onclick*="waves"]'));

  // ---- row 147: comment composer (openIncidentFromRow routes to the MODAL — #modalAppBody) ----
  w.eval("closeDrawers(); openIncidentFromRow('invoicing', 0)");
  const input = d.getElementById('incCommentInput');
  const card = d.querySelector('#modalAppBody .pf-v6-c-card');
  OK('composer present inside the triage-state card, gated by incidents:triage',
    !!input && !!card && !!card.querySelector('#incCommentInput')
    && !!card.querySelector('button[onclick*="incAddComment"]')
    && card.querySelector('button[onclick*="incAddComment"]').dataset.rbac === 'incidents:triage');
  const before = card.querySelectorAll('tbody tr').length;
  w.eval('incAddComment(document.querySelector(\'#modalAppBody button[onclick*="incAddComment"]\'))');
  OK('empty comment is a no-op', card.querySelectorAll('tbody tr').length === before);
  input.value = 'pattern confirmed on 2 of 3 occurrences';
  w.eval('incAddComment(document.querySelector(\'#modalAppBody button[onclick*="incAddComment"]\'))');
  const rows147 = [...card.querySelectorAll('tbody tr')];
  OK('comment appends to the history attributed to the persona login, input clears',
    rows147.length === before + 1
    && rows147[0].textContent.includes('Comment added')
    && rows147[0].textContent.includes('m.keller@northwind-financial.com')
    && rows147[0].textContent.includes('pattern confirmed on 2 of 3 occurrences')
    && input.value === '');

  // ---- external ticket keys are links (rendered from WAVE_TICKETS at runtime) ----
  OK('wave ticket external keys are tracker links (MIG-412/418/425)',
    !!d.querySelector('a[title*="MIG-412"]') && !!d.querySelector('a[title*="MIG-418"]') && !!d.querySelector('a[title*="MIG-425"]')
    && !!d.querySelector('#ticketsBody-3 a[title*="MIG-412"]') && !!d.querySelector('#ticketsBody-4 a[title*="MIG-425"]'));

  // ---- combined risks: rename + mitigation tables ----
  OK('"Distribution" renamed "Relative share" with an explanatory annotation',
    !!d.querySelector('#panel-combined thead th') && [...d.querySelectorAll('#panel-combined th')].some(th => th.textContent.includes('Relative share')));
  const mitTbl = exp => [...exp.querySelectorAll('table')].find(t => t.querySelector('thead') && t.querySelector('thead').textContent.includes('Mitigation'));
  const smT = mitTbl(d.getElementById('exp-state-mgmt')), clT = mitTbl(d.getElementById('exp-cloud'));
  OK('mitigations render as tables (two for State mgmt, one for Cloud readiness)',
    !!smT && smT.querySelector('tbody').children.length === 2 && smT.textContent.includes('Sticky-session audit')
    && !!clT && clT.querySelector('tbody').children.length === 1);

  // ---- row 151: effort header relabel + row 150: archetype action icons ----
  OK('inventory effort header reads "Effort (pts)"',
    [...d.querySelectorAll('#invHead th')].some(th => th.textContent.includes('Effort (pts)')));
  OK('archetype Actions icons tightened (mock-layer rule present)',
    [...d.querySelectorAll('style')].some(s => s.textContent.includes('#archBody .pf-v6-c-action-list{gap:var(--rh-space-xs);}')));

  console.log(fail === 0 ? 'ALL PASS (' + pass + ')' : 'FAILURES: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}, 400);
