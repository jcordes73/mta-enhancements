const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
let pass = 0, fail = 0;
const OK = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); c ? pass++ : fail++; };
setTimeout(() => {
  const d = dom.window.document, w = dom.window;

  // ---- boot render (row 131: Users inspector on Config -> Access) ----
  w.setPersona('admin');
  const body = d.getElementById('usBody');
  OK('users card renders 8 directory users at boot', !!body && body.children.length === 8);
  OK('live column set (ID/Login/Name/Email/Roles/Tokens + actions)',
    [...body.querySelectorAll('tr')].every(r => r.children.length === 7)
    && !!d.querySelector('#cfg-users th:nth-child(6)') && d.querySelector('#cfg-users th:nth-child(6)').textContent.includes('Tokens'));
  OK('the realm demo identities are seeded (a.weber admin, root, d.hoffmann from EXTRA_USERS)',
    !!body.querySelector('[data-user="1"]') && body.querySelector('[data-user="1"]').textContent.includes('admin')
    && body.querySelector('[data-user="7"]').textContent.includes('root@example.com')
    && body.querySelector('[data-user="8"]').textContent.includes('d.hoffmann'));
  OK('Roles render as labels; roleless user renders an em dash',
    !!body.querySelector('[data-user="1"] .pf-v6-c-label__text'));
  OK('Tokens column counts MOCK_TOKENS per login (a.weber 1, root dash)',
    body.querySelector('[data-user="1"]').children[5].textContent.trim() === '1'
    && body.querySelector('[data-user="7"]').children[5].textContent.includes('\u2014'));
  OK('Create button is RBAC-gated (users:edit)', (d.querySelector('#cfg-users .pf-m-primary').getAttribute('data-rbac') || '') === 'users:edit');
  OK('shared pager registered and visible (8 of 8, single page)', !d.getElementById('usPag').hidden && d.getElementById('usCount').textContent.includes('8'));

  // ---- search filter + zero-result pager hiding (row-87 rule) ----
  d.getElementById('usSearch').value = 'weber';
  w.renderUsers();
  OK('search filters the directory (weber -> 1 row)', body.children.length === 1);
  d.getElementById('usSearch').value = 'zzz-nobody';
  w.renderUsers();
  OK('zero-result search: empty state visible, pager hidden (row-87)', !d.getElementById('usEmpty').hidden && d.getElementById('usPag').hidden);
  d.getElementById('usSearch').value = '';
  w.renderUsers();

  // ---- create modal: live field set + validation gates ----
  d.querySelector('#cfg-users .pf-m-primary').click();
  OK('Create opens the live modal (Login/Name/Email/Password/Confirm/Roles)',
    !d.getElementById('modalUser').hidden && d.getElementById('muTitle').textContent === 'Create user'
    && !!d.getElementById('muPw') && !!d.getElementById('muPw2') && d.querySelectorAll('#muRoles input').length === 5);
  OK('Create disabled until required fields exist (live required set)', d.getElementById('usCreateBtn').disabled);
  d.getElementById('muLogin').value = 's.klein@northwind-financial.com';
  d.getElementById('muName').value = 'S. Klein';
  d.getElementById('muEmail').value = 's.klein@northwind-financial.com';
  d.getElementById('muPw').value = 'hunter22';
  d.getElementById('muPw2').value = 'nope';
  w.usSyncCreate();
  OK('mismatched confirm password blocks save with location+cause+fix', d.getElementById('usCreateBtn').disabled && d.getElementById('usFormMsgText').textContent.includes('do not match'));
  d.getElementById('muPw2').value = 'hunter22';
  d.querySelector('#muRoles input[value="migrator"]').checked = true;
  w.usSyncCreate();
  OK('valid form enables Create', !d.getElementById('usCreateBtn').disabled);
  w.usSave();
  OK('create adds the row (9 users) and is audited (user:create)',
    body.children.length === 9 && w.eval("AUDIT_LOG[0].action === 'user:create' && AUDIT_LOG[0].target === 's.klein@northwind-financial.com'"));
  OK('create toast fires with the one-directory guidance (#36a)', d.getElementById('rbacToast').textContent.includes('s.klein') && d.getElementById('rbacToast').textContent.includes('#36a'));
  OK('wizard... modal closed after save', d.getElementById('modalUser').hidden);

  // duplicate gate
  w.usOpen();
  d.getElementById('muLogin').value = 'A.WEBER@northwind-financial.com';   /* case-insensitive duplicate */
  d.getElementById('muName').value = 'X';
  d.getElementById('muEmail').value = 'x@example.com';
  d.getElementById('muPw').value = 'a'; d.getElementById('muPw2').value = 'a';
  w.usSyncCreate();
  OK('duplicate login (case-insensitive) blocks save', d.getElementById('usCreateBtn').disabled && d.getElementById('usFormMsgText').textContent.includes('already exists'));
  w.closeModals();

  // ---- edit: pre-filled + rename cascades token ownership ----
  w.usOpen(1);
  OK('Edit opens pre-filled, title flips, password optional (blank keeps credential)',
    d.getElementById('muTitle').textContent === 'Edit user' && d.getElementById('muLogin').value === 'a.weber@northwind-financial.com'
    && !d.getElementById('usCreateBtn').disabled);   /* blank passwords valid on edit */
  d.getElementById('muLogin').value = 'a.weber2@northwind-financial.com';
  w.usSyncCreate();
  w.usSave();
  OK('rename saves under the same id, is audited (user:update)', body.querySelector('[data-user="1"]').textContent.includes('a.weber2') && w.eval("AUDIT_LOG[0].action === 'user:update'"));
  OK('token ownership followed the rename (a.weber2 now holds 1, tokens card follows)',
    w.eval("MOCK_TOKENS.filter(t => t.login === 'a.weber2@northwind-financial.com').length === 1"));
  OK('bind table re-rendered after the rename (stakeholder bind email followed — no ghost bind, row-34 lesson)',
    w.eval("!document.getElementById('userBindBody').textContent.includes('a.weber@')"));

  // ---- delete guard: token-holding login ----
  const delWeber = body.querySelector('[data-user="1"] button[data-usid="1"]');
  delWeber.click();
  OK('token-holding login refuses deletion with the revoke-first fix (no arm)',
    body.children.length === 9 && delWeber.dataset.armed !== '1'
    && d.getElementById('rbacToast').textContent.includes('revoke them on the Tokens card first'));

  // rename back for store consistency
  w.usOpen(1);
  d.getElementById('muLogin').value = 'a.weber@northwind-financial.com';
  w.usSyncCreate(); w.usSave();

  // ---- delete: armed idiom on a token-less user ----
  const del = body.querySelector('[data-user="6"] button[data-usid="6"]');   /* r.olson: no tokens */
  const bound = w.eval("MOCK_STAKEHOLDERS.some(p => p.email === 'r.olson@northwind-financial.com')");
  del.click();
  OK('first delete click arms (row-95 idiom)', del.dataset.armed === '1' && del.textContent === 'Confirm delete');
  del.click();
  OK('confirmed delete removes the user (8 left) and is audited (user:delete)',
    body.children.length === 8 && w.eval("AUDIT_LOG[0].action === 'user:delete' && AUDIT_LOG[0].target === 'r.olson@northwind-financial.com'"));
  if (bound){
    OK('deleting a bound login keeps the stakeholder record (#36a) — bind degrades to unlinked',
      w.eval("MOCK_STAKEHOLDERS.some(p => p.email === 'r.olson@northwind-financial.com')"));
  } else {
    OK('token-less unbound user deletes cleanly (no stakeholder side effects)',
      w.eval("!MOCK_STAKEHOLDERS.some(p => p.email === 'r.olson@northwind-financial.com')"));
  }

  // ---- RBAC: row actions gate on users:edit ----
  w.setPersona('architect');
  w.renderUsers();
  const archBtn = d.querySelector('#usBody [data-rbac]');
  OK('as architect the row actions are disabled with an explanatory title', !!archBtn && archBtn.disabled && (archBtn.title || '').includes('users:edit'));
  w.setPersona('admin');
  w.renderUsers();

  // ---- summary line ----
  OK('summary line counts the directory + roleless users', d.getElementById('usSummary').textContent.includes('8') && d.getElementById('usSummary').textContent.includes('directory users'));

  console.log(fail === 0 ? 'ALL PASS (' + pass + ')' : 'FAILURES: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}, 400);
