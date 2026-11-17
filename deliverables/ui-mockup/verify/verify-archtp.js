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

  // ---- boot render: detail-panel block (row 132: archetype target profiles) ----
  const eapPanel = d.getElementById('arch-detail-EAP8-archetype');
  OK('archetype detail panel renders a Target profiles block', !!eapPanel && eapPanel.textContent.includes('Target profiles') && !!eapPanel.querySelector('.arch-tp-block'));
  OK('the live sample row is verbatim (JBoss EAP 8 / None / JBoss EAP 7.4 to JBoss EAP 8)',
    eapPanel.querySelector('.arch-tp-block [data-tp="1"]') !== null
    && eapPanel.querySelector('.arch-tp-block [data-tp="1"]').textContent.includes('JBoss EAP 7.4 to JBoss EAP 8'));
  OK('archetypes without target profiles render the fallback line',
    d.getElementById('arch-detail-Spring') !== null
    && d.getElementById('arch-detail-Spring').querySelector('.arch-tp-block').textContent.includes('No target profiles'));
  const manageBtn = eapPanel.querySelector('.arch-tp-block [data-rbac]');
  OK('Manage button is RBAC-gated (profiles:edit)', manageBtn && (manageBtn.getAttribute('data-rbac') || '') === 'profiles:edit');

  // ---- manage modal (EAP8) ----
  manageBtn.click();
  OK('Manage opens the modal scoped to the archetype', !d.getElementById('modalArchTP').hidden && d.getElementById('mtpArch').textContent === 'EAP8-archetype');
  OK('modal lists the archetype\u2019s target profiles', [...d.getElementById('mtpBody').querySelectorAll('[data-mtp]')].length === 1);
  OK('analysis-profile select offers the registry (none + 3 profiles)',
    [...d.getElementById('mtpProfileMenu').querySelectorAll('.pf-v6-c-menu__item-text')].length === 4);
  OK('Add gated until Name is filled', d.getElementById('mtpSaveBtn').disabled);

  // ---- edit: reassignment moves the archetype between profiles (EAP8 modal, profile 1) ----
  w.mtpEdit(1);
  OK('Edit pre-fills (label flips, Save label, cancel visible)',
    d.getElementById('mtpNameLabel').textContent.includes('Edit target profile') && !d.getElementById('mtpCancelEdit').hidden);
  const qb = [...d.getElementById('mtpProfileMenu').querySelectorAll('.pf-v6-c-menu__item')].find(b => b.textContent.trim() === 'Quarkus baseline');
  qb.click();
  w.mtpSave();
  OK('reassignment detaches the old profile (JBoss EAP 7.4\u20268 loses EAP8-archetype) and assigns the new one',
    w.eval("!MOCK_APROFILES.find(p => p.name === 'JBoss EAP 7.4 to JBoss EAP 8').archs.includes('EAP8-archetype')")
    && w.eval("MOCK_APROFILES.find(p => p.name === 'Quarkus baseline').archs.includes('EAP8-archetype')"));
  OK('the archetype Profiles cell follows (EAP8-archetype \u2192 Quarkus baseline)',
    w.eval("MOCK_ARCHETYPES.find(a => a.name === 'EAP8-archetype').profiles") === 'Quarkus baseline');
  OK('the archetype table\u2019s Profiles column renders the reassignment',
    [...d.getElementById('archBody').querySelectorAll('tr')].some(r => r.dataset.archName === 'EAP8-archetype' && r.textContent.includes('Quarkus baseline')));
  OK('reassignment is audited (targetprofile:update)', w.eval("AUDIT_LOG[0].action === 'targetprofile:update'"));
  // revert to the live-truth assignment
  w.mtpEdit(1);
  const back = [...d.getElementById('mtpProfileMenu').querySelectorAll('.pf-v6-c-menu__item')].find(b => b.textContent.trim() === 'JBoss EAP 7.4 to JBoss EAP 8');
  back.click();
  w.mtpSave();
  OK('reverted: EAP8-archetype back under JBoss EAP 7.4 to JBoss EAP 8',
    w.eval("MOCK_APROFILES.find(p => p.name === 'JBoss EAP 7.4 to JBoss EAP 8').archs.includes('EAP8-archetype')"));

  // ---- add (on the Legacy archetype): write-through to the profile registry + Profiles cell ----
  w.closeModals();
  w.tpOpen('Legacy');
  OK('reopened modal re-scopes to Legacy', d.getElementById('mtpArch').textContent === 'Legacy');
  d.getElementById('mtpName').value = 'Legacy container quickstarts';
  d.querySelector('#mtpGens input[value="Quickstart-OpenShift-GitOps"]').checked = true;
  const qkItem = [...d.getElementById('mtpProfileMenu').querySelectorAll('.pf-v6-c-menu__item')].find(b => b.textContent.trim() === 'Quarkus baseline');
  qkItem.click();
  OK('profile select updates and closes its menu (pagerPerPage idiom)',
    d.getElementById('mtpProfileText').textContent === 'Quarkus baseline' && qkItem.closest('.pf-v6-c-menu').hidden);
  w.mtpSave();
  const newId = w.eval('Math.max(...MOCK_TARGET_PROFILES.map(t => t.id))');
  OK('add creates the target profile (1 row on Legacy now)',
    [...d.getElementById('mtpBody').querySelectorAll('[data-mtp]')].length === 1);
  OK('assignment writes through: Quarkus baseline\u2019s archs gains Legacy',
    w.eval("MOCK_APROFILES.find(p => p.name === 'Quarkus baseline').archs.includes('Legacy')"));
  OK('the archetype Profiles cell follows (Legacy \u2192 Quarkus baseline)',
    w.eval("MOCK_ARCHETYPES.find(a => a.name === 'Legacy').profiles") === 'Quarkus baseline');
  OK('create is audited (targetprofile:create)', w.eval("AUDIT_LOG[0].action === 'targetprofile:create'"));
  OK('create toast fires with the inheritance semantics', d.getElementById('rbacToast').textContent.includes('Legacy container quickstarts'));
  OK('form reset after save (Add label back)', d.getElementById('mtpSaveBtn').textContent.includes('Add target profile'));

  // duplicate gate (same archetype)
  d.getElementById('mtpName').value = 'legacy container quickstarts';
  w.mtpSync();
  w.mtpSave();
  OK('duplicate name on the same archetype blocks with location+cause+fix (case-insensitive)',
    !d.getElementById('mtpMsg').hidden && d.getElementById('mtpMsgText').textContent.includes('already exists'));
  w.mtpFormReset();

  // ---- delete: armed idiom + detach on last reference (Legacy row) ----
  const delBtn = d.getElementById('mtpBody').querySelector('[data-mtpid="' + newId + '"]');
  delBtn.click();
  OK('first delete click arms (row-95 idiom)', delBtn.dataset.armed === '1' && delBtn.textContent === 'Confirm delete');
  delBtn.click();
  OK('confirmed delete removes the profile and detaches the assignment (last reference)',
    w.eval("!MOCK_TARGET_PROFILES.some(t => t.id === " + newId + ")")
    && w.eval("!MOCK_APROFILES.find(p => p.name === 'Quarkus baseline').archs.includes('Legacy')"));
  OK('archetype Profiles cell falls back to the unassigned placeholder', w.eval("MOCK_ARCHETYPES.find(a => a.name === 'Legacy').profiles") === '&mdash;');
  OK('delete is audited (targetprofile:delete)', w.eval("AUDIT_LOG[0].action === 'targetprofile:delete'"));

  // non-last reference does NOT detach
  d.getElementById('mtpName').value = 'Second reference';
  const qb2 = [...d.getElementById('mtpProfileMenu').querySelectorAll('.pf-v6-c-menu__item')].find(b => b.textContent.trim() === 'Quarkus baseline');
  qb2.click();
  w.mtpSave();
  const secondId = w.eval('Math.max(...MOCK_TARGET_PROFILES.map(t => t.id))');
  const del2 = d.getElementById('mtpBody').querySelector('[data-mtpid="' + secondId + '"]');
  del2.click(); del2.click();
  OK('deleting a non-last reference keeps the archetype assigned (Quarkus still under Quarkus baseline)',
    w.eval("MOCK_APROFILES.find(p => p.name === 'Quarkus baseline').archs.includes('Quarkus')"));
  w.closeModals();

  // ---- RBAC: row actions gate on profiles:edit ----
  w.setPersona('architect');
  w.renderArchetypes();
  w.applyRbac();   /* renderArchetypes does not gate verbs itself — boot order does */
  const archBtn = d.querySelector('#arch-detail-EAP8-archetype .arch-tp-block [data-rbac]');
  OK('as architect the Manage verb is disabled with an explanatory title', !!archBtn && archBtn.disabled && (archBtn.title || '').includes('profiles:edit'));
  w.setPersona('admin');

  console.log(fail === 0 ? 'ALL PASS (' + pass + ')' : 'FAILURES: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}, 400);
