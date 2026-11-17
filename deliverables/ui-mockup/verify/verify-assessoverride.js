const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
let pass = 0, fail = 0;
const OK = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); c ? pass++ : fail++; };
setTimeout(() => {
  const d = dom.window.document, w = dom.window;
  w.setPersona('admin');

  // ---- the Assess verb routes through the gate ----
  OK('the app-detail Assess button routes through assessGate (not the bare drawer)',
    (() => {
      const btn = [...d.querySelector('#tpl-drawer-app').content.querySelectorAll('button')].find(b => b.textContent.trim() === 'Assess');
      return !!btn && btn.getAttribute('onclick') === "assessGate('payments-api')";
    })());

  // ---- open the gate ----
  w.assessGate('payments-api');
  OK('gate modal: warning-icon title New assessment, verbatim live alert names the app + archetype',
    !d.getElementById('modalAssessOverride').hidden
    && d.getElementById('ao-title').textContent.includes('New assessment')
    && !!d.getElementById('aoIcon').querySelector('svg')
    && d.getElementById('aoAppName').textContent === 'payments-api'
    && d.getElementById('aoArch').textContent === 'EAP8-archetype'
    && d.getElementById('modalAssessOverride').textContent.includes('already is associated with archetypes:'));
  OK('body carries the verbatim live question', d.getElementById('modalAssessOverride').textContent.includes('Do you want to create a dedicated assessment for this application and override the inherited archetype assessment(s)?'));
  OK('three live actions: Override (primary) / View archetypes (secondary) / Cancel (link)',
    d.getElementById('aoOverrideBtn').classList.contains('pf-m-primary')
    && [...d.querySelectorAll('#modalAssessOverride .pf-v6-c-button')].some(b => b.textContent.trim() === 'View archetypes' && b.classList.contains('pf-m-secondary'))
    && [...d.querySelectorAll('#modalAssessOverride .pf-v6-c-button')].some(b => b.textContent.trim() === 'Cancel' && b.classList.contains('pf-m-link')));

  // ---- View archetypes jumps to the cohort tab ----
  w.assessViewArchetypes();
  OK('View archetypes closes the modal and jumps to the archetypes/cohorts tab',
    d.getElementById('modalAssessOverride').hidden
    && !d.getElementById('scr-inventory').hidden
    && d.getElementById('tab-inv-cohorts').getAttribute('aria-selected') === 'true');

  // ---- Override proceeds to the questionnaire in dedicated mode ----
  w.assessGate('payments-api');
  w.assessOverrideProceed();
  OK('Override closes the modal and opens the questionnaire drawer (Assessment — payments-api)',
    d.getElementById('modalAssessOverride').hidden
    && !d.getElementById('drawerRoot').hidden
    && d.getElementById('drawerBody').querySelector('h2').textContent.includes('Assessment — payments-api'));
  const alert = d.getElementById('drawerBody').querySelector('.pf-v6-c-alert.pf-m-info');
  OK('dedicated-mode note: answers override the inherited assessments, the archetype baseline stays untouched (#45)',
    !!alert
    && alert.textContent.includes('Dedicated assessment')
    && alert.textContent.includes('override the inherited archetype assessment(s) for')
    && alert.textContent.includes('baseline stays untouched'));
  OK('the questionnaire keeps its inherited-risk context (openAssessment\u2019s Completed label + risk line)',
    d.getElementById('drawerBody').textContent.includes('Completed · v3')
    && d.getElementById('drawerBody').textContent.includes('inherited from archetype')
    && !!d.getElementById('drawerBody').querySelector('table'));
  OK('the drawer is deep-linked (state.drawer = assess)', w.eval('state.drawer') === 'assess');

  // ---- gate is generalizable (any archetype-carrying app) ----
  w.assessGate('claims-batch');
  OK('gate names the requested app (claims-batch) and its archetype',
    d.getElementById('aoAppName').textContent === 'claims-batch'
    && d.getElementById('aoArch').textContent === 'EAP8-archetype');
  w.closeModals();

  // ---- Cancel path ----
  w.closeDrawers();
  w.assessGate('payments-api');
  [...d.querySelectorAll('#modalAssessOverride .pf-v6-c-button')].find(b => b.textContent.trim() === 'Cancel').click();
  OK('Cancel closes the modal without opening the drawer',
    d.getElementById('modalAssessOverride').hidden && d.getElementById('drawerRoot').hidden);

  console.log(fail === 0 ? 'ALL PASS (' + pass + ')' : 'FAILURES: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}, 400);
