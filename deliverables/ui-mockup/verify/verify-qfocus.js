const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
let pass = 0, fail = 0;
const OK = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); c ? pass++ : fail++; };
setTimeout(() => {
  const d = dom.window.document, w = dom.window;
  // parser output
  const secs = w.eval('questionnaireSections()');
  OK('parser: 1 section (Architecture excerpt), 2 questions with ids',
    secs.length === 1 && secs[0].name === 'Architecture' && secs[0].questions.length === 2);
  const q = secs[0].questions.find(x => x.id === 'lookup-service');
  OK('parser: lookup-service text + 3 answers with ids + risks',
    q && q.text === 'How does the application look up backing services (datasources, queues)?'
    && q.answers.length === 3
    && q.answers[2].id === 'hardcoded' && q.answers[2].risk === 'high');
  // open the modal
  w.openAssessment('payments-api');
  const body = d.getElementById('modalAppBody');
  const block = body.querySelector('#qFocus');
  const radios = [...block.querySelectorAll('.pf-v6-c-radio')];
  OK('modal question block renders 3 radios from the YAML answers', radios.length === 3);
  const labels = radios.map(r => r.querySelector('label').textContent.trim());
  OK('modal labels byte-agree with the YAML answer texts',
    labels[0] === 'Dependency injection (container-managed)'
    && labels[1] === 'JNDI lookups — proprietary namespace'
    && labels[2] === 'Hard-coded connection strings / driver URLs');
  OK('question text in modal === question text in YAML', block.querySelector('div').textContent === q.text);
  OK('JNDI is checked + carries the inherited label (archetype baseline)',
    radios[1].querySelector('input').checked
    && !!radios[1].querySelector('.pf-v6-c-label.pf-m-teal')
    && radios[1].querySelector('.pf-v6-c-label').textContent.includes('inherited'));
  OK('cohort-signal line intact (#45)', block.textContent.includes('Cohort signal: 14 of 18 members') && !!block.querySelector('.anno'));
  // YAML text and modal both come from the same string: agreement check against the drawer template
  const yaml = d.getElementById('tpl-drawer-qyaml').content.querySelector('.pf-v6-c-code-block__code').textContent;
  OK('every modal label appears verbatim in the YAML text', labels.every(l => yaml.includes(l)));
  // per-app override delta works
  w.eval("Q_FOCUS['invoicing'] = { q: 'lookup-service', sel: 'di', inherited: false, cohort: '' }");
  w.openAssessment('invoicing');
  const b2 = d.getElementById('modalAppBody');
  const r2 = [...b2.querySelectorAll('#qFocus .pf-v6-c-radio')];
  OK('per-app override: invoicing selects di, no inherited label, no cohort line',
    r2[0].querySelector('input').checked && !r2[0].querySelector('.pf-v6-c-label')
    && !b2.querySelector('#qFocus').textContent.includes('Cohort signal'));
  w.closeModals();
  console.log(fail === 0 ? 'ALL PASS (' + pass + ')' : 'FAILURES: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}, 400);
