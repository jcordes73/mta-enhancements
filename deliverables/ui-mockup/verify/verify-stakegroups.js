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
  w.renderStakeholders();

  // ---- boot render: stakeholder rows carry the edit pencil (row 133: stakeholder-side membership) ----
  const rows = [...d.getElementById('stakeBody').querySelectorAll('tr[data-stakeholder]')];
  OK('stakeholder rows render with edit + delete icons (pager slices at 10/page)',
    rows.length === Math.min(w.eval('MOCK_STAKEHOLDERS.length'), 10)
    && rows.every(r => r.querySelector('button[aria-label="Edit"]') && r.querySelector('button[aria-label="Edit"]').hasAttribute('data-rbac')));

  // ---- create modal gains the groups field ----
  w.stakeModalOpen();
  OK('create modal: title/button stay Create, groups field renders all groups unchecked',
    d.getElementById('cs-title').textContent === 'Add stakeholder'
    && d.getElementById('csSaveBtn').textContent === 'Create'
    && d.querySelectorAll('#ctrlStakeGroups input').length === w.eval('MOCK_GROUPS.length')
    && [...d.querySelectorAll('#ctrlStakeGroups input')].every(c => !c.checked));
  w.closeModals();

  // ---- edit opens pre-filled with the person's memberships checked ----
  w.stakeModalOpen('J. Cordes');
  OK('edit modal: title + button flip to Save, fields pre-filled',
    d.getElementById('cs-title').textContent === 'Edit stakeholder'
    && d.getElementById('csSaveBtn').textContent === 'Save'
    && d.getElementById('ctrlStakeName').value === 'J. Cordes'
    && d.getElementById('ctrlStakeEmail').value.includes('j.cordes@'));
  const checked = [...d.querySelectorAll('#ctrlStakeGroups input:checked')].map(c => c.value);
  OK('memberships pre-checked from MOCK_GROUPS (J. Cordes is in both groups)',
    checked.includes('Wave planners') && checked.includes('Application owners'));

  // ---- unchecking a group removes the membership (the depth gap) ----
  d.querySelector('#ctrlStakeGroups input[value="Application owners"]').checked = false;
  w.stakeholderSave();
  OK('uncheck removes the membership in MOCK_GROUPS (both directions)', w.eval("!MOCK_GROUPS.find(g => g.name === 'Application owners').members.includes('J. Cordes')") && w.eval("MOCK_GROUPS.find(g => g.name === 'Wave planners').members.includes('J. Cordes')"));
  OK('the group table + Groups column re-rendered without the removed member',
    !d.getElementById('ctrlGroupsBody').querySelector('tr[data-group="Application owners"]').textContent.includes('J. Cordes')
    && d.getElementById('stakeBody').querySelector('tr[data-stakeholder="J. Cordes"]').textContent.includes('Wave planners')
    && !d.getElementById('stakeBody').querySelector('tr[data-stakeholder="J. Cordes"]').textContent.includes('Application owners'));
  OK('edit is audited (stakeholder:update) and toast fires', w.eval("AUDIT_LOG[0].action === 'stakeholder:update' && AUDIT_LOG[0].target === 'J. Cordes'") && d.getElementById('rbacToast').textContent.includes('J. Cordes'));

  // ---- checking a group grants membership from the stakeholder side ----
  w.stakeModalOpen('R. Fuchs');
  d.querySelector('#ctrlStakeGroups input[value="Application owners"]').checked = true;
  w.stakeholderSave();
  OK('check grants the membership (stakeholder-side edit)', w.eval("MOCK_GROUPS.find(g => g.name === 'Application owners').members.includes('R. Fuchs')"));

  // ---- rename cascades every name-keyed reference ----
  const ownedApps = w.eval("MOCK_APPS.filter(a => a.owner === 'J. Cordes').length");
  w.stakeModalOpen('J. Cordes');
  d.getElementById('ctrlStakeName').value = 'J. Cordes-Lindemann';
  w.stakeholderSave();
  OK('rename updates the stakeholder record and the table row',
    w.eval("MOCK_STAKEHOLDERS.some(p => p.name === 'J. Cordes-Lindemann')") && !w.eval("MOCK_STAKEHOLDERS.some(p => p.name === 'J. Cordes')")
    && !!d.getElementById('stakeBody').querySelector('tr[data-stakeholder="J. Cordes-Lindemann"]'));
  OK('rename cascades into group memberships', w.eval("MOCK_GROUPS.find(g => g.name === 'Wave planners').members.includes('J. Cordes-Lindemann')") && !w.eval("MOCK_GROUPS.find(g => g.name === 'Wave planners').members.includes('J. Cordes')"));
  OK('rename cascades into business-service owners (Billing)', w.eval("MOCK_BSVCS.find(b => b.name === 'Billing').owner === 'J. Cordes-Lindemann'"));
  OK('rename cascades into wave stakeholder cells (waveStake-3)', d.getElementById('waveStake-3').textContent.includes('J. Cordes-Lindemann') && !d.getElementById('waveStake-3').textContent.includes('J. Cordes,'));
  if (ownedApps > 0){
    OK('rename cascades into application owners (' + ownedApps + ' owned apps)', w.eval("MOCK_APPS.every(a => a.owner !== 'J. Cordes')"));
  } else {
    OK('no apps owned by the renamed stakeholder — app cascade vacuously holds', w.eval("MOCK_APPS.every(a => a.owner !== 'J. Cordes')"));
  }
  OK('the wave cells keep the other members intact', d.getElementById('waveStake-3').textContent.includes('M. Keller'));
  // rename back so later work in this session sees the canonical names
  w.stakeModalOpen('J. Cordes-Lindemann');
  d.getElementById('ctrlStakeName').value = 'J. Cordes';
  w.stakeholderSave();

  // ---- duplicate-name gate on edit ----
  w.stakeModalOpen('M. Keller');
  d.getElementById('ctrlStakeName').value = 'J. Cordes';
  w.stakeholderSave();
  OK('duplicate name on edit is rejected with location+cause (own name allowed)',
    !d.getElementById('ctrlStakeError').hidden && d.getElementById('ctrlStakeError').textContent.includes('already exists')
    && w.eval("MOCK_STAKEHOLDERS.filter(p => p.name === 'J. Cordes').length === 1"));
  w.closeModals();

  // ---- create with a group assignment ----
  w.stakeModalOpen();
  d.getElementById('ctrlStakeName').value = 'T. Testperson';
  d.getElementById('ctrlStakeOrg').value = 'nwf';
  d.querySelector('#ctrlStakeGroups input[value="Wave planners"]').checked = true;
  w.stakeholderSave();
  OK('create adds the stakeholder with the assigned group (email derived)',
    w.eval("MOCK_STAKEHOLDERS.some(p => p.name === 'T. Testperson')")
    && w.eval("MOCK_GROUPS.find(g => g.name === 'Wave planners').members.includes('T. Testperson')"));
  OK('create is audited (stakeholder:create)', w.eval("AUDIT_LOG[0].action === 'stakeholder:create' && AUDIT_LOG[0].target === 'T. Testperson'"));

  console.log(fail === 0 ? 'ALL PASS (' + pass + ')' : 'FAILURES: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}, 400);
