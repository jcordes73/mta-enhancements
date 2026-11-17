const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
let pass = 0, fail = 0;
const OK = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); c ? pass++ : fail++; };
setTimeout(() => {
  const d = dom.window.document, w = dom.window;

  // ---- card render (row 130: Analysis profiles on Config -> Analysis) ----
  const body = d.getElementById('apBody');
  OK('analysis-profiles card renders 3 seeded profiles at boot', !!body && body.children.length === 3);
  OK('the live console sample row is verbatim (JBoss EAP 7.4 to JBoss EAP 8 + its official description)',
    !!body.querySelector('[data-approfile="1"]') && body.querySelector('[data-approfile="1"]').textContent.includes('Analysis profile for migrating JBoss EAP 7.4 to JBoss EAP 8')
      && !!body.querySelector('[data-approfile="1"] .anno'));
  OK('live column set + mock additions (source/targets/scope/rules/assigned archetypes)',
    [...body.querySelectorAll('tr')].every(r => r.children.length === 8));
  OK('assigned archetypes render as labels (EAP8-archetype / Spring / Quarkus)',
    body.querySelector('[data-approfile="1"]').textContent.includes('EAP8-archetype')
      && body.querySelector('[data-approfile="2"]').textContent.includes('Spring')
      && body.querySelector('[data-approfile="3"]').textContent.includes('Quarkus'));
  OK('card title carries the #36 cite', !!d.querySelector('#cfg-aprofiles .card_anno, #cfg-aprofiles .anno'));
  OK('Create button is RBAC-gated (profiles:edit)', (d.querySelector('#cfg-aprofiles .pf-m-primary').getAttribute('data-rbac') || '') === 'profiles:edit');

  // ---- wizard: open + step-1 gate (config surfaces are admin-only — the boot persona has the button disabled by RBAC) ----
  w.setPersona('admin');
  w.renderAProfiles();
  d.querySelector('#cfg-aprofiles .pf-m-primary').click();
  OK('Create opens the wizard modal with the live title', !d.getElementById('modalAProfile').hidden && d.getElementById('apTitle').textContent === 'Create analysis profile');
  OK('step 1 is Profile Details with the live helper line', !d.querySelector('[data-appanel="1"]').hidden && d.querySelector('[data-appanel="1"]').textContent.includes('Enter the basic details for the analysis profile.'));
  OK('live nav step set (Profile Details / Analysis Source / Set Targets / Scope / Custom Rules / Review)',
    [...d.querySelectorAll('[data-apstep]')].map(a => a.textContent.trim()).join('|') === 'Profile Details|Analysis Source|Set Targets|Scope|Custom Rules|Review');
  const nx = d.getElementById('apNext');
  OK('Next is gated until Name is filled (live required field)', nx.disabled && (nx.title || '').includes('Name is required'));
  d.getElementById('apName').value = 'Jakarta EE 9 baseline';
  w.apSyncNext();
  OK('typing a name enables Next', !nx.disabled);

  // ---- step walk ----
  w.apNext();
  OK('step 2 Analysis Source: live select with the two live options and the live default',
    !d.querySelector('[data-appanel="2"]').hidden && d.getElementById('apSourceText').textContent === 'Source code + dependencies'
      && [...d.querySelectorAll('[data-appanel="2"] .pf-v6-c-menu__item-text')].map(o => o.textContent).join('|') === 'Source code + dependencies|Source code');
  const srcItem = [...d.querySelectorAll('[data-appanel="2"] .pf-v6-c-menu__item')].find(b => b.textContent.trim() === 'Source code');
  srcItem.click();
  OK('source select updates and closes its menu (pagerPerPage idiom)', d.getElementById('apSourceText').textContent === 'Source code' && srcItem.closest('.pf-v6-c-menu').hidden);
  w.apNext();
  OK('step 3 Set Targets: the skip warning is VISIBLE at zero targets (live behavior)',
    !d.querySelector('[data-appanel="3"]').hidden && !d.getElementById('apTargetWarn').hidden);
  OK('live target catalog present with language badges (JBoss EAP 8, Quarkus, OpenJDK 11, camel:3...)',
    [...d.querySelectorAll('#apTargets input')].length >= 10 && !!d.querySelector('#apTargets input[value="JBoss EAP 8"]') && !!d.querySelector('#apTargets .pf-v6-c-label__text'));
  d.querySelector('#apTargets input[value="Quarkus"]').checked = true;
  w.apSyncNext();
  OK('selecting a target hides the skip warning', d.getElementById('apTargetWarn').hidden);
  w.apNext();
  OK('step 4 Scope: the two live radio options + package include/exclude fields',
    !d.querySelector('[data-appanel="4"]').hidden
      && d.getElementById('apScopeInt').checked
      && d.querySelector('[data-appanel="4"]').textContent.includes('Application and all dependencies, including known Open Source libraries'));
  d.getElementById('apScopeAll').checked = true;
  d.getElementById('apExcl').value = 'com.example.generated';
  w.apNext();
  OK('step 5 Custom Rules: empty state + live gate (no rules + targets selected -> Next enabled)',
    !d.querySelector('[data-appanel="5"]').hidden && !!d.getElementById('apRulesEmpty') && !nx.disabled);
  // gate: remove targets -> rules required
  d.querySelectorAll('#apTargets input').forEach(c => { c.checked = false; });
  w.apSyncNext();
  OK('live gate: with no targets AND no rules, Next disables with the live warning text',
    nx.disabled && (nx.title || '').includes('At least one custom rule file is required if no targets are selected'));
  d.querySelector('#apTargets input[value="Quarkus"]').checked = true;
  w.apSyncNext();
  w.apRuleAdd();
  OK('Add rules pulls from the mock ruleset catalog (platform-custom / weblogic-to-eap / eap8-migration-ruleset)',
    !d.getElementById('apRulesEmpty') && d.getElementById('apRulesBody').textContent.includes('eap8-migration-ruleset'));
  w.apNext();
  OK('step 6 Review: definition list reflects the entered fields', !d.querySelector('[data-appanel="6"]').hidden
    && d.getElementById('apReview').textContent.includes('Jakarta EE 9 baseline')
    && d.getElementById('apReview').textContent.includes('Source code')
    && d.getElementById('apReview').textContent.includes('com.example.generated'));
  OK('footer primary now reads Finish', nx.querySelector('.pf-v6-c-button__text').textContent === 'Finish');

  // ---- save: store + archetype write-through + audit + toast ----
  nx.click();
  OK('Finish saves the profile (4 rows now)', body.children.length === 4 && !!body.querySelector('[data-approfile="4"]'));
  OK('save is audited (profile:create)', w.eval("AUDIT_LOG[0].action === 'profile:create' && AUDIT_LOG[0].target === 'Jakarta EE 9 baseline'"));
  OK('save toast fires', !!d.getElementById('rbacToast') && d.getElementById('rbacToast').textContent.includes('Jakarta EE 9 baseline'));
  OK('wizard closed after save', d.getElementById('modalAProfile').hidden);

  // ---- edit round-trip + write-through ----
  w.apOpen(2);
  OK('Edit opens pre-filled with the profile name and title flips', d.getElementById('apTitle').textContent === 'Edit analysis profile' && d.getElementById('apName').value === 'Spring \u2192 Quarkus profile');
  d.getElementById('apName').value = 'Spring Boot to Quarkus profile';
  w.apSyncNext();
  w.apGo(6); w.apNext();
  OK('edit saves under the same id (no duplicate row)', body.children.length === 4 && body.querySelector('[data-approfile="2"]').textContent.includes('Spring Boot to Quarkus profile'));
  OK('write-through updated the Spring archetype Profiles cell', w.eval("MOCK_ARCHETYPES.find(a => a.name === 'Spring').profiles") === 'Spring Boot to Quarkus profile');
  OK('edit is audited (profile:update)', w.eval("AUDIT_LOG[0].action === 'profile:update'"));

  // ---- delete: armed idiom, archetype cleanup ----
  const delBtn = body.querySelector('[data-approfile="4"] button[data-apid="4"]');
  delBtn.click();
  OK('first delete click arms (row-95 idiom: Confirm delete label, not a bare danger trigger)',
    delBtn.dataset.armed === '1' && delBtn.querySelector('.pf-v6-c-button__text').textContent === 'Confirm delete');
  delBtn.click();
  OK('confirmed delete removes the profile', body.children.length === 3 && !body.querySelector('[data-approfile="4"]'));
  OK('delete is audited (profile:delete)', w.eval("AUDIT_LOG[0].action === 'profile:delete'"));

  // ---- archetype table consistency ----
  OK('archetype table still renders 4 rows with the Profiles column intact',
    d.getElementById('archBody').children.length >= 4 && w.eval("MOCK_ARCHETYPES.every(a => typeof a.profiles === 'string')"));

  // ---- RBAC: row action buttons gate on profiles:edit ----
  w.setPersona('admin');
  w.renderAProfiles();
  OK('as admin the row actions are enabled', [...d.querySelectorAll('#apBody [data-rbac]')].every(b => !b.disabled));
  w.setPersona('architect');
  w.renderAProfiles();
  const archBtn = d.querySelector('#apBody [data-rbac]');
  OK('as architect the row actions are disabled with an explanatory title', !!archBtn && archBtn.disabled && (archBtn.title || '').includes('profiles:edit'));
  w.setPersona('admin');

  // ---- empty state + EN byte-exactness spot (new chrome is EN-only by feature-row precedent) ----
  OK('empty-state copy exists in the DOM (hidden while rows present)', d.getElementById('apEmpty') !== null && d.getElementById('apEmpty').hidden);

  console.log(fail === 0 ? 'ALL PASS (' + pass + ')' : 'FAILURES: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}, 400);
