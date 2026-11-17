const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
let pass = 0, fail = 0;
const OK = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); c ? pass++ : fail++; };
setTimeout(() => {
  const w = dom.window, d = w.document;
  OK('boot: toggle label Architect + the persona\u2019s directory username left of it (row-131 MOCK_USERS via PERSONA_LOGIN)',
    d.getElementById('personaToggleLabel').textContent === 'Architect'
    && d.getElementById('personaUser').textContent === 'm.keller@northwind-financial.com');
  OK('dropdown menu built with the six personas, closed at boot',
    d.querySelectorAll('#personaMenuContent .pf-v6-c-menu__item').length === 6 && d.getElementById('personaMenu').hidden);
  OK('the username carries data-i18n-skip (data stays data)', d.getElementById('personaUser').hasAttribute('data-i18n-skip'));
  d.getElementById('personaBtn').click();
  OK('toggle opens the menu, focuses the first item, aria-expanded syncs (row-89 menu behavior)',
    !d.getElementById('personaMenu').hidden
    && d.getElementById('personaBtn').getAttribute('aria-expanded') === 'true'
    && d.activeElement && d.activeElement.classList.contains('pf-v6-c-menu__item'));
  OK('current persona item carries pf-m-selected',
    d.querySelector('#personaMenu [data-persona="architect"]').classList.contains('pf-m-selected'));
  d.querySelector('#personaMenu [data-persona="admin"]').click();
  OK('item click switches persona, updates label + username, closes the menu',
    w.eval('state.persona') === 'admin'
    && d.getElementById('personaToggleLabel').textContent === 'Admin'
    && d.getElementById('personaUser').textContent === 'a.weber@northwind-financial.com'
    && d.getElementById('personaMenu').hidden
    && d.body.dataset.persona === 'admin');
  w.eval("setPersona('padmin', true)");
  OK('deep-link setPersona updates label + username (Platform admin / root@example.com)',
    d.getElementById('personaToggleLabel').textContent === 'Platform admin'
    && d.getElementById('personaUser').textContent === 'root@example.com');
  OK('no toggle-group remnants in the masthead', !d.querySelector('.pf-v6-c-masthead .pf-v6-c-toggle-group'));
  d.getElementById('personaBtn').click();
  w.eval('closeMenus()');
  OK('closeMenus hides the menu and resets aria-expanded',
    d.getElementById('personaMenu').hidden && d.getElementById('personaBtn').getAttribute('aria-expanded') === 'false');
  console.log(fail === 0 ? 'ALL PASS (' + pass + ')' : 'FAILURES: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}, 400);
