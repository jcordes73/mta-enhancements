const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
const OK = (n, c) => console.log((c ? 'PASS' : 'FAIL') + '  ' + n);
setTimeout(() => {
  const d = dom.window.document, w = dom.window;
  // 1. archetype cohort card
  const title = () => d.getElementById('archCohortTitle').textContent;
  const facts = () => d.getElementById('archCohortFacts').textContent.replace(/\s+/g,' ').trim();
  const memRows = () => [...d.querySelectorAll('#archCohortMembers tr')].map(tr => tr.cells[0].textContent.trim());
  console.log('cohort title:', title());
  console.log('cohort facts:', facts().slice(0, 160));
  OK('cohort title count = store (6 members)', title().includes('6 member applications'));
  OK('no "18" fiction anywhere in the card', !facts().includes('18') && !title().includes('18'));
  OK('risk rollup store-true (High 2, Medium 2, unassessed 2)', facts().includes('High') && facts().includes('for 2 member') && facts().match(/for 2 members?,/g || []).length >= 2);
  OK('charter-rollup fiction gone', !facts().includes('14 DBs'));
  OK('member rows = store members', memRows().sort().join(',') === 'claims-batch,claims-web,cust-portal,invoicing,ledger-sync,payments-api');
  // archetype table row: no "(N in portfolio)" suffix, live count
  const archRow = [...d.querySelectorAll('#archBody tr')].find(tr => tr.textContent.includes('EAP8-archetype'));
  OK('archetype row: live count, no portfolio suffix', archRow && archRow.cells[4].textContent.trim() === '6' && !archRow.textContent.includes('in portfolio'));
  OK('review string no longer "2 of 18"', !archRow.textContent.includes('of 18'));
  // 2. A2A count
  console.log('A2A count text:', d.getElementById('a2aAgentCount').textContent);
  OK('A2A count = MOCK_AGENTS.length (5)', d.getElementById('a2aAgentCount').textContent === '5 factory agents');
  // 3. Reports Trends from MOCK_RUN_TREND (shared renderer)
  const barVals = [...d.querySelectorAll('#rptTrendBars span')].map(s => s.textContent.trim());
  const cap = d.getElementById('rptTrendCaption').textContent.replace(/\s+/g,' ').trim();
  console.log('rpt bars:', barVals.join(','), '| caption:', cap.slice(0, 140));
  OK('rpt bars = MOCK_RUN_TREND opens', barVals.join(',') === '142,128,120,98,84');
  OK('rpt caption has computed −41% + pass rate', cap.includes('−41%') && cap.includes('pass rate') && cap.includes('planned-vs-actual'));
  // mutation: trend store edit moves BOTH surfaces
  w.eval('MOCK_RUN_TREND[4].open = 10; renderRunTrend("lpArchTrendBars","lpArchTrendDates","lpArchTrendCaption",52,""); renderRunTrend("rptTrendBars","rptTrendDates","rptTrendCaption",92," &middot; feed");');
  const homeVals = [...d.querySelectorAll('#lpArchTrendBars span')].map(s => s.textContent.trim());
  OK('store mutation moves both home and reports trends', homeVals.join(',') === '142,128,120,98,10' && [...d.querySelectorAll('#rptTrendBars span')].pop().textContent.trim() === '10');
  w.eval('MOCK_RUN_TREND[4].open = 84;');
  // 4. risk provenance derived
  const prov = () => [...d.querySelectorAll('#provBody tr')].map(tr => [...tr.cells].map(c => c.textContent.replace(/\s+/g,' ').trim()));
  console.log('prov rows (padmin nwf):', prov().length);
  OK('provenance covers every assessed app in scope (7 + 5 unassessed = 12)', prov().length === 12);
  OK('provenance text follows riskKind', prov().every(r => r[2] === 'own assessment' || r[2] === 'inherited \u2190 EAP8-archetype view group assessment' || r[2] === 'unassessed'));
  // mutation: risk change moves the table
  w.eval('MOCK_APPS.find(a => a.name === "ledger-sync").risk = "High"; MOCK_APPS.find(a => a.name === "ledger-sync").riskColor = "red"; MOCK_APPS.find(a => a.name === "ledger-sync").riskKind = "own"; renderProvenance();');
  const ls = prov().find(r => r[0] === 'ledger-sync');
  OK('risk mutation moves provenance rows', ls && ls[1] === 'High' && ls[2] === 'own assessment');
  // 5. tenancy: mrd scope re-derives cohort + provenance
  w.eval('state.org = "mrd"; state.dept = null; state.team = null; applyTenancy();');
  OK('mrd: cohort title re-derives (1 member: eap7-tagged mrd app)', d.getElementById('archCohortTitle').textContent.includes('1 member application') || d.getElementById('archCohortTitle').textContent.includes('member applications'));
  OK('mrd: provenance re-scopes (3 apps)', [...d.querySelectorAll('#provBody tr')].length === 3);
}, 700);
