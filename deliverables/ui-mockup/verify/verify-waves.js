const fs = require('fs');
const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const errors = [];
const dom = new JSDOM(html.replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, ''), { url: 'http://mock.test/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => errors.push(e.message));
setTimeout(() => {
  const d = dom.window.document, w = dom.window;
  let pass = 0, fail = 0;
  const t = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL:', n); } };
  w.show('waves');

  const scr = d.getElementById('scr-waves');
  const topTitles = [...scr.querySelectorAll('.pf-v6-c-card__title')].filter(x => !x.closest('.wave-exec-detail') && !x.closest('#pgmCoord') && !x.closest('#credReadiness')).map(x => x.textContent.trim());
  t('single top-level card', topTitles.length === 1 && topTitles[0].includes('Wave execution'));
  /* row 207 overrun pass: wave 3 gains a hatched .bar-overrun continuation segment */
  t('4 lanes + month header + 5 bars (incl. wave 3 overrun segment)', d.querySelectorAll('#scr-waves .wave-exec').length === 4 && d.querySelectorAll('#scr-waves .gantt .bar').length === 5 && !!d.querySelector('#scr-waves .month-labels'));
  t('wave 3 overrun segment: hatched, contiguous, data-overrun to today, labeled +25d overdue', !!d.querySelector('#scr-waves .gantt .bar-overrun') && d.querySelector('#scr-waves .gantt .bar-overrun').getAttribute('data-overrun') === '2026-10-24/2026-11-18' && d.querySelector('#scr-waves .gantt .bar-overrun').textContent.includes('+25d overdue') && d.querySelector('#scr-waves .gantt .bar-overrun').getAttribute('style').includes('repeating-linear-gradient'));

  const lanes = [...d.querySelectorAll('#scr-waves .wave-exec')];
  const statv = (lane, k) => { const st = [...lane.querySelectorAll('.wave-stat')].find(x => x.querySelector('.wave-stat-k').textContent.trim().startsWith(k)); return st ? st.querySelector('.wave-stat-v') : null; };
  t('W1 planned-actual', statv(lanes[0], 'Planned').textContent.includes('Sep 1\u201315 \u2192 Sep 1\u201315'));
  t('W2 +2d slippage', statv(lanes[1], 'Planned').textContent.includes('+2d'));
  t('W3 R-12 + re-validate', statv(lanes[2], 'Composition').textContent.includes('R-12') && !!statv(lanes[2], 'Composition').querySelector('button'));
  /* row 191: the wave-side re-validate is wired — click absorbs the flag, recomputes effort,
     and toasts the confirmation with the dependency check */
  statv(lanes[2], 'Composition').querySelector('button').click();
  t('W3 re-validate clears the flag to a member count', statv(lanes[2], 'Composition').textContent.includes('5 members') && !statv(lanes[2], 'Composition').querySelector('.pf-v6-c-label'));
  t('W3 re-validate toast quotes the flag + dependency check (#25, #46)',
    d.getElementById('rbacToast').textContent.includes('Wave 3') && d.getElementById('rbacToast').textContent.includes('rule R-12 added 3 apps')
    && d.getElementById('rbacToast').textContent.includes('dependency check clean'));
  t('W4 Nov 3-21', statv(lanes[3], 'Planned').textContent.includes('Nov 3\u201321'));

  t('waveStake ids (4)', d.querySelectorAll('#scr-waves [id^="waveStake-"]').length === 4);
  t('W3 analysis/risk/effort filled', statv(lanes[2], 'Analysis').textContent.includes('succeeded') && statv(lanes[2], 'Risk').textContent.includes('high') && statv(lanes[2], 'Total effort').textContent.includes('1,803'));
  t('W4 effort 1,579', statv(lanes[3], 'Total effort').textContent.includes('1,579'));

  // agent spend rollup (#20): actual token/cost from the run records, rolled up live per wave
  const waveSpend = (wave) => {
    const apps = [...d.querySelectorAll('#invBody tr[data-wave="' + wave + '"]')].map(tr => tr.dataset.name);
    const rs = w.eval('(function(){ const apps = ' + JSON.stringify(apps) + '; return MOCK_AGENT_RUNS.filter(r => apps.includes(r.app)); })()');
    return { n: rs.length,
             tok: rs.reduce((t, r) => t + (parseInt(String(r.tokens).replace(/\D/g, ''), 10) || 0), 0),
             cost: rs.reduce((t, r) => t + (parseFloat(String(r.cost).replace(/[^0-9.]/g, '')) || 0), 0) };
  };
  const fmtK = n => n >= 1e6 ? (Math.round(n / 1e5) / 10) + 'M' : Math.round(n / 1e3) + 'k';
  { const s3 = waveSpend(3);
    t('W3 agent-spend stat equals the member apps\' run-record rollup (money + tokens + runs, #20)', statv(lanes[2], 'Agent spend').textContent.includes('$' + s3.cost.toFixed(2)) && statv(lanes[2], 'Agent spend').textContent.includes(fmtK(s3.tok) + ' tokens') && statv(lanes[2], 'Agent spend').textContent.includes(s3.n + ' runs')); }
  { const s4 = waveSpend(4);
    t('W4 agent-spend stat counts the failed run\'s partial accounting (record kept, money counted)', statv(lanes[3], 'Agent spend').textContent.includes('$' + s4.cost.toFixed(2)) && s4.n === 1); }
  t('W1/W2 spend is an honest dash (no sampled apps \u2192 no spend claimed)', statv(lanes[0], 'Agent spend').textContent.includes('\u2014') && statv(lanes[1], 'Agent spend').textContent.includes('\u2014'));
  { const tbl = d.querySelector('#waveMembers-3 table');
    const prow = [...tbl.querySelectorAll('tbody tr')].find(tr => tr.cells[0].textContent.includes('payments-api'));
    t('W3 member table gains an Agent spend column (per-app + tfoot total)', !!tbl.querySelector('thead .anno') && prow.textContent.includes('$') && tbl.querySelector('tfoot').textContent.includes('$' + waveSpend(3).cost.toFixed(2))); }
  // spend follows the tenancy clamp: Meridian Health has no run records \u2192 its wave spend collapses
  w.setPersona('padmin', true); w.setOrg('mrd');   // only the platform admin can pivot organizations
  t('spend follows the tenancy scope (Meridian: no sampled run records \u2192 dash)', statv([...d.querySelectorAll('#scr-waves .wave-exec')][2], 'Agent spend').textContent.includes('\u2014'));
  w.setOrg('nwf');
  t('switching back restores the Northwind rollup (recomputed from the same store)', statv([...d.querySelectorAll('#scr-waves .wave-exec')][2], 'Agent spend').textContent.includes('$92.32'));
  w.setPersona('architect', true);
  t('stakeholder guard wave-ref works', w.eval('[...document.querySelectorAll("#scr-waves [id^=waveStake-]")].some(td => td.textContent.includes("M. Keller"))') === true);

  // chevron rotation state (defect #26): PF6 rotates the toggle icon via pf-m-expanded on the button
  const b1 = d.querySelector('button[data-expand="wave-members-1"]');
  const b3 = d.querySelector('button[data-expand="wave-members-3"]');
  t('W3 chevron starts expanded (class+aria)', b3.classList.contains('pf-m-expanded') && b3.getAttribute('aria-expanded') === 'true');
  b1.click();
  t('W1 chevron flips on expand', b1.classList.contains('pf-m-expanded') && b1.getAttribute('aria-expanded') === 'true' && !d.getElementById('wave-members-1').hidden);
  b1.click();
  t('W1 chevron flips back on collapse', !b1.classList.contains('pf-m-expanded') && b1.getAttribute('aria-expanded') === 'false' && d.getElementById('wave-members-1').hidden);

  t('W3 open at rest with full story', !d.getElementById('wave-members-3').hidden && d.getElementById('wave-members-3').textContent.includes('Blocking incidents') && d.getElementById('wave-members-3').textContent.includes('MIG-412'));
  const d1 = d.getElementById('wave-members-1');
  lanes[0].querySelector('button[data-expand]').click();
  t('W1 expands + explains', !d1.hidden && d1.textContent.includes('no sampled applications'));
  lanes[0].querySelector('button[data-expand]').click();
  t('W1 collapses back', d1.hidden);

  w.setPersona('admin', true); w.show('config');
  let ok = 0;
  [...d.querySelectorAll('#cfgSubnav a[data-pane]')].forEach(a => { a.click(); const p = d.getElementById(a.dataset.pane); if (p && !p.hidden) ok++; });
  t('config 15/15 leaves (row 234: tabs dissolved into the left sub-nav)', ok === 15);
  w.showAgentic('agents');
  ok = 0;
  [...d.querySelectorAll('#scr-agentic > .pf-v6-c-tabs .pf-v6-c-tabs__link')].forEach(b => { b.click(); const p = d.getElementById(b.getAttribute('aria-controls')); if (p && !p.hidden) ok++; });
  t('agentic 7/7 (row 220 adds the Agent cards tab)', ok === 7);
  const ref = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'inv-rows-reference-wp3.json'), 'utf8'));
  const norm = s => s.replace(/&middot;/g, '\u00b7').replace(/\s+/g, ' ').trim();
  const irows = [...d.querySelectorAll('#invBody tr')];
  let mm = 0;
  irows.forEach((r, i) => { const got = [...r.children].map(c => norm(c.innerHTML)); const want = ref[i].cells.map(norm); if (got.some((c, j) => c !== want[j])) mm++; });
  t('byte-equality 12x10', mm === 0 && irows.length === 12);
  t('masthead 4', d.getElementById('taskQueueCount').textContent === '4');
  /* row 202: capacity derives from staffing — 2 stakeholders × 9 working days (Oct 13–24) × 60% → 11;
     the plan's load (WAVE_LOAD[3] = 9) fits; wave 4 is unstaffed → capacity unknown */
  /* row 205: the Gate-status tab is retired — capacity lives on the header stat tile;
     these assertions follow the row-202/203 model via the tile */
  const cap3 = d.getElementById('waveCap-3').textContent.replace(/\s+/g, ' ').trim();
  t('capacity derived from staffing: 9/11 team-days (stat tile)', cap3 === '9/11 team-days');
  t('capacity facts: 2 staff × 9 working days × 0.6 → 11', (() => { const c = w.waveCapacity(3); return c.staff === 2 && c.days === 9 && c.cap === 11 && c.load === 9; })());
  t('wave 4 unstaffed: — pending staffing (stat tile)', d.getElementById('waveCap-4').textContent.replace(/\s+/g, ' ').trim() === '\u2014 pending staffing');
  w.eval('WAVE_LOAD[3] = 99; buildWaveMembers();');
  t('over-commitment flag flips when load exceeds capacity (#46 item 4)', d.getElementById('waveCap-3').textContent.includes('Over-committed'));
  w.eval('WAVE_LOAD[3] = 9; buildWaveMembers();');
  /* row 203: the capacity stat tile on every wave header */
  t('stat tile w3: 9/11 team-days', d.getElementById('waveCap-3').textContent.replace(/\s+/g, ' ').trim() === '9/11 team-days');
  t('stat tile w4: — pending staffing', d.getElementById('waveCap-4').textContent.replace(/\s+/g, ' ').trim() === '\u2014 pending staffing');
  t('stat tiles w1/w2: derived 0/7 and 0/11', d.getElementById('waveCap-1').textContent.trim() === '0/7 team-days' && d.getElementById('waveCap-2').textContent.trim() === '0/11 team-days');
  t('no errors', errors.length === 0);
  console.log(pass + ' passed, ' + fail + ' failed');
}, 120);
