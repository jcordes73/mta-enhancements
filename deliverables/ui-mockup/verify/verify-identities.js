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
  w.renderCreds();
  const body = d.getElementById('credsBody');

  // ---- boot: live Created-by column + the default label ----
  OK('credentials table carries the live Created-by column', !!d.querySelector('#credsTable th') && [...d.querySelectorAll('#credsTable th')].some(th => th.textContent.includes('Created by')));
  OK('seeded rows render createdBy (admin)', [...body.querySelectorAll('tr')].filter(r => r.children[7] && r.children[7].textContent.trim() === 'admin').length >= 4);
  const gitRow = [...body.querySelectorAll('tr')].find(r => r.textContent.includes('gitlab-pat'));
  OK('gitlab-pat carries the default label + the Remove-default verb (live kebab)',
    gitRow && gitRow.textContent.includes('default') && !!gitRow.querySelector('[data-credname="gitlab-pat"]'));
  OK('Remove-default is RBAC-gated (identities:edit)', gitRow.querySelector('[data-credname]').getAttribute('data-rbac') === 'identities:edit');
  OK('Add-credential button is wired and RBAC-gated (identities:create)',
    d.querySelector('#credsCard .pf-m-primary').getAttribute('onclick') === 'credNewOpen()');

  // ---- modal: live field set + type-driven swap ----
  w.credNewOpen();
  OK('modal: title New credential, Save gated, five live types',
    d.getElementById('mc-title').textContent === 'New credential' && d.getElementById('credSaveBtn').disabled
    && [...d.getElementById('credType').options].filter(o => o.value).length === 5);
  d.getElementById('credName').value = '   ';
  w.credSync();
  OK('blank name gate states location+cause', !d.getElementById('credMsg').hidden && d.getElementById('credMsgText').textContent.includes('Name is required'));
  d.getElementById('credName').value = 'svn-deploy-key';
  w.credSync();
  OK('type gate names the five live types', !d.getElementById('credSaveBtn').disabled === false && d.getElementById('credMsgText').textContent.includes('five live identity types'));

  // source: user credentials + default switch
  d.getElementById('credType').value = 'source';
  w.credTypeApply(); w.credSync();
  OK('type source renders User credentials (username+password) + the Default-credential switch with the live help text',
    !!d.getElementById('credUser') && !!d.getElementById('credPass') && !!d.getElementById('credDefaultSw')
    && d.getElementById('credTypeFields').textContent.includes('Use as the source control credential if an application does not have one assigned?'));
  OK('source requires username + password', d.getElementById('credSaveBtn').disabled && d.getElementById('credMsgText').textContent.includes('username and password'));
  d.getElementById('credUser').value = 'deploy-bot';
  d.getElementById('credPass').value = 's3cret';
  d.getElementById('credDefaultSw').checked = true;
  w.credSync();
  OK('valid form enables Create', !d.getElementById('credSaveBtn').disabled);
  w.credSave();
  OK('create appends the row with kind source · user/password and createdBy = the persona directory login (row-131 tie-in)',
    [...body.querySelectorAll('tr')].some(r => r.textContent.includes('svn-deploy-key') && r.children[1].textContent.includes('user/password') && r.children[7].textContent.trim() === 'a.weber@northwind-financial.com'));
  OK('a new default takes the exclusive flag (gitlab-pat lost it, the new row holds it)',
    w.eval("!CREDS.find(c => c.name === 'gitlab-pat').isDefault") && w.eval("CREDS.find(c => c.name === 'svn-deploy-key').isDefault === true"));
  OK('create is audited (identities:create, marked as default)', w.eval("AUDIT_LOG[0].action === 'identities:create' && AUDIT_LOG[0].target.includes('svn-deploy-key') && AUDIT_LOG[0].target.includes('default')"));
  OK('toast names the never-stored-secret rule (#15)', d.getElementById('rbacToast').textContent.includes('never stored'));

  // duplicate gate
  w.credNewOpen();
  d.getElementById('credName').value = 'GITLAB-PAT';
  d.getElementById('credType').value = 'proxy';
  w.credTypeApply(); w.credSync();
  OK('duplicate name (case-insensitive) blocks save', d.getElementById('credSaveBtn').disabled && d.getElementById('credMsgText').textContent.includes('already exists'));
  w.closeModals();

  // proxy type: username/password, no switch
  w.credNewOpen();
  d.getElementById('credName').value = 'egress-proxy';
  d.getElementById('credType').value = 'proxy';
  w.credTypeApply(); w.credSync();
  OK('type proxy renders Username/Password only (no default switch)',
    !!d.getElementById('credUser') && !d.getElementById('credDefaultSw'));
  d.getElementById('credUser').value = 'proxy-user';
  w.credSync();
  w.credSave();
  OK('proxy create lands with kind proxy · user/password (password optional, live labels carry no *)',
    w.eval("CREDS.find(c => c.name === 'egress-proxy').kind") === 'proxy &middot; user/password');

  // bearer-jira: token only
  w.credNewOpen();
  d.getElementById('credName').value = 'jira-cloud-bearer';
  d.getElementById('credType').value = 'bearer-jira';
  w.credTypeApply(); w.credSync();
  OK('type Bearer Token (Jira) renders Token only and requires it',
    !!d.getElementById('credTok') && !d.getElementById('credUser') && d.getElementById('credSaveBtn').disabled);
  d.getElementById('credTok').value = 'tok-123';
  w.credSync(); w.credSave();
  OK('bearer create lands with kind jira · bearer token', w.eval("CREDS.find(c => c.name === 'jira-cloud-bearer').kind") === 'jira &middot; bearer token');

  // maven + basic-jira field sets
  w.credNewOpen();
  d.getElementById('credType').value = 'maven';
  w.credTypeApply();
  OK('type Maven Settings File renders the upload/paste hint + textarea + the default switch',
    d.getElementById('credTypeFields').textContent.includes('Upload your Settings file or paste its contents below.')
    && !!d.getElementById('credSettings') && !!d.getElementById('credDefaultSw'));
  d.getElementById('credType').value = 'basic-jira';
  w.credTypeApply();
  OK('type Basic Auth (Jira) renders Jira username or email + Token', !!d.getElementById('credJiraUser') && !!d.getElementById('credTok'));
  w.closeModals();

  // ---- remove default ----
  w.renderCreds();
  const defBtn = body.querySelector('[data-credname="svn-deploy-key"]');
  defBtn.click();
  OK('Remove default clears the flag and is audited (identities:update)',
    w.eval("!CREDS.find(c => c.name === 'svn-deploy-key').isDefault")
    && w.eval("AUDIT_LOG[0].action === 'identities:update' && AUDIT_LOG[0].target.includes('default removed')"));
  OK('the row re-rendered without the default label or the verb',
    !body.querySelector('[data-credname="svn-deploy-key"]') && ![...body.querySelectorAll('tr')].some(r => r.textContent.includes('svn-deploy-key') && r.textContent.includes('default')));

  console.log(fail === 0 ? 'ALL PASS (' + pass + ')' : 'FAILURES: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}, 400);
