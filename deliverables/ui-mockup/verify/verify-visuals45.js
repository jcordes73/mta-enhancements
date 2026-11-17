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
  OK('stacked risk bar has 3+ segments sized by count', [...d.querySelectorAll('#lpArchRiskBar b')].length >= 3 && d.querySelector('#lpArchRiskBar b').style.width.endsWith('%'));
  OK('coverage donut renders SVG with dasharray', !!d.querySelector('#homeCoverageDonut svg circle[stroke-dasharray]'));
  // #59: segmented donut — one arc per analysis state, titles carry the counts, arcs tile the circle
  const segs59 = [...d.querySelectorAll('#homeCoverageDonut circle[stroke-dasharray]')];
  const segTitles = segs59.map(c => c.querySelector('title')?.textContent || '');
  const segStates = segTitles.map(t => t.replace(/^\d+ /, ''));
  OK('coverage donut is segmented by analysis state (#59)', segs59.length >= 3
    && segStates.includes('current') && segStates.includes('in flight')
    && segTitles.every(t => /^\d+ /.test(t))
    && new Set(segs59.map(c => c.getAttribute('stroke'))).size >= 3);
  OK('donut aria-label carries the breakdown', /Analysis coverage \d+% of \d+ applications — \d+ current/.test(d.querySelector('#homeCoverageDonut svg').getAttribute('aria-label')));
  OK('KPI footers present on all four architect tiles', [...d.querySelectorAll('.lp-architect .pf-v6-c-card__footer a')].length >= 4);
  const archStrip = [...d.querySelectorAll('#lpArchWaveStrip .pf-v6-c-label')].map(c => c.textContent.trim());
  console.log('  arch wave strip:', archStrip.join(' | '));
  OK('architect wave strip: W3 red + W4 red (both failing)', archStrip.some(t => t.startsWith('W3 failing')) && archStrip.some(t => t.startsWith('W4 failing')));
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
  // steppers on waves screen
  w.show('waves');
  const steps3 = [...d.querySelectorAll('#waveGateSteps-3 .pf-v6-c-progress-stepper__step')].map(s => s.classList.contains('pf-m-danger') ? 'X' : s.classList.contains('pf-m-warning') ? '!' : 'ok');
  console.log('  wave-3 stepper:', steps3.join(' '));
  OK('wave-3 stepper: 4 steps with 2 failing (tickets, verification) + 1 warning (creds)', steps3.filter(x => x === 'X').length === 2 && steps3.filter(x => x === '!').length === 1);
  const steps4 = [...d.querySelectorAll('#waveGateSteps-4 .pf-v6-c-progress-stepper__step')].map(s => s.classList.contains('pf-m-danger') ? 'X' : s.classList.contains('pf-m-warning') ? '!' : 'ok');
  console.log('  wave-4 stepper:', steps4.join(' '));
  OK('wave-4 stepper reflects its facts (2 quota + tickets + no suites)', steps4.filter(x => x === 'X').length === 2 && steps4.filter(x => x === '!').length === 1);
  // inventory mini-bars
  w.show('inventory');
  w.eval('state.team = null');   /* reset the pm team-lock (pre-existing quirk) for a full-org scope */
  w.renderInventory();
  const bars2 = [...d.querySelectorAll('#invBody .miniBar i')].map(i => i.style.width);
  const ptsApps = w.eval('scopedApps().filter(a => a.pts != null).length');
  OK('effort mini-bars render for every app with pts (' + bars2.length + ' bars = ' + ptsApps + ' apps with pts)', bars2.length === ptsApps && bars2.every(x => x.endsWith('%')));
  OK('bar scale: max pts app = 100%', bars2.includes('100%'));
  // pgm KPI footers — checked last: setPersona('pgm') team-locks scope (pre-existing quirk) and would skew later checks
  w.setPersona('pgm', true); w.renderPgmCoord();
  OK('pgm footers exist (3 KPI tiles)', [...d.querySelectorAll('#lpPgmKpis .pf-v6-c-card__footer a')].length === 3);
}, 700);
