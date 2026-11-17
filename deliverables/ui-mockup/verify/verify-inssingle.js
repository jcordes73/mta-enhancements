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

  // ---- boot: the All-insights tab still renders; the sub-tab bar exists ----
  OK('sub-tab bar with the live two tabs (All insights / Single application)',
    !!d.getElementById('tab-ins-all') && !!d.getElementById('tab-ins-single')
    && d.getElementById('tab-ins-all').textContent.includes('All insights')
    && d.getElementById('tab-ins-single').textContent.includes('Single application'));
  OK('the All-insights table renders unchanged inside panel-ins-all',
    !d.getElementById('panel-ins-all').hidden && d.querySelectorAll('#panel-ins-all tr[data-insight]').length === 3);

  // ---- switch to Single application ----
  d.getElementById('tab-ins-single').click();
  OK('sub-tab switch: single panel visible, all panel hidden',
    !d.getElementById('panel-ins-single').hidden && d.getElementById('panel-ins-all').hidden);
  OK('live empty state before an application is picked (two lines, verbatim)',
    !d.getElementById('insSingleEmpty').hidden
    && d.getElementById('insSingleEmpty').textContent.includes('Select application from filter menu')
    && d.getElementById('insSingleEmpty').textContent.includes('Use the filter menu above to select your application.')
    && d.getElementById('insSingleTable').hidden);
  OK('application menu lists exactly the applications the insights affect (5 apps)',
    d.getElementById('insAppMenu').querySelectorAll('.pf-v6-c-menu__item').length === 5);
  OK('category menu mirrors the All-tab categories (3)',
    d.getElementById('insCatMenu').querySelectorAll('.pf-v6-c-menu__item').length === 3);

  // ---- pick an application with two... one insight ----
  const payOpt = [...d.getElementById('insAppMenu').querySelectorAll('.pf-v6-c-menu__item')].find(o => o.textContent.trim() === 'payments-api');
  payOpt.click();
  const rows = [...d.getElementById('insSingleBody').querySelectorAll('tr')];
  OK('payments-api renders its insight row with the live single-app column set',
    !d.getElementById('insSingleTable').hidden && rows.length === 1 && rows[0].children.length === 5
    && [...d.querySelectorAll('#insSingleTable th')].map(th => th.textContent.trim()).join('|') === 'Insight|Category|Source|Target(s)|Affected files');
  OK('the row carries the live Affected files (code paths) — the depth the All view lacks',
    rows[0].children[4].innerHTML.includes('PaymentGatewayClient.java') && rows[0].children[4].innerHTML.includes('application.properties'));
  OK('the row is the SAME insight record (identity follows the All-tab row, row-14 lesson) and stays drillable',
    rows[0].dataset.title === 'Hard-coded hostnames and IP addresses' && rows[0].classList.contains('pf-m-clickable') && !!rows[0].getAttribute('onclick'));

  // ---- category filter ----
  const techOpt = [...d.getElementById('insCatMenu').querySelectorAll('.pf-v6-c-menu__item')].find(o => o.textContent.trim() === 'Technology usage');
  techOpt.click();
  OK('category filter empties the table with a muted no-match line (payments-api has no Technology-usage insight)',
    d.getElementById('insSingleBody').textContent.includes('No insights for this application under the current category filter'));
  const cloudOpt = [...d.getElementById('insCatMenu').querySelectorAll('.pf-v6-c-menu__item')].find(o => o.textContent.trim() === 'Cloud readiness');
  cloudOpt.click();
  OK('matching category restores the row', d.getElementById('insSingleBody').textContent.includes('Hard-coded hostnames'));

  // ---- assessment-sourced insight renders the honest no-files note ----
  const riskOpt = [...d.getElementById('insAppMenu').querySelectorAll('.pf-v6-c-menu__item')].find(o => o.textContent.trim() === 'risk-scoring');
  riskOpt.click();
  const testOpt = [...d.getElementById('insCatMenu').querySelectorAll('.pf-v6-c-menu__item')].find(o => o.textContent.trim() === 'Testing');
  testOpt.click();
  OK('risk-scoring (assessment-sourced) renders the no-files note, not fake paths',
    d.getElementById('insSingleBody').textContent.includes('assessment answer, not a file'));

  // ---- deep link (&sub=single) ----
  w.eval("state.scr = 'incidents'; state.incTab = 'insights'; state.insSub = 'single'; syncHash();");
  OK('syncHash emits &sub=single on the insights tab', w.eval('location.hash').includes('sub=single'));

  // ---- back to All ----
  d.getElementById('tab-ins-all').click();
  OK('switching back shows the All table again', !d.getElementById('panel-ins-all').hidden && d.getElementById('panel-ins-single').hidden);

  console.log(fail === 0 ? 'ALL PASS (' + pass + ')' : 'FAILURES: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}, 400);
