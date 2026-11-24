const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
let pass = 0, fail = 0;
const OK = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); c ? pass++ : fail++; };
setTimeout(() => {
  const d = dom.window.document, w = dom.window;

  // ---- boot render (row 129: token administration on Config -> Access) ----
  const body = d.getElementById('tokBody');
  OK('token table renders from MOCK_TOKENS at boot (11 non-expired of 13)', !!body && body.children.length === 11);
  OK('pager count shows 1-10 of 11 across 2 pages',
    d.getElementById('tokCount').textContent.replace(/\s+/g, ' ').includes('1–10') && d.getElementById('tokCount').textContent.includes('11') && d.getElementById('tokPageOf').textContent === 'of 2');
  OK('summary line counts the FULL store (13 tokens / 11 active / 2 expired)',
    d.getElementById('tokSummary').textContent.includes('13 tokens') && d.getElementById('tokSummary').textContent.includes('11 active') && d.getElementById('tokSummary').textContent.includes('2 expired'));
  OK('the two legacy demo rows keep their visible content (api-key 2027-09-12 ok 14m / 2036-08-01 ~10y + hub#1082 anno)',
    (() => { const r1 = body.querySelector('[data-tok="1"]'), r2 = body.querySelector('[data-tok="2"]');
      return !!r1 && r1.textContent.includes('Sep 12') && r1.textContent.includes('ok') && r1.textContent.includes('14m ago')
        && !!r2 && r2.textContent.includes('Aug 1') && r2.textContent.includes('~10y default') && !!r2.querySelector('.anno'); })());
  OK('every row carries the live column set (id/login/kind/scopes/issued/expires/lifespan/last-used) + revoke action',
    [...body.querySelectorAll('tr')].every(r => r.children.length === 10 && r.querySelector('[data-rbac="tokens:revoke"]')));
  OK('lifespan (h) is derived (8,760 for the 1-year keys)', [...body.querySelectorAll('tr')].filter(r => r.textContent.includes('8,760')).length >= 4);

  // RBAC: revoke buttons gate on tokens:revoke (before any mutation empties the store)
  w.setPersona('admin');
  w.renderTokens();
  OK('as admin the revoke buttons are enabled (tokens:revoke via * scopes)', [...d.querySelectorAll('#tokBody [data-rbac]')].every(b => !b.disabled));
  w.setPersona('architect');
  w.renderTokens();
  const archBtn = d.querySelector('#tokBody [data-rbac]');
  OK('as architect the revoke buttons are disabled with an explanatory title', !!archBtn && archBtn.disabled && (archBtn.title || '').includes('tokens:revoke'));
  w.setPersona('admin');
  w.renderTokens();

  // expired hidden by default, shown by the toggle
  OK('expired tokens hidden by default (11 visible)', [...body.querySelectorAll('tr')].every(r => !r.textContent.includes('expired')));
  d.getElementById('tokExpiredSw').checked = true;
  w.tokApply();
  OK('show-expired toggle reveals both expired rows (13 visible)', body.children.length === 13
    && [...body.querySelectorAll('tr')].filter(r => r.textContent.includes('expired')).length === 2);

  // kind filter
  const apiItem = [...d.querySelectorAll('#panel-cfg-access .pf-v6-c-menu__item')].find(b => (b.getAttribute('onclick') || '').includes("tokKindSet('api-key'"));
  apiItem.click();
  OK('kind filter narrows to the 4 api-key rows and closes its menu', body.children.length === 4
    && [...body.querySelectorAll('tr')].every(r => r.children[3].textContent === 'api-key') && apiItem.closest('.pf-v6-c-menu').hidden);
  OK('kind filter updates the toggle text', d.getElementById('tokKindText').textContent === 'Kind: api-key');
  const allItem = [...d.querySelectorAll('#panel-cfg-access .pf-v6-c-menu__item')].find(b => (b.getAttribute('onclick') || '').includes("tokKindSet(''"));
  allItem.click();
  OK('All kinds restores 13 rows', body.children.length === 13);

  // search
  d.getElementById('tokSearch').value = 'svc-';
  w.tokApply();
  OK('search narrows by login', body.children.length === 7 && [...body.querySelectorAll('tr')].every(r => r.children[2].textContent.startsWith('svc-')));
  d.getElementById('tokSearch').value = 'waves:post';
  w.tokApply();
  OK('search matches scopes too', body.children.length === 1 && body.children[0].dataset.tok === '8');
  d.getElementById('tokSearch').value = '';
  w.tokApply();

  // sortable headers (row-92 glyph + aria-sort idiom)
  const thExpires = d.querySelector('#tokHead [data-sort="expires"]');
  w.tokSort('expires');
  OK('sort by expiration ascending puts the earliest expiry first (id 9) and syncs aria-sort',
    body.children[0].dataset.tok === '9' && thExpires.getAttribute('aria-sort') === 'ascending' && thExpires.querySelector('.pf-v6-c-table__sort-indicator').innerHTML.includes('svg'));
  w.tokSort('expires');
  OK('second click flips direction (descending, aria-sort=descending)', body.children[0].dataset.tok === '2' && thExpires.getAttribute('aria-sort') === 'descending');
  w.tokSort('id');
  OK('sorting by id restores natural order (row 1 first)', body.children[0].dataset.tok === '1');

  // pagination across the shared pager
  OK('rows beyond the page window stay in the DOM but hidden (display-toggle discipline)',
    [...body.children].filter(r => r.style.display === 'none').length === 3);
  w.pagerGoto('tok', 2);
  OK('page 2 shows the remaining 3 rows', [...body.children].filter(r => r.style.display !== 'none').length === 3);
  w.pagerGoto('tok', 1);

  // single revoke: modal -> confirm -> row gone, audit + toast
  w.tokRevoke(3);
  OK('row revoke opens the confirmation modal with the token named', !d.getElementById('modalRevoke').hidden
    && d.getElementById('mr-target').textContent.includes('svc-maven-proxy') && d.getElementById('mr-target').textContent.includes('#3'));
  OK('modal danger submit is wired to tokRevokeConfirm (was a stub)', (d.querySelector('#modalRevoke .pf-v6-c-button.pf-m-danger').getAttribute('onclick') || '').includes('tokRevokeConfirm'));
  w.tokRevokeConfirm();
  OK('confirmed revoke removes the token from the table', !d.querySelector('#tokBody [data-tok="3"]') && body.children.length === 12);
  OK('revoke closes the modal', d.getElementById('modalRevoke').hidden);
  OK('revoke is audited (token:revoke, #42)', w.eval("AUDIT_LOG[0].action === 'token:revoke' && AUDIT_LOG[0].target.includes('svc-maven-proxy')"));
  OK('revoke toast fires', !!d.getElementById('rbacToast') && d.getElementById('rbacToast').textContent.includes('revoked'));
  OK('summary counts the session revocation', d.getElementById('tokSummary').textContent.includes('1 revoked this session'));

  // bulk revoke incl. cross-page select-all (#35 pain point)
  w.tokSelAll();
  OK('select-all-filtered checks every filtered row across pages', [...body.querySelectorAll('input[type=checkbox]')].filter(c => c.checked).length === 12);
  w.tokBulkRevoke();
  OK('bulk revoke opens the modal with the selection named', !d.getElementById('modalRevoke').hidden && d.getElementById('mr-target').textContent.includes('12 selected tokens'));
  w.tokRevokeConfirm();
  OK('bulk confirm revokes every selected token (table empty)', body.children.length === 0);
  OK('bulk revoke lands in the audit trail', w.eval("AUDIT_LOG[0].action === 'token:revoke' && AUDIT_LOG[0].target.split(',').length === 12"));
  OK('summary reflects 13 revoked this session', d.getElementById('tokSummary').textContent.includes('13 revoked this session'));

  // empty state + row-87 pager hiding
  d.getElementById('tokExpiredSw').checked = true;
  d.getElementById('tokSearch').value = 'zzz-no-match';
  w.tokApply();
  OK('zero matches show the empty state and hide the table + pager (row-87)',
    !d.getElementById('tokEmpty').hidden && d.getElementById('tokTable').hidden && d.getElementById('tokPag').hidden);
  d.getElementById('tokSearch').value = '';
  w.tokApply();

  // the Agentic "rotate under Tokens" link now routes to Config -> Access
  const tokLink = [...d.querySelectorAll('a[onclick*="cfgTabApply"]')].find(a => a.textContent.trim() === 'Tokens');
  OK('the inert "rotate under Tokens" link routes to Config > Access (row-128 follow-up)', !!tokLink && (tokLink.getAttribute('onclick') || '').includes("show('config')"));
  tokLink.click();
  OK('clicking it lands on the config screen with the Access leaf active (row 234: left sub-nav)',
    d.getElementById('scr-config').classList.contains('active') && !d.getElementById('panel-cfg-access').hidden
    && d.querySelector('#cfgSubnav a[data-cfg-tab="access"]').getAttribute('aria-current') === 'page');
  OK('and the Tokens card is the visible tab (row 239: cfgCardGo selects the Tokens card — row 240: card 4)',
    !d.getElementById('cfgcp-access-4').hidden
    && d.getElementById('cfgcp-access-4').textContent.includes('Tokens')
    && d.getElementById('cfg-users').hidden);

  console.log(fail === 0 ? 'ALL PASS (' + pass + ')' : 'FAILURES: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}, 400);
