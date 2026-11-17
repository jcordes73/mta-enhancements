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
  OK('wave 3 has a 4-lens tab bar', !!bar3 && bar3.querySelectorAll('[data-wavetab]').length === 4);
  OK('Applications is the default lens (selected, panel visible)', bar3.querySelector('[data-wavetab="apps"]').getAttribute('aria-selected') === 'true'
    && !d.getElementById('panel-wave-apps-3').hidden
    && d.getElementById('panel-wave-gate-3').hidden && d.getElementById('panel-wave-verify-3').hidden && d.getElementById('panel-wave-tickets-3').hidden);
  OK('member table lives in the Applications panel', !!d.querySelector('#panel-wave-apps-3 #waveMembers-3'));
  OK('stepper stays above the tabs (always-visible summary)', bar3.previousElementSibling === d.getElementById('waveGateSteps-3')
    || !!d.getElementById('waveGateSteps-3') && d.getElementById('waveGateSteps-3').compareDocumentPosition(bar3) & w.Node.DOCUMENT_POSITION_FOLLOWING);

  // badges: live counts + gate status mark
  OK('Applications badge = member count (5)', d.getElementById('waveTabAppsN-3').textContent.trim() === '5');
  OK('Tickets badge = exported ticket count (2)', d.getElementById('waveTabTicketsN-3').textContent.trim() === '2');
  OK('Gate tab carries a red fail mark while the gate fails', d.getElementById('waveTabGateMark-3').querySelector('[style*="danger"]') !== null);

  // switching lenses
  bar3.querySelector('[data-wavetab="gate"]').click();
  OK('Gate tab shows the gate panel and hides the others', !d.getElementById('panel-wave-gate-3').hidden
    && d.getElementById('panel-wave-apps-3').hidden && d.getElementById('panel-wave-tickets-3').hidden);

  // persistence across waves: expand wave 4 -> same lens selected
  const exp4 = d.querySelector('[data-expand="wave-members-4"]');
  exp4.click();
  const bar4 = d.getElementById('waveTabs-4');
  OK('expanding Wave 4 keeps the selected lens (gate)', bar4.querySelector('[data-wavetab="gate"]').getAttribute('aria-selected') === 'true'
    && !d.getElementById('panel-wave-gate-4').hidden);

  // wave 4 now has the same lenses, JS-filled
  OK('wave 4 gate list renders failing conditions', [...d.querySelectorAll('#gateList-4 li')].length >= 4
    && d.getElementById('gateList-4').textContent.includes('quota-blocked'));
  OK('wave 4 overall verdict = BLOCKED (JS-derived)', d.getElementById('waveOverall-4').textContent.includes('BLOCKED'));
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
