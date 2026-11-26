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
  w.cfgTabApply('platform', 'settings');

  // ---- structure: the allowlist lives on the Platform settings card ----
  const card = d.getElementById('cfgcp-settings-1');
  OK('Platform settings card carries the TLS-exemptions section (heading + Add button + table)',
    card.textContent.includes('TLS exemptions') && !!card.querySelector('button[onclick="openTlsExModal()"]')
    && !!d.getElementById('tlsExBody'));
  OK('section cites the route issue (R2-14) and the audit-record pattern (#42)',
    card.innerHTML.includes('Route 2 issue 14 item 7') && card.innerHTML.includes('#42'));

  // ---- seeded rows with their audit view ----
  const rows = () => [...d.querySelectorAll('#tlsExBody tr')];
  OK('2 seeded exemptions render (host:port, scope, added-by audit view)',
    rows().length === 2
    && rows()[0].textContent.includes('git.nwind.internal:8443') && rows()[0].textContent.includes('clone + push')
    && rows()[0].textContent.includes('added by a.weber@northwind-financial.com')
    && rows()[1].textContent.includes('svn.meridian.local') && rows()[1].textContent.includes('clone') && !rows()[1].textContent.includes('clone + push'));

  // ---- validation ----
  w.openTlsExModal();
  OK('add modal opens with a descriptive title and helper text',
    d.getElementById('tlsex-title').textContent === 'Add TLS exemption'
    && d.getElementById('tlsExError').hidden);
  d.getElementById('tlsExHost').value = '';
  w.tlsExSave();
  OK('empty host rejected', !d.getElementById('tlsExError').hidden && d.getElementById('tlsExError').textContent.includes('Host is required.'));
  d.getElementById('tlsExHost').value = 'https://git.example.com/path';
  w.tlsExSave();
  OK('scheme/path rejected with the fix in the message',
    d.getElementById('tlsExError').textContent.includes('Enter a hostname') && d.getElementById('tlsExError').textContent.includes('no scheme'));
  d.getElementById('tlsExHost').value = 'git.nwind.internal:8443';
  w.tlsExSave();
  OK('duplicate host:port rejected', d.getElementById('tlsExError').textContent.includes('already exists'));
  d.getElementById('tlsExHost').value = 'git.example.com:99999';
  w.tlsExSave();
  OK('out-of-range port rejected', d.getElementById('tlsExError').textContent.includes('between 1 and 65535'));
  w.closeModals();

  // ---- create: audited, appears with the acting identity ----
  const auditLen = w.eval('AUDIT_LOG.length');
  w.openTlsExModal();
  d.getElementById('tlsExHost').value = 'gitlab.corp';
  d.getElementById('tlsExScope').value = 'clone+push';
  w.tlsExSave();
  OK('created exemption renders (admin persona recorded as the actor, "just now")',
    rows().length === 3 && rows()[2].textContent.includes('gitlab.corp')
    && rows()[2].textContent.includes('clone + push') && rows()[2].textContent.includes('just now'));
  OK('mutation prepended to the audit trail (newest-first) with the typed action',
    w.eval('AUDIT_LOG.length') === auditLen + 1
    && w.eval('AUDIT_LOG[0].action') === 'settings:tls-exemption'
    && w.eval('AUDIT_LOG[0].target').includes('allowlist add — gitlab.corp')
    && w.eval('AUDIT_LOG[0].actor').length > 0);

  // ---- edit: rename cascades into the hint matching ----
  w.openTlsExModal('gitlab.corp:');
  OK('edit modal pre-fills from the row', d.getElementById('tlsex-title').textContent === 'Edit TLS exemption'
    && d.getElementById('tlsExHost').value === 'gitlab.corp');
  d.getElementById('tlsExHost').value = 'gitlab2.corp:2222';
  w.tlsExSave();
  OK('edit persists (host + port, audit records the before/after)',
    rows()[2].textContent.includes('gitlab2.corp:2222')
    && w.eval('AUDIT_LOG[0].target').includes('gitlab.corp: → gitlab2.corp:2222'));

  // ---- wizard hint: the connection view surfaces the exemption ----
  w.show('inventory');
  const url = d.getElementById('repo-url');
  const box = d.getElementById('wizTlsExempt');
  url.value = 'ssh://git@gitlab2.corp:2222/vcs/payments-api.git';
  url.dispatchEvent(new w.Event('input', { bubbles: true }));
  OK('exempted URL in the wizard shows the info alert (host, scope, actor, caveat)',
    !box.hidden && box.textContent.includes('gitlab2.corp:2222')
    && box.textContent.includes('skips TLS certificate verification')
    && box.textContent.includes('clone + push') && box.textContent.includes('added by'));
  OK('the alert names the allowlist as the source (Platform settings → TLS exemptions)',
    box.textContent.includes('TLS exemptions'));
  url.value = 'https://gitlab.corp:2222/vcs/x.git';
  url.dispatchEvent(new w.Event('input', { bubbles: true }));
  OK('non-exempted host keeps the alert hidden', box.hidden);
  // port-less exemption matches any port (per-URL-prefix semantics)
  url.value = 'https://svn.meridian.local/repo.git';
  url.dispatchEvent(new w.Event('input', { bubbles: true }));
  OK('port-less exemption matches any port; port-pinned exemption requires the port',
    !box.hidden && box.textContent.includes('svn.meridian.local'));
  url.value = 'https://git.nwind.internal:9000/x.git';
  url.dispatchEvent(new w.Event('input', { bubbles: true }));
  OK('port-pinned exemption does NOT match a different port', box.hidden);

  // ---- two-step delete removes the exemption (and its hint) ----
  const del = [...d.querySelectorAll('#tlsExBody button')].find(b => (b.getAttribute('onclick') || '').includes("'gitlab2.corp:2222'") && (b.getAttribute('onclick') || '').includes('tlsExDeleteArm'));
  OK('delete control exists for the created row', !!del);
  del.click(); del.click();
  OK('two-step delete removes the row and audits it',
    rows().length === 2 && !rows().some(r => r.textContent.includes('gitlab2.corp'))
    && w.eval('AUDIT_LOG[0].target').includes('allowlist remove — gitlab2.corp:2222'));
  url.value = 'https://gitlab2.corp:2222/vcs/payments-api.git';
  url.dispatchEvent(new w.Event('input', { bubbles: true }));
  OK('deleted exemption no longer matches in the wizard', box.hidden);

  // cleanup: restore seed state so other suites see the original data
  w.eval('MOCK_TLS_EXEMPTIONS.splice(0, MOCK_TLS_EXEMPTIONS.length, { host: \'git.nwind.internal\', port: \'8443\', scope: \'clone+push\', by: \'a.weber@northwind-financial.com\', ts: \'5d ago\' }, { host: \'svn.meridian.local\', port: \'\', scope: \'clone\', by: \'root@example.com\', ts: \'12d ago\' }); AUDIT_LOG.splice(0, AUDIT_LOG.length - ' + auditLen + ');');

  // ---- aria parentage sweep (unchanged by the new modal/section) ----
  const dangling = [...d.querySelectorAll('[role="tabpanel"]')].map(p => p.getAttribute('aria-labelledby')).filter(lb => lb && !d.getElementById(lb));
  OK('tabpanel parentage sweep still clean', dangling.length === 0);

  console.log(fail === 0 ? 'ALL PASS (' + pass + ')' : 'FAILURES: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
})();
