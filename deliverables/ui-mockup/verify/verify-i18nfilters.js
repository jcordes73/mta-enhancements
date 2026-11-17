const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const OK = (n, c) => console.log((c ? 'PASS' : 'FAIL') + '  ' + n);
const mk = (lang) => {
  const dom = new JSDOM(html, { url: 'http://localhost/mock.html' + (lang ? '#lang=' + lang : ''), runScripts: 'dangerously', pretendToBeVisual: true });
  return new Promise(res => setTimeout(() => res(dom.window), 900));
};
(async () => {
  // EN baseline: unchanged behavior
  let w = await mk('');
  let d = w.document;
  w.setPersona('migrator', true); w.show('incidents');
  await new Promise(r => setTimeout(r, 150));
  let vis = () => [...d.querySelectorAll('#incQueueBody tr[data-app]')].filter(tr => tr.style.display !== 'none');
  OK('EN: incidents boot 9 rows', vis().length === 9);
  // pick "State: In progress" via the canonical path (click the menu item button)
  const incItem = [...d.querySelectorAll('#incStateWrap .pf-v6-c-menu__item')].find(b => b.querySelector('[data-value]').dataset.value === 'In progress');
  incItem.click();
  await new Promise(r => setTimeout(r, 80));
  OK('EN: State=In progress -> 1 row (invoicing WebLogic)', vis().length === 1 && vis()[0].dataset.app === 'invoicing');
  w.show('tasks');
  await new Promise(r => setTimeout(r, 100));
  let tvis = () => [...d.querySelectorAll('#taskBody tr[data-app]')].filter(tr => tr.style.display !== 'none');
  OK('EN: tasks queue has rows', tvis().length > 0);
  const appItem = [...d.querySelectorAll('#taskAppWrap .pf-v6-c-menu__item')].find(b => b.querySelector('[data-value]').dataset.value === 'invoicing');
  appItem.click();
  await new Promise(r => setTimeout(r, 80));
  OK('EN: tasks app=invoicing filters', tvis().length > 0 && tvis().every(tr => tr.dataset.app === 'invoicing'));
  w.eval('pickOption(document.querySelector("#taskAppWrap .pf-v6-c-menu"), document.querySelector("#taskAppText"), [...document.querySelectorAll("#taskAppWrap .pf-v6-c-menu__item")][0]); taskApplyFilters();');
  await new Promise(r => setTimeout(r, 80));
  OK('EN: tasks back to All', tvis().length > 1);

  // DE: the reported defect — filters must work under translation
  w = await mk('de');
  d = w.document;
  w.setPersona('migrator', true); w.show('incidents');
  await new Promise(r => setTimeout(r, 150));
  vis = () => [...d.querySelectorAll('#incQueueBody tr[data-app]')].filter(tr => tr.style.display !== 'none');
  OK('DE: incidents boot 9 rows (was 0 of 0)', vis().length === 9);
  OK('DE: toggle shows translated text', d.querySelector('#incStateWrap .pf-v6-c-menu-toggle__text').textContent.includes('Status'));
  const incItemDe = [...d.querySelectorAll('#incStateWrap .pf-v6-c-menu__item')].find(b => b.querySelector('[data-value]').dataset.value === 'In progress');
  incItemDe.click();
  await new Promise(r => setTimeout(r, 80));
  OK('DE: State=In progress (translated label) -> 1 row', vis().length === 1 && vis()[0].dataset.app === 'invoicing');
  OK('DE: footer honest', d.getElementById('incPgTotal').textContent === '1');
  w.show('tasks');
  await new Promise(r => setTimeout(r, 100));
  tvis = () => [...d.querySelectorAll('#taskBody tr[data-app]')].filter(tr => tr.style.display !== 'none');
  OK('DE: tasks queue has rows (was 0)', tvis().length > 0);
  const appItemDe = [...d.querySelectorAll('#taskAppWrap .pf-v6-c-menu__item')].find(b => b.querySelector('[data-value]').dataset.value === 'invoicing');
  appItemDe.click();
  await new Promise(r => setTimeout(r, 80));
  OK('DE: tasks app filter works under translation', tvis().length > 0 && tvis().every(tr => tr.dataset.app === 'invoicing'));
  process.exit(0);
})().catch(e => { console.log('ERROR', e.message); process.exit(1); });
