/* Defect rows 141–143 — Review.md triage fixes (2026-11-18):
   141: a deep link into an un-ticketed app (showIncidentsForApp) left the default
        "Assigned to me" chip on, and the mine rule (WAVE_TICKETS membership) zeroed the
        very queue the link promised — claims-batch "88 incidents" → empty. The deep link
        now relaxes the mine chip when the target app stays pool triage; ticketed apps
        keep the chip untouched.
   142: the Insights Single-application category menu had no "All" option — once a
        category was picked the unfiltered view was unreachable. "All categories" now
        heads the menu (data-value "", exact dict key in all 9 non-EN locales).
   143: the hard-coded-hostnames insight row listed claims-batch as plain text while its
        sibling applications were links — inconsistent; now a link like the others. */
const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
let pass = 0, fail = 0;
const OK = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); c ? pass++ : fail++; };
setTimeout(() => {
  const d = dom.window.document, w = dom.window;
  w.setPersona('architect');
  w.show('incidents');

  // ---- row 141: claims-batch deep link ----
  OK('mine chip is the on default (architect)', d.getElementById('incMineChip').classList.contains('on'));
  w.eval('showIncidentsForApp("claims-batch")');
  OK('app chip set to claims-batch', d.getElementById('incAppChip') && d.getElementById('incAppChip').dataset.app === 'claims-batch');
  OK('deep link into un-ticketed claims-batch relaxes the mine chip (row 141)', !d.getElementById('incMineChip').classList.contains('on'));
  const vis = () => [...d.querySelectorAll('#incQueueBody tr[data-app]')].filter(tr => tr.style.display !== 'none');
  const batchVis = vis().filter(tr => tr.dataset.app === 'claims-batch');
  OK('the promised claims-batch queue is actually visible (' + batchVis.length + ' rows, was 0)', batchVis.length > 0
    && vis().every(tr => tr.dataset.app === 'claims-batch'));
  // ticketed app: the chip stays untouched
  d.getElementById('incMineChip').classList.add('on');
  w.eval('showIncidentsForApp("payments-api")');
  OK('ticketed app (payments-api) keeps the mine chip on', d.getElementById('incMineChip').classList.contains('on')
    && vis().every(tr => tr.dataset.app === 'payments-api') && vis().length > 0);
  w.eval('const c = document.getElementById("incAppChip"); if (c) c.remove(); incApplyFilters();');

  // ---- row 143: claims-batch is a link in the All-insights row ----
  const appsCell = d.querySelector('#panel-ins-all tr[data-insight="hardcoded"]').children[4];
  const links = [...appsCell.querySelectorAll('a')].map(a => a.textContent.trim());
  OK('all three applications in the hard-coded-hostnames row are links (row 143)',
    links.join(',') === 'payments-api,invoicing,claims-batch'
    && !!appsCell.querySelector('a[onclick*="openApp(\'claims-batch\')"]'));

  // ---- row 142: All categories option ----
  d.getElementById('tab-ins-single').click();
  const payOpt = [...d.getElementById('insAppMenu').querySelectorAll('.pf-v6-c-menu__item')].find(o => o.textContent.trim() === 'payments-api');
  payOpt.click();
  const techOpt = [...d.getElementById('insCatMenu').querySelectorAll('.pf-v6-c-menu__item')].find(o => o.textContent.trim() === 'Technology usage');
  techOpt.click();
  OK('zero-match category filter renders the no-match line (row 144 wording)',
    d.getElementById('insSingleBody').textContent.includes('No insights match the current filters'));
  const allOpt = [...d.getElementById('insCatMenu').querySelectorAll('.pf-v6-c-menu__item')].find(o => o.textContent.trim() === 'All categories');
  OK('All categories heads the menu with data-value "" (row 142)', !!allOpt
    && allOpt.querySelector('.pf-v6-c-menu__item-text').dataset.value === '');
  allOpt.click();
  OK('picking All categories restores the rows and resets the canonical value',
    d.getElementById('insSingleBody').textContent.includes('Hard-coded hostnames')
    && d.getElementById('insCatWrap').dataset.value === ''
    && !d.getElementById('insSingleTable').hidden);

  // ---- i18n: the new chrome string has exact dict keys in every non-EN locale (spot: de, ja) ----
  w.eval('setLang("de")');
  OK('DE renders the exact key "Alle Kategorien"', allOpt.textContent.trim() === 'Alle Kategorien');
  w.eval('setLang("ja")');
  OK('JA renders the exact key "すべてのカテゴリ"', allOpt.textContent.trim() === 'すべてのカテゴリ');
  w.eval('setLang("en")');

  console.log(fail === 0 ? 'ALL PASS (' + pass + ')' : 'FAILURES: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}, 400);
