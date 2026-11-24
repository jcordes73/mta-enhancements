const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
const OK = (n, c) => console.log((c ? 'PASS' : 'FAIL') + '  ' + n);
setTimeout(() => {
  const d = dom.window.document, w = dom.window;
  // architect home
  w.setPersona('architect', true);
  OK('risk bar chart has 4 clickable category bars with px heights and count labels (rows 153/177)', [...d.querySelectorAll('#lpArchRiskBar > a > div')].length === 4
    && [...d.querySelectorAll('#lpArchRiskBar > a > div')].every(b => b.style.height.endsWith('px'))
    && [...d.querySelectorAll('#lpArchRiskBar > a > span')].every(s => /^\d+$/.test(s.textContent.trim()))
    && [...d.querySelectorAll('#lpArchRiskBarLabels > div')].map(x => x.textContent).join(',') === 'High,Medium,Low,Unassessed');
  // row 155: the coverage donut became a labeled bar chart (count + percentage per state);
  // row 178: each column is a clickable anchor filtering Applications
  const covBars = [...d.querySelectorAll('#homeCoverageBars > a > div')];
  const covCounts = [...d.querySelectorAll('#homeCoverageBars > a > span')].map(s => parseInt(s.textContent, 10));
  OK('coverage bar chart: one bar per analysis state, count + % labels', covBars.length === 5
    && covBars.every(b => b.style.height.endsWith('px'))
    && covBars.every(b => b.closest('a').title.includes('applications'))
    && covCounts.every(n => !isNaN(n)));
  OK('KPI footers present on all four architect tiles', [...d.querySelectorAll('.lp-architect .pf-v6-c-card__footer a')].length >= 4);
  const archGates = [...d.querySelectorAll('#lpArchWaveGates > div')];
  const gateChipTxt = [...d.querySelectorAll('#lpArchWaveGates .pf-v6-c-label')].map(c => c.textContent.trim());
  console.log('  arch wave gate chips:', gateChipTxt.join(' | '));
  OK('architect wave gates: waves-screen chip strips, FAILING chips only (rows 213/215)', archGates.length === 2
    && gateChipTxt.filter(t => /Tickets closed|No quota blocks|Verification green|Credentials ready|blocking incident/.test(t)).length >= 7
    && !gateChipTxt.some(t => t.includes('\u2713'))
    && /Wave 3/.test(archGates[0].textContent) && /blocked/.test(archGates[0].textContent)
    && /Wave 4/.test(archGates[1].textContent) && /at risk/.test(archGates[1].textContent)   /* row 229: derived from waveGateFacts (was hardcoded 'planned' — the waves screen says blocked, pm home AT RISK) */
    && !/done/.test(d.getElementById('lpArchWaveGates').textContent)
    && archGates[0].querySelector('.gate-chip-btn[title*="Tickets closed"]').title.includes('2 ticket(s) still open'));
  // pm home strip
  w.setPersona('pm', true);
  const pmStrip = [...d.querySelectorAll('#lpPmWaveStrip .pf-v6-c-label')].map(c => c.textContent.trim());
  console.log('  pm wave strip:', pmStrip.join(' | '));
  OK('pm wave strip reflects claims scope', pmStrip.length === 2 && pmStrip.every(t => /W[34] (failing|passing)/.test(t)));
  // admin alert group
  w.setPersona('admin', true);
  const alerts = [...d.querySelectorAll('#lpAdmStatus .pf-v6-c-alert')];
  OK('admin status renders as inline alerts', alerts.length === 4 && alerts[0].classList.contains('pf-m-danger'));
  OK('admin alert severities: waves danger, risk warning, creds warning, tasks info', alerts[1].classList.contains('pf-m-warning') && alerts[2].classList.contains('pf-m-warning') && alerts[3].classList.contains('pf-m-info'));
  // reports trends toggle
  w.show('reports');
  const passChip = [...d.querySelectorAll('#rptTrendOpts [data-series]')].find(c => c.dataset.series === 'pass');
  passChip.click();
  const cap1 = d.getElementById('rptTrendCaption').textContent.replace(/\s+/g,' ').trim();
  console.log('  pass-series caption:', cap1.slice(0, 130));
  OK('pass series: caption switches + values are %', cap1.startsWith('Verification pass rate') && cap1.includes('82%') && cap1.includes('+21%') && cap1.includes('2026-09-08'));
  const bars = [...d.querySelectorAll('#rptTrendBars span')].map(s => s.textContent.trim());
  OK('pass-series bars = store pass values', bars.join(',') === '68%,71%,74%,78%,82%');
  const three = [...d.querySelectorAll('#rptTrendOpts [data-count]')].find(c => c.dataset.count === '3');
  three.click();
  OK('range chip slices to last 3 runs', [...d.querySelectorAll('#rptTrendBars span')].length === 3 && d.getElementById('rptTrendDates').textContent.includes('2026-10-20'));
  // provenance facets
  const facets = [...d.querySelectorAll('#provFacets .pf-v6-c-label')].map(c => c.textContent.trim());
  console.log('  prov facets:', facets.join(' | '));
  OK('prov facets show live counts', facets.length === 3 && facets.every(f => /\(\d+\)$/.test(f)));
  [...d.querySelectorAll('#provFacets .pf-v6-c-label')].find(c => c.dataset.prov === 'own').click();
  OK('facet chip filters the table', [...d.querySelectorAll('#provBody tr[data-prov]')].every(tr => tr.dataset.prov === 'own'));
  // gate strips above the wave tabs (row 193, verdict removed in row 194 — wave level reports it)
  w.show('waves');
  const stripMap = sel => [...d.querySelectorAll(sel + ' .pf-v6-c-label')].map(l => l.className.includes('pf-m-red') ? 'X' : l.className.includes('pf-m-yellow') ? '!' : 'ok');
  const strip3 = stripMap('#waveGateStrip-3');
  console.log('  wave-3 strip:', strip3.join(' '));
  OK('wave-3 strip: FAILING chips only (row 215) — 4 chips, 3 failing + 1 warning, no green',
    strip3.length === 4 && strip3.filter(x => x === 'X').length === 3 && strip3.filter(x => x === '!').length === 1
    && !d.getElementById('waveGateStrip-3').textContent.includes('BLOCKED')
    && !d.getElementById('waveGateStrip-3').textContent.includes('\u2713'));
  const strip4 = stripMap('#waveGateStrip-4');
  console.log('  wave-4 strip:', strip4.join(' '));
  /* row 215: failing only — wave-4's green chips (Zero blocking incidents, Credentials ready)
     and the green all-clear dependency chip are hidden; 4 chips remain: 2 hard fails
     (quota + tickets) + 2 warnings (suites unevaluated? no — suites warn + dependency held) */
  OK('wave-4 strip reflects its facts (4 chips: quota + tickets fail, suites + dependency warn)',
    strip4.length === 4 && strip4.filter(x => x === 'X').length === 2 && strip4.filter(x => x === '!').length === 2);
  const strip1 = d.getElementById('waveGateStrip-1');
  OK('member-less waves report NOT EVALUABLE instead of silence',
    strip1 && strip1.textContent.includes('not evaluable') && strip1.textContent.includes('completed before the sample window'));
  /* row 195: chips open the tab carrying their evidence */
  [...d.querySelectorAll('#waveGateStrip-3 .gate-chip-btn')][0].click();
  OK('wave-3 "Tickets closed" chip (2 open) opens the Tickets tab',
    d.getElementById('tab-wave-tickets-3').getAttribute('aria-selected') === 'true' && !d.getElementById('panel-wave-tickets-3').hidden);
  [...d.querySelectorAll('#waveGateStrip-3 .gate-chip-btn')][2].click();
  /* row 201: the chip opens the Quota-blocks tab in BOTH states — row 215 hides wave-3's
     GREEN quota chip (quota passes there), so the empty state is asserted from the tab itself */
  OK('wave-3 green "No quota blocks" chip hidden (row 215); Quota-blocks tab empty state still reachable',
    !d.querySelector('#waveGateStrip-3 .gate-chip-btn[title*="No quota blocks"]')
    && (d.getElementById('tab-wave-quota-3').click(), !d.getElementById('panel-wave-quota-3').hidden)
    && d.getElementById('quotaList-3').textContent.includes('No quota-blocked tasks'));
  [...d.querySelectorAll('#waveGateStrip-4 .gate-chip-btn')][1].click();
  /* claims-web only: waveGateFacts reads the inventory's RENDERED rows (the recorded
     row-40 semantics) — under admin's 12-app pagination risk-scoring sits on page 2 */
  OK('wave-4 "No quota blocks" chip (red) opens the Quota-blocks tab with the parked member',
    d.getElementById('tab-wave-quota-4').getAttribute('aria-selected') === 'true' && !d.getElementById('panel-wave-quota-4').hidden
    && d.getElementById('quotaList-4').textContent.includes('claims-web'));
  [...d.querySelectorAll('#waveGateStrip-3 .gate-chip-btn')][2].click();
  OK('wave-3 "Verification green" chip (3 of 10 suites red) opens the Verification-evidence tab',
    d.getElementById('tab-wave-verify-3').getAttribute('aria-selected') === 'true' && !d.getElementById('panel-wave-verify-3').hidden);
  /* row 204/215: the YELLOW creds chip (1 expiring) still shows — warning ≠ passing */
  [...d.querySelectorAll('#waveGateStrip-3 .gate-chip-btn')][3].click();
  OK('wave-3 "Credentials ready" chip (1 expiring, warn) opens the Credentials-verified tab mirroring the gate condition',
    d.getElementById('tab-wave-creds-3').getAttribute('aria-selected') === 'true' && !d.getElementById('panel-wave-creds-3').hidden
    && d.getElementById('credList-3').textContent.includes('1 expiring'));
  /* row 204: the credentials chip opened the Credentials-verified tab in BOTH states —
     row 215 hides wave-4's GREEN creds chip, so the all-ok state is asserted from the tab */
  OK('wave-4 green "Credentials ready" chip hidden (row 215); Credentials tab all-ok state still reachable',
    !d.querySelector('#waveGateStrip-4 .gate-chip-btn[title*="Credentials ready"]')
    && (d.getElementById('tab-wave-creds-4').click(), !d.getElementById('panel-wave-creds-4').hidden)
    && d.getElementById('credList-4').textContent.includes('all member credentials ok'));
  /* row 199: the blocking-incidents chip opens the wave's Blocking-incidents tab */
  [...d.querySelectorAll('#waveGateStrip-3 .gate-chip-btn')][1].click();
  OK('wave-3 "1 blocking incident" chip opens the Blocking-incidents tab with the blocker row',
    d.getElementById('tab-wave-block-3').getAttribute('aria-selected') === 'true' && !d.getElementById('panel-wave-block-3').hidden
    && d.getElementById('blockList-3').textContent.includes('claims-batch') && d.getElementById('blockList-3').textContent.includes('Kafka contract mismatch'));
  // inventory mini-bars
  w.show('inventory');
  w.eval('state.team = null');   /* reset the pm team-lock (pre-existing quirk) for a full-org scope */
  w.renderInventory();
  const bars2 = [...d.querySelectorAll('#invBody td:nth-child(9) .miniBar i')].map(i => i.style.width);   /* effort column only — the Progress column (row 145) carries miniBars too */
  const ptsApps = w.eval('scopedApps().filter(a => a.pts != null).length');
  OK('effort mini-bars render for every app with pts (' + bars2.length + ' bars = ' + ptsApps + ' apps with pts)', bars2.length === ptsApps && bars2.every(x => x.endsWith('%')));
  OK('bar scale: max pts app = 100%', bars2.includes('100%'));
  // pgm KPI footers — checked last: setPersona('pgm') team-locks scope (pre-existing quirk) and would skew later checks
  w.setPersona('pgm', true); w.renderPgmCoord();
  OK('pgm footers exist (4 KPI tiles — row 203 adds Wave capacity)', [...d.querySelectorAll('#lpPgmKpis .pf-v6-c-card__footer a')].length === 4);
}, 700);
