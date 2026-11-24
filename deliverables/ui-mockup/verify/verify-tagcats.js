const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
let pass = 0, fail = 0;
const OK = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); c ? pass++ : fail++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function boot(hash) {
  const dom = new JSDOM(html, { url: 'http://mock.test/mock.html' + (hash || ''), runScripts: 'dangerously', pretendToBeVisual: true });
  dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
  return dom;
}

(async () => {
  const d0 = boot();
  await sleep(400);
  const d = d0.window.document, w = d0.window;
  w.setPersona('admin');
  w.show('config');

  // ---- structure: Landscape has 3 tabs, Tag categories is the third card ----
  const pane = d.getElementById('panel-ctrl-landscape');
  const tabs = [...pane.querySelectorAll(':scope > .pf-v6-c-tabs .pf-v6-c-tabs__link[data-card]')];
  OK('Landscape pane has 3 tabs ending in "Tag categories"',
    tabs.length === 3 && tabs[2].textContent.trim() === 'Tag categories');
  const catCard = d.getElementById('cfgcp-landscape-3');
  OK('Tag categories card carries the same tags:create RBAC scope as Add tag',
    !!d.querySelector('#cfgcp-landscape-3 button[data-rbac="tags:create"]'));
  OK('Add tag button mirrors it', !!d.querySelector('#cfgcp-landscape-2 button[data-rbac="tags:create"]'));

  // ---- default render: 5 seeded categories with tag-reference counts ----
  tabs[2].click();
  const rows = () => [...d.querySelectorAll('#ctrlTagCatsBody tr')].map(r => r.querySelector('td').textContent.trim());
  OK('5 seeded categories render (Runtime/Framework/Build/Initiative/Workflow)',
    rows().join(',') === 'Runtime,Framework,Build,Initiative,Workflow');
  const countOf = c => { const r = [...d.querySelectorAll('#ctrlTagCatsBody tr')].find(r => r.querySelector('td').textContent.trim() === c); return r ? +r.querySelectorAll('td')[1].textContent : -1; };
  OK('reference counts from the tag store (Runtime=4, Framework=1)',
    countOf('Runtime') === 4 && countOf('Framework') === 1 && countOf('Workflow') === 1);

  // ---- tag modal references the store: select, not free text ----
  OK('tag modal category field is a select populated from the managed store',
    d.getElementById('ctrlTagCat').tagName === 'SELECT'
    && [...d.getElementById('ctrlTagCat').options].length === 0);   // populated on open
  w.openTagModal('quarkus');
  const opts = [...d.getElementById('ctrlTagCat').options].map(o => o.value).filter(Boolean);
  OK('select lists all 5 categories with the tag\u2019s own preselected',
    opts.join(',') === 'Runtime,Framework,Build,Initiative,Workflow'
    && d.getElementById('ctrlTagCat').value === 'Runtime');
  w.closeModals();

  // ---- create a category; it appears in the tag modal select ----
  w.openTagCatModal();
  d.getElementById('ctrlTagCatName').value = 'Language';
  w.tagCatSave();
  OK('created category renders in the card', rows().includes('Language'));
  w.openTagModal();
  OK('created category appears in the tag modal select',
    [...d.getElementById('ctrlTagCat').options].some(o => o.value === 'Language'));
  w.closeModals();

  // ---- duplicate + required validation ----
  w.openTagCatModal();
  d.getElementById('ctrlTagCatName').value = 'runtime';   // case-insensitive duplicate
  w.tagCatSave();
  OK('case-insensitive duplicate rejected with a message',
    !d.getElementById('ctrlTagCatError').hidden
    && d.getElementById('ctrlTagCatError').textContent.includes('already exists'));
  d.getElementById('ctrlTagCatName').value = '';
  w.tagCatSave();
  OK('empty name rejected', d.getElementById('ctrlTagCatError').textContent.includes('Name is required.'));
  w.closeModals();

  // ---- rename cascades into every tag's category reference ----
  w.openTagCatModal('Build');
  d.getElementById('ctrlTagCatName').value = 'Build tool';
  w.tagCatSave();
  OK('rename cascades: the ant tag now carries "Build tool"',
    w.eval('MOCK_TAGS.find(t => t.name === "ant").category') === 'Build tool'
    && rows().includes('Build tool') && !rows().includes('Build'));

  // ---- guarded delete: referenced category survives the two-step arm ----
  const armBtn = c => [...d.querySelectorAll('#ctrlTagCatsBody button')].find(b => (b.getAttribute('onclick') || '').includes("'" + c + "'") && b.tagName === 'BUTTON' && b.classList.contains('pf-m-plain') === false || (b.getAttribute('onclick') || '').includes('tagCatDeleteArm(this, \'' + c + '\')'));
  const delBuild = [...pane.querySelectorAll('#ctrlTagCatsBody button')].find(b => (b.getAttribute('onclick') || '').includes("'Build tool'") && (b.getAttribute('onclick') || '').includes('tagCatDeleteArm'));
  OK('delete control exists for the renamed category', !!delBuild);
  delBuild.click();          // arm
  delBuild.click();          // confirm while referenced
  OK('referenced category is NOT deleted; guard message explains what still points here',
    rows().includes('Build tool') && !d.getElementById('ctrlMsg').hidden
    && d.getElementById('ctrlMsgText').textContent.includes('1 tag still references'));

  // ---- unreferenced category deletes cleanly ----
  const delLang = [...pane.querySelectorAll('#ctrlTagCatsBody button')].find(b => (b.getAttribute('onclick') || '').includes("'Language'") && (b.getAttribute('onclick') || '').includes('tagCatDeleteArm'));
  delLang.click(); delLang.click();
  OK('unreferenced category deletes on the second click', !rows().includes('Language'));

  // ---- tag save validates the category against the store ----
  w.openTagModal();
  d.getElementById('ctrlTagName').value = 'kafka';
  d.getElementById('ctrlTagCat').value = '';   // nothing selected
  w.tagSave();
  OK('tag save requires a category (location + fix in the message)',
    !d.getElementById('ctrlTagError').hidden
    && d.getElementById('ctrlTagError').textContent.includes('Category is required')
    && d.getElementById('ctrlTagError').textContent.includes('Tag categories'));
  const ghost = d.createElement('option'); ghost.value = 'Ghost';   // simulate a stale option
  d.getElementById('ctrlTagCat').appendChild(ghost);
  d.getElementById('ctrlTagCat').value = 'Ghost';
  w.tagSave();
  OK('unknown category rejected', d.getElementById('ctrlTagError').textContent.includes('Unknown category'));
  d.getElementById('ctrlTagCat').value = 'Runtime';
  w.tagSave();
  OK('valid save: tag created with the referenced category',
    w.eval('MOCK_TAGS.find(t => t.name === "kafka") && MOCK_TAGS.find(t => t.name === "kafka").category') === 'Runtime');
  // cleanup the created tag so other suites see the seed state
  w.eval('MOCK_TAGS.splice(MOCK_TAGS.findIndex(t => t.name === "kafka"), 1); MOCK_TAG_CATEGORIES.splice(MOCK_TAG_CATEGORIES.indexOf("Build tool"), 1); MOCK_TAG_CATEGORIES.push("Build"); MOCK_TAGS.find(t => t.name === "ant").category = "Build";');

  // ---- aria parentage: the new tab/card pair ----
  const dangling = [...d.querySelectorAll('[role="tabpanel"]')]
    .map(p => p.getAttribute('aria-labelledby'))
    .filter(lb => lb && !d.getElementById(lb));
  OK('tabpanel parentage sweep still clean', dangling.length === 0);

  console.log(fail === 0 ? 'ALL PASS (' + pass + ')' : 'FAILURES: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
})();
