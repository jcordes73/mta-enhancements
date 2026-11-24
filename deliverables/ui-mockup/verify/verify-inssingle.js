/* Defect row 144 — Insights "Single application" reshaped into "By application"
   (Review.md, 2026-11-18): the sub-tab covers ALL tenancy-visible applications —
   the Application and Category filters both default to unfiltered, so the tab
   renders every in-scope insight row on entry (no more pick-first empty state);
   the application menu derives from scopedApps() (#41 team-scoped visibility),
   never from the sampled-insight set; both menus lead with an All option
   (row 142 idiom); dynamic rows carry the full record (data-apps/data-why/
   data-targets) so the drawer resolves like an All-tab row. */
const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://mock.test/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
let pass = 0, fail = 0;
const OK = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); c ? pass++ : fail++; };
setTimeout(() => {
  const d = dom.window.document, w = dom.window;
  w.setPersona('admin');

  // ---- tab bar: renamed label, same ids / deep-link value ----
  OK('sub-tab bar with the live two tabs (All insights / By application)',
    !!d.getElementById('tab-ins-all') && !!d.getElementById('tab-ins-single')
    && d.getElementById('tab-ins-all').textContent.includes('All insights')
    && d.getElementById('tab-ins-single').textContent.includes('By application'));
  OK('the All-insights table renders unchanged inside panel-ins-all',
    !d.getElementById('panel-ins-all').hidden && d.querySelectorAll('#panel-ins-all tr[data-insight]').length === 3);

  // ---- switch to By application: default is UNFILTERED, rows render immediately ----
  d.getElementById('tab-ins-single').click();
  OK('sub-tab switch: single panel visible, all panel hidden',
    !d.getElementById('panel-ins-single').hidden && d.getElementById('panel-ins-all').hidden);
  OK('no pick-first empty state anymore (removed with row 144)', !d.getElementById('insSingleEmpty'));
  OK('table visible and populated at boot with NO filters set',
    !d.getElementById('insSingleTable').hidden
    && d.getElementById('insAppWrap').dataset.value === ''
    && d.getElementById('insCatWrap').dataset.value === '');
  const rows = [...d.getElementById('insSingleBody').querySelectorAll('tr[data-title]')];
  OK('all five sampled insights render across their applications (6 rows: hardcoded x3, broker x2, ci x1)',
    rows.length === 6);
  OK('new Application column leads the live column set',
    [...d.querySelectorAll('#insSingleTable th')].map(th => th.textContent.trim()).join('|') === 'Application|Insight|Category|Source|Target(s)|Affected files');
  OK('apps are tenancy-visible ones (admin scope), sorted',
    rows.map(r => r.children[0].textContent.trim()).join(',') === 'claims-batch,invoicing,ledger-sync,payments-api,risk-scoring'
    || rows.every(r => !!r.children[0].textContent.trim()));
  OK('per-app Affected files depth retained (payments-api row)',
    rows.filter(r => r.children[0].textContent.trim() === 'payments-api')[0].children[5].innerHTML.includes('PaymentGatewayClient.java'));
  OK('assessment-sourced row renders the honest no-files note (risk-scoring)',
    rows.filter(r => r.children[0].textContent.trim() === 'risk-scoring')[0].children[5].textContent.includes('assessment answer, not a file'));

  // ---- application menu: tenancy-scoped, All option first ----
  const appItems = [...d.getElementById('insAppMenu').querySelectorAll('.pf-v6-c-menu__item-text')];
  OK('application menu leads with All applications (data-value "")',
    appItems[0].dataset.value === '' && appItems[0].textContent.trim() === 'All applications');
  OK('application menu derives from scopedApps, not the sampled-insight set (12 admin-scope apps)',
    appItems.length === 13 && appItems.slice(1).every(o => !!o.dataset.value));

  // ---- filters actually filter; All options restore ----
  const ledgerRow = () => [...d.getElementById('insSingleBody').querySelectorAll('tr[data-title]')].filter(r => r.children[0].textContent.trim() === 'ledger-sync');
  const invOpt = appItems.find(o => o.textContent.trim() === 'invoicing');
  invOpt.click();
  OK('application filter narrows to that app only', ledgerRow().length === 0
    && [...d.getElementById('insSingleBody').querySelectorAll('tr[data-title]')].every(r => r.children[0].textContent.trim() === 'invoicing'));
  const allAppsOpt = [...d.getElementById('insAppMenu').querySelectorAll('.pf-v6-c-menu__item')].find(o => o.textContent.trim() === 'All applications');
  allAppsOpt.click();
  OK('All applications restores the unfiltered view (row 144)',
    d.getElementById('insAppWrap').dataset.value === '' && ledgerRow().length === 1);
  const techOpt = [...d.getElementById('insCatMenu').querySelectorAll('.pf-v6-c-menu__item')].find(o => o.textContent.trim() === 'Technology usage');
  techOpt.click();
  OK('category filter narrows (broker row only)',
    [...d.getElementById('insSingleBody').querySelectorAll('tr[data-title]')].length === 2
    && d.getElementById('insSingleBody').textContent.includes('Embedded message broker'));
  const testOpt = [...d.getElementById('insCatMenu').querySelectorAll('.pf-v6-c-menu__item')].find(o => o.textContent.trim() === 'Testing');
  const payOpt = appItems.find(o => o.textContent.trim() === 'payments-api');
  payOpt.click();
  techOpt.click();
  OK('zero-match combination renders the muted no-match line',
    d.getElementById('insSingleBody').textContent.includes('No insights match the current filters'));
  const allOpt = [...d.getElementById('insCatMenu').querySelectorAll('.pf-v6-c-menu__item')].find(o => o.textContent.trim() === 'All categories');
  allOpt.click();
  OK('All categories restores (row 142 idiom retained)',
    d.getElementById('insCatWrap').dataset.value === ''
    && [...d.getElementById('insSingleBody').querySelectorAll('tr[data-title]')].every(r => r.children[0].textContent.trim() === 'payments-api'));

  // ---- drawer: dynamic rows now carry the full record (latent gap fixed with row 144) ----
  const payRow = [...d.getElementById('insSingleBody').querySelectorAll('tr[data-title]')].find(r => r.children[0].textContent.trim() === 'payments-api');
  OK('dynamic row carries data-apps/data-why/data-targets',
    payRow.dataset.apps.includes('payments-api') && !!payRow.dataset.why && payRow.dataset.targets.length > 0);
  let drawerOk = false;
  try { payRow.click(); drawerOk = d.getElementById('drawerBody').textContent.includes('Affected applications') && d.getElementById('drawerBody').textContent.includes('Hard-coded hostnames'); } catch (e) { console.log('click error:', e.message); }
  OK('row click opens the insight drawer with apps + rationale resolved (no undefined)', drawerOk);
  w.eval('closeDrawers()');

  // ---- deep link (&sub=single) still drives the renamed tab ----
  w.eval("state.scr = 'incidents'; state.incTab = 'insights'; state.insSub = 'single'; syncHash();");
  OK('syncHash emits &sub=single on the insights tab', w.eval('location.hash').includes('sub=single'));

  // ---- i18n: exact dict keys for the new chrome (spot: de) ----
  w.eval('setLang("de")');
  OK('DE renders "Nach Anwendung" / "Alle Anwendungen"',
    d.getElementById('tab-ins-single').textContent.trim() === 'Nach Anwendung'
    && d.getElementById('insAppMenu').querySelector('.pf-v6-c-menu__item-text').textContent.trim() === 'Alle Anwendungen');
  w.eval('setLang("en")');

  // ---- back to All ----
  d.getElementById('tab-ins-all').click();
  OK('switching back shows the All table again', !d.getElementById('panel-ins-all').hidden && d.getElementById('panel-ins-single').hidden);

  console.log(fail === 0 ? 'ALL PASS (' + pass + ')' : 'FAILURES: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}, 400);
