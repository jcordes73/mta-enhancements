const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
const OK = (n, c) => console.log((c ? 'PASS' : 'FAIL') + '  ' + n);
setTimeout(() => {
  const d = dom.window.document, w = dom.window;
  // 1. queue an app the way the bulk action does (select its checkbox, then bulkQueueAnalysis)
  const name = 'billing-worker';   // Not started in the seed
  w.eval('MOCK_APPS.find(a => a.name === "' + name + '").state'); // sanity
  const cb = [...d.querySelectorAll('#invBody input[type=checkbox]')].find(c => c.closest('tr').dataset.name === name);
  cb.checked = true; cb.dispatchEvent(new dom.window.Event('change'));
  w.eval('bulkQueueAnalysis()');
  OK('bulk queue: app state = queued', w.eval('MOCK_APPS.find(a => a.name === "' + name + '").state') === 'queued');
  OK('bulk queue: prevState remembered (notstarted)', w.eval('MOCK_APPS.find(a => a.name === "' + name + '").prevState') === 'notstarted');
  const taskId = w.eval('MOCK_APPS.find(a => a.name === "' + name + '").queuedTaskId');
  OK('bulk queue: task id remembered (' + taskId + ')', typeof taskId === 'number');
  OK('task row exists in Task manager', !!d.querySelector('#taskBody tr[data-id="' + taskId + '"][data-state="Queued"]'));
  let row = [...d.querySelectorAll('#invBody tr')].find(r => r.dataset.name === name);
  OK('row Analysis cell shows Queued + dequeue link', /Queued/.test(row.cells[4].textContent) && !!row.cells[4].querySelector('a'));
  // 2. dequeue via the row link
  row.cells[4].querySelector('a').click();
  OK('dequeue: app state restored to notstarted', w.eval('MOCK_APPS.find(a => a.name === "' + name + '").state') === 'notstarted');
  OK('dequeue: prevState/queuedTaskId cleared', w.eval('var a = MOCK_APPS.find(a => a.name === "' + name + '"); a.prevState === undefined && a.queuedTaskId === undefined'));
  OK('dequeue: waiting task row removed', !d.querySelector('#taskBody tr[data-id="' + taskId + '"]'));
  row = [...d.querySelectorAll('#invBody tr')].find(r => r.dataset.name === name);
  OK('dequeue: row shows Not started, no dequeue link', /Not started/.test(row.cells[4].textContent) && !row.cells[4].querySelector('a'));
  // 3. dequeue restores a SUCCEEDED pre-queue state
  const name2 = 'cust-portal';   // Succeeded in the seed
  const cb2 = [...d.querySelectorAll('#invBody input[type=checkbox]')].find(c => c.closest('tr').dataset.name === name2);
  cb2.checked = true; cb2.dispatchEvent(new dom.window.Event('change'));
  w.eval('bulkQueueAnalysis()');
  OK('queue succeeded app: state queued, prevState succeeded', w.eval('var a = MOCK_APPS.find(a => a.name === "' + name2 + '"); a.state === "queued" && a.prevState === "succeeded"'));
  w.eval('dequeueAnalysis("' + name2 + '")');
  OK('dequeue succeeded app: back to Succeeded (results still current)', w.eval('MOCK_APPS.find(a => a.name === "' + name2 + '").state') === 'succeeded');
  // 4. modal affordance: queued app shows Dequeue button, not the disabled Queue analysis
  const name3 = 'docs-portal';   // Not started
  w.eval('MOCK_APPS.find(a => a.name === "' + name3 + '").state = "queued"; MOCK_APPS.find(a => a.name === "' + name3 + '").prevState = "notstarted"; renderInventory();');
  row = [...d.querySelectorAll('#invBody tr')].find(r => r.dataset.name === name3);
  row.click();   // opens the application modal (openAppRow)
  const modalBtns = [...d.querySelectorAll('#modalAppBody button')].map(b => b.textContent.trim());
  OK('modal on queued app: Dequeue button present', modalBtns.includes('Dequeue'));
  OK('modal on queued app: no disabled "Queue analysis" primary', !modalBtns.includes('Queue analysis'));
  d.querySelector('#modalAppBody button.pf-m-secondary'); // exists
  [...d.querySelectorAll('#modalAppBody button')].find(b => b.textContent.trim() === 'Dequeue').click();
  OK('modal dequeue: state restored + modal closed', w.eval('MOCK_APPS.find(a => a.name === "' + name3 + '").state') === 'notstarted' && d.getElementById('modalApp').hidden);
  // 5. RBAC: pm (no applications:analyze, team-locked to Claims) — the row link is rbac-disabled and the function no-ops
  w.eval('setPersona("pm")');
  w.eval('MOCK_APPS.find(a => a.name === "claims-batch").state = "queued"; MOCK_APPS.find(a => a.name === "claims-batch").prevState = "notstarted"; renderInventory(); applyRbac();');
  row = [...d.querySelectorAll('#invBody tr')].find(r => r.dataset.name === 'claims-batch');
  const link = row.cells[4].querySelector('a');
  OK('pm: dequeue link rbac-disabled (pointer-events none)', link && link.classList.contains('rbac-disabled'));
  w.eval('dequeueAnalysis("claims-batch")');
  OK('pm: dequeueAnalysis call no-ops (still queued)', w.eval('MOCK_APPS.find(a => a.name === "claims-batch").state') === 'queued');
  console.log('dequeue probe done');
}, 900);
