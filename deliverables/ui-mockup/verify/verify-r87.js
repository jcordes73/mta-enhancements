const fs = require('fs');
const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
w.addEventListener('error', e => console.log('PAGE ERR:', e.message));
setTimeout(() => {
  const d = w.document;
  // row 87 (RHDS per-element guidelines): render the code-block drawer templates into the live DOM
  ['tpl-drawer-qyaml','tpl-drawer-wfyaml'].forEach(id => d.body.appendChild(d.getElementById(id).content.cloneNode(true)));
  const assert = (name, cond) => { if (!cond) global.__fails = (global.__fails || 0) + 1; console.log((cond ? 'OK  ' : 'FAIL') + ' ' + name); };
  /* Code block: toggle presence/state; the expand/collapse CLICK CYCLE is Chrome-verified
     (mock-live-r87d probe: collapsed->expanded, text Expand->Collapse, aria-expanded false->true,
     and back) — jsdom does not fire the inline onclick reliably for template-cloned content. */
  const toggles = d.querySelectorAll('.codeblock-toggle');
  assert('2 code-block toggles rendered', toggles.length === 2);
  const t = toggles[0];
  const pre = t.closest('.pf-v6-c-code-block').querySelector('pre');
  assert('collapsed by default', pre.classList.contains('codeblock-collapsed'));
  assert('aria-expanded=false initially', t.getAttribute('aria-expanded') === 'false');
  assert('>=5 lines (RHDS threshold)', pre.textContent.split('\n').length >= 5);
  // Menu dropdown: category switcher grouped to <=7 items per group (RHDS best practice)
  const groups = [...d.querySelectorAll('#invCatWrap .pf-v6-c-menu__group')];
  assert('3 menu groups', groups.length === 3);
  assert('all groups <=7 items', groups.every(g => g.querySelectorAll('.pf-v6-c-menu__item').length <= 7));
  assert('10 items total', groups.reduce((a,g) => a + g.querySelectorAll('.pf-v6-c-menu__item').length, 0) === 10);
  assert('group titles present', groups.map(g => g.querySelector('.pf-v6-c-menu__group-title').textContent.trim()).join(',') === 'Application,Environment,Assessment');
  // Menu dropdown: label-less (icon-only) compact toggles carry a descriptive aria-label
  const catBtn = d.querySelector('button.pf-v6-c-menu-toggle.pf-m-compact[aria-label="Filter category"]');
  assert('icon-only toggle aria-label', !!catBtn);
  const bare = [...d.querySelectorAll('.pf-v6-c-menu-toggle.pf-m-compact')].filter(b => !b.textContent.trim() && !b.querySelector('.pf-v6-c-menu-toggle__text'));
  assert('all label-less compact toggles have aria-label', bare.every(b => b.getAttribute('aria-label')));
  /* row 113 note: the archetype form's multi-select inputs are labeled by real
     <label for> associations (better than aria-label) — only truly label-less
     toolbar inputs (the inventory's 7) require aria-label here */
  assert('multi-select inputs labeled', [...d.querySelectorAll('.select-wrap input')].filter(i => i.type === 'text' && i.className === 'inv-multi-input').every(i => i.getAttribute('aria-label') || (i.labels && i.labels.length)));
  // Button: only one Primary per page (inventory)
  const btns = [...d.querySelectorAll('#scr-inventory button.pf-v6-c-button')].filter(b => b.textContent.includes('Import'));
  assert('Import is secondary now', btns.length === 1 && btns[0].classList.contains('pf-m-secondary'));
  // row-86 repair artifact: no stray apostrophes in static sort-indicator path data
  // Pagination: hidden on zero results (RHDS: "Pagination will not be displayed if a search returns zero results")
  d.getElementById('filter-name').value = 'zzz-no-match';
  w.invSearchApply();
  assert('zero-result search hides the pager', d.getElementById('invPag').hidden);
  assert('empty state shows instead', !w.eval('inv.empty.hidden'));
  d.getElementById('filter-name').value = '';
  w.invSearchApply();
  assert('pager returns for restored results', !d.getElementById('invPag').hidden);
  assert('path data clean', ![...d.querySelectorAll('.pf-v6-c-table__sort-indicator svg path')].some(p => p.getAttribute('d').includes("'")));
  console.log('DONE');
  process.exit(global.__fails ? 1 : 0);
}, 2500);
