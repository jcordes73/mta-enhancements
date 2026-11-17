const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
const OK = (n, c) => console.log((c ? 'PASS' : 'FAIL') + '  ' + n);
setTimeout(async () => {
  const d = dom.window.document, w = dom.window;
  w.setPersona('admin', true);
  const waveLine = () => [...d.querySelectorAll('#lpAdmStatus li')][0].textContent.replace(/\s+/g,' ').trim();
  const tqLine = () => [...d.querySelectorAll('#lpAdmStatus li')][3].textContent.replace(/\s+/g,' ').trim();
  console.log('=== nwf boot ==='); console.log('  ', waveLine()); console.log('  ', tqLine());
  OK('Wave 3 named with live facts', waveLine().includes("Wave 3\u2019s gate is failing (2 open tickets, 2 of 9 suites red, 1 credential expiring (svn-read-key))"));
  OK('Wave 4 named too (was Wave-4-blind)', waveLine().includes("Wave 4\u2019s gate is failing"));
  OK('task queue line = 4 (nwf truth)', tqLine().includes('4 queued'));
  // mrd: no waves -> no gate clause; task count scoped
  w.eval('state.org = "mrd"; state.dept = null; state.team = null; applyTenancy();');
  console.log('=== mrd (org with no waves) ==='); console.log('  ', waveLine()); console.log('  ', tqLine());
  OK('no gate clause for an org with no waves', !waveLine().includes('gate'));
  OK('task badge scoped (mrd has 0 queued nwf-leak fixed)', d.getElementById('taskQueueCount').textContent === '0');
  OK('task line honest under mrd', tqLine().includes('0 queued'));
  const visTasks = [...d.querySelectorAll('#taskBody tr[data-app]')].filter(tr => tr.style.display !== 'none');
  OK('tasks screen rows scoped (no nwf tasks visible under mrd)', visTasks.length === 0);
  // back to nwf: Wave-4-blindness fix proven by making Wave 3 pass
  w.eval('state.org = "nwf"; applyTenancy();');
  w.eval('WAVE_EVIDENCE["invoicing"] = { cov: "1 DB", total: 3, run: 3, red: 0 };');
  w.eval('["invoicing","payments-api","claims-web","risk-scoring"].forEach(k => { if (WAVE_TICKETS[k]) WAVE_TICKETS[k].outcome = "closed"; });');
  w.eval('renderAdminLanding();');
  console.log('=== nwf with tickets closed + evidence green ==='); console.log('  ', waveLine());
  OK('both waves still reported store-true (credential gate reasons now visible)', waveLine().includes("Wave 3\u2019s gate is failing") && waveLine().includes("Wave 4\u2019s gate is failing (2 quota-blocked)"));
  OK('credential reasons appear in the phrase (Waves-screen vocabulary)', waveLine().includes('expiring (') || waveLine().includes('unverified in use ('));
  // now make Wave 3 truly pass: rotate the expiring credential + verify the unverified one
  w.eval('CREDS.forEach(c => { if (c.expLabel === "expiring") { c.expLabel = "ok"; c.expColor = "green"; } if (c.verifiedLabel === "unverified") { c.verifiedLabel = "verified"; } }); renderAdminLanding();');
  console.log('  ', waveLine());
  OK('Wave 3 passing is reported while Wave 4 stays failing (blindness fixed)', !waveLine().includes("Wave 3") && waveLine().includes("Wave 4\u2019s gate is failing (2 quota-blocked)"));
  // all gates pass -> the passing branch
  w.eval('Object.values(WAVE_TICKETS).forEach(t => t.outcome = "closed"); CREDS.forEach(c => { c.expLabel = "ok"; c.expColor = "green"; c.verifiedLabel = "verified"; }); MOCK_APPS.forEach(a => { if (a.state === "quota") a.state = "succeeded"; }); renderAdminLanding();');
  console.log('  ', waveLine());
  OK('"both wave gates passing" branch', waveLine().includes('both wave gates passing'));
  // reactivity: queue an app into a wave -> waved count moves (store-driven still)
  w.eval('MOCK_APPS.find(a => a.name === "billing-worker").wave = "4"; renderAdminLanding();');
  OK('wave assignment CRUD moves the count', waveLine().includes('10 of 12'));
  w.eval('MOCK_APPS.find(a => a.name === "billing-worker").wave = "";');

  // #60: per-gateway token rate — the monetary amount assigned to token usage, editable on the Automation card
  const gwCell = (i) => [...d.getElementById('gwUseBody').querySelectorAll('tr')][i].cells[6].textContent.replace(/\s+/g, ' ').trim();   /* row 122: CA trust column shifted the rate cell 5→6 */
  const gwInput = (i) => [...d.getElementById('gwUseBody').querySelectorAll('tr')][i].querySelector('input[type=number]');
  OK('token rate: derived default costs (tokens × rate)', gwCell(0).startsWith('$86.40') && gwCell(1).startsWith('$54.10'));
  OK('token rate: per-gateway inputs with aria labels', !!gwInput(0) && !!gwInput(1)
    && gwInput(0).getAttribute('aria-label').includes('llm-gateway-1') && gwInput(0).value === '2.0971');
  gwInput(1).value = '10';
  gwInput(1).dispatchEvent(new w.Event('change'));
  OK('token rate: editing re-prices that gateway only', gwCell(1).startsWith('$98.00') && gwCell(0).startsWith('$86.40')
    && w.eval("MOCK_GATEWAYS.find(g=>g.name==='llm-gateway-2').rate") === '10'
    && [...d.getElementById('gwUseBody').querySelectorAll('tr')][1].querySelector('input[type=number]').value === '10');
  const i0 = [...d.getElementById('gwUseBody').querySelectorAll('tr')][0].querySelector('input[type=number]');
  i0.value = '4'; i0.dispatchEvent(new w.Event('change'));
  OK('token rate: second edit applies and empty input keeps the store value', (() => {
    i0.value = ''; i0.dispatchEvent(new w.Event('change'));
    return w.eval("MOCK_GATEWAYS.find(g=>g.name==='llm-gateway-1').rate") === '4';
  })());
  w.eval("MOCK_GATEWAYS[0].rate = '2.0971'; renderGateways();");   /* restore the shipped rate */

  // #62: currency override — Auto (country-derived, USD default) or a fixed currency; persisted + &cur= deep link
  const sel62 = d.getElementById('curOverride');
  const cost62 = () => [...d.getElementById('gwUseBody').querySelectorAll('tr')][0].cells[6].textContent.trim().slice(0, 12);   /* row 122: CA trust column shifted the rate cell 5→6 */
  OK('currency override: select present with Auto + 8 currencies (row 121 added BRL)', !!sel62 && [...sel62.options].length === 9
    && sel62.options[0].textContent === 'Auto (USD)' && sel62.value === 'auto');
  sel62.value = 'GBP';
  sel62.dispatchEvent(new w.Event('change'));
  await new Promise(r => setTimeout(r, 90));   /* the observer re-walks asynchronously */
  OK('currency override: GBP re-prices the page and lands in the hash', cost62().startsWith('\u00a368.26')
    && w.eval('state.cur') === 'GBP' && w.location.hash.includes('cur=GBP'));
  w.setLang('de');
  await new Promise(r => setTimeout(r, 90));
  OK('currency override: fixed GBP survives a language switch (Auto relabels to EUR)', cost62().startsWith('\u00a368.26')
    && sel62.options[0].textContent === 'Auto (EUR)' && sel62.value === 'GBP');
  sel62.value = 'auto';
  sel62.dispatchEvent(new w.Event('change'));
  await new Promise(r => setTimeout(r, 90));
  OK('currency override: Auto falls back to the derived EUR (79,49 €)', cost62().includes('79,49')
    && w.eval('state.cur') === null);
  w.setLang('en');
}, 500);
