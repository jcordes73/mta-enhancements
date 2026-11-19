const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
let pass = 0, fail = 0;
const OK = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); c ? pass++ : fail++; };
setTimeout(() => {
  const d = dom.window.document, w = dom.window;
  w.setPersona('architect', true);
  w.show('waves');

  // structure: wave 3 tab bar with 4 lenses, Applications default
  const bar3 = d.getElementById('waveTabs-3');
  OK('wave 3 has a 7-lens tab bar (row 205: Gate status retired; row 207: Burndown joins as a lens)', !!bar3 && bar3.querySelectorAll('[data-wavetab]').length === 7);
  OK('Applications is the default lens (selected, panel visible)', bar3.querySelector('[data-wavetab="apps"]').getAttribute('aria-selected') === 'true'
    && !d.getElementById('panel-wave-apps-3').hidden
    && d.getElementById('panel-wave-block-3').hidden && d.getElementById('panel-wave-quota-3').hidden && d.getElementById('panel-wave-creds-3').hidden && d.getElementById('panel-wave-verify-3').hidden && d.getElementById('panel-wave-tickets-3').hidden);
  OK('member table lives in the Applications panel', !!d.querySelector('#panel-wave-apps-3 #waveMembers-3'));
  OK('gate strip stays above the tabs (row 207: burndown is a tab below the strip, not inline chrome)', !!d.getElementById('waveGateStrip-3')
    && d.getElementById('waveGateStrip-3').compareDocumentPosition(bar3) & w.Node.DOCUMENT_POSITION_FOLLOWING
    && !!d.getElementById('tab-wave-burn-3') && d.getElementById('panel-wave-burn-3').contains(d.getElementById('waveBurn-3')));

  // badges: live counts + gate status mark
  OK('Applications badge = member count (5)', d.getElementById('waveTabAppsN-3').textContent.trim() === '5');
  OK('Tickets badge = exported ticket count (2)', d.getElementById('waveTabTicketsN-3').textContent.trim() === '2');
  // switching lenses (row 205: no Gate tab — the conditions' own tabs carry the detail)
  bar3.querySelector('[data-wavetab="block"]').click();
  OK('Blocking-incidents tab shows the blocker panel and hides the others', !d.getElementById('panel-wave-block-3').hidden
    && d.getElementById('panel-wave-apps-3').hidden && d.getElementById('panel-wave-tickets-3').hidden);

  // persistence across waves: expand wave 4 -> same lens selected
  const exp4 = d.querySelector('[data-expand="wave-members-4"]');
  exp4.click();
  const bar4 = d.getElementById('waveTabs-4');
  OK('expanding Wave 4 keeps the selected lens (block)', bar4.querySelector('[data-wavetab="block"]').getAttribute('aria-selected') === 'true'
    && !d.getElementById('panel-wave-block-4').hidden);

  // row 210: wave 4 has 8 lenses — the Dependencies tab joins; the lane chip routes to it
  OK('wave 4 has an 8-lens tab bar (row 210: Dependencies joins)', bar4.querySelectorAll('[data-wavetab]').length === 8);
  OK('wave 4 Dependencies tab lists the provider live with its CURRENT status chip', bar4.querySelector('[data-wavetab="deps"]') !== null
    && d.getElementById('waveDepsBody-4').textContent.includes('Wave 3')
    && d.getElementById('waveDepsBody-4').textContent.includes('payments-api')
    && d.getElementById('waveDepsBody-4').querySelector('.pf-v6-c-label') !== null
    && d.getElementById('waveDepsBody-4').querySelector('.pf-v6-c-label').textContent.trim() === 'blocked'
    && d.getElementById('waveDepsNote-4').textContent.includes('cannot start'));
  /* row 210 link pass: the two app names in the edge cell are openApp links */
  OK('the edge cell links both applications (openApp handlers)',
    [...d.querySelectorAll('#waveDepsBody-4 a')].length === 2
    && [...d.querySelectorAll('#waveDepsBody-4 a')].every(a => /openApp\('(payments-api|claims-web)'\)/.test(a.getAttribute('onclick')))
    && d.getElementById('waveDepsBody-4').textContent.includes('consumed by'));
  /* row 210 strip move: the chip lives in the gate strip now (red while blocking, named like
     the other gate chips) and routes to the Dependencies tab */
  const depChip = d.querySelector('#waveGateStrip-4 .gate-chip-btn .pf-v6-c-label[data-burn-hue]').closest('button');
  OK('the gate strip carries the "No blocking dependencies" chip in its BLOCKING state (yellow warning grade, data-burn-hue)',
    !!depChip && depChip.textContent.includes('No blocking dependencies')
    && depChip.querySelector('.pf-v6-c-label').classList.contains('pf-m-yellow')
    && depChip.querySelector('[data-burn-hue]') !== null);
  depChip.click();
  OK('the gate-strip dependency chip routes to the Dependencies tab',
    d.getElementById('tab-wave-deps-4').getAttribute('aria-selected') === 'true'
    && !d.getElementById('panel-wave-deps-4').hidden);

  // wave 4 now has the same lenses, JS-filled
  OK('wave 4 quota list renders the parked members', d.getElementById('quotaList-4').textContent.includes('claims-web')
    && d.getElementById('quotaList-4').textContent.includes('risk-scoring'));
  OK('wave 4 credentials tab shows the honest unstaffed-wave state', d.getElementById('credList-4').textContent.includes('all member credentials ok'));
  OK('wave 4 evidence table renders honest rows', [...d.querySelectorAll('#verifyBody-4 tr')].length >= 1
    && d.getElementById('verifyBody-4').textContent.includes('not run'));

  // switching back to apps persists
  bar4.querySelector('[data-wavetab="apps"]').click();
  const exp3 = d.querySelector('[data-expand="wave-members-3"]');
  exp3.click(); exp3.click();   /* close + reopen wave 3 */
  OK('reopening a wave restores the last lens (apps)', d.getElementById('waveTabs-3').querySelector('[data-wavetab="apps"]').getAttribute('aria-selected') === 'true');

  // waves 1/2 unchanged (no tabs, honest empties)
  OK('waves 1/2 have no tab bars (no content to lens)', !d.getElementById('waveTabs-1') && !d.getElementById('waveTabs-2'));
  OK('wave 1 keeps its honest empty state', d.getElementById('wave-members-1').textContent.includes('completed before the sample window'));

  console.log(pass + ' passed, ' + fail + ' failed');
}, 700);
