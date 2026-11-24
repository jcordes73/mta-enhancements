const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://mock.test/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
let pass = 0, fail = 0;
const OK = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); c ? pass++ : fail++; };
setTimeout(() => {
  const d = dom.window.document, w = dom.window;
  // boot: first visit, no hash -> welcome for the boot persona (architect)
  const wm = d.getElementById('welcomeModal');
  OK('first visit greets the boot persona', !wm.hidden && d.getElementById('welcomeRole').textContent === 'an Architect');
  OK('welcome reuses the role tour question (no re-written copy)', d.getElementById('welcomeQ').textContent === w.eval('TOURS.architect.q'));
  OK('primary button names the role tour', d.getElementById('welcomeStartLabel').textContent === 'Start the Architect tour');
  // start -> flag set, welcome closes, tour opens at step 1
  d.querySelector('#welcomeModal .pf-m-primary').click();
  OK('"Start the tour" persists the flag, closes welcome, opens the role tour', wm.hidden && !d.getElementById('tourModal').hidden
    && w.eval("localStorage.getItem('mta.welcome.architect')") === '1');
  OK('tour opened at the role\'s first question', d.getElementById('tourQ').textContent.includes(w.eval('TOURS.architect.q').slice(1, 20)));
  w.closeTour();
  // second boot in a fresh-but-same storage? jsdom storage is per-instance; simulate return: new persona not seen yet
  w.setPersona('admin');
  OK('first entry into a new role greets it', !d.getElementById('welcomeModal').hidden && d.getElementById('welcomeRole').textContent === 'an Administrator'
    && d.getElementById('welcomeStartLabel').textContent === 'Start the Administrator tour');
  // skip persists
  [...d.querySelectorAll('#welcomeModal button')].find(b => b.textContent.includes('Skip')).click();
  OK('"Skip" persists the flag and closes', wm.hidden && w.eval("localStorage.getItem('mta.welcome.admin')") === '1');
  // re-entering a seen role does NOT re-greet
  w.setPersona('migrator');
  OK('migrator greets on first entry', !d.getElementById('welcomeModal').hidden);
  [...d.querySelectorAll('#welcomeModal button')].find(b => b.textContent.includes('Skip')).click();
  w.setPersona('admin');
  OK('returning to a seen role does not re-greet', wm.hidden);
  // ✕ closes without persisting
  w.setPersona('pm');
  const before = w.eval("localStorage.getItem('mta.welcome.pm')");
  d.querySelector('#welcomeModal .pf-v6-c-modal-box__close').click();
  OK('✕ closes without persisting (reminds next visit)', wm.hidden && w.eval("localStorage.getItem('mta.welcome.pm')") === before);
  // help menu replay
  w.eval("closeMenus(); welcomeShow()");
  OK('Help-menu replay re-opens the welcome for the current role', !wm.hidden && d.getElementById('welcomeRole').textContent === 'a Project manager');
  d.querySelector('#welcomeModal .pf-m-primary').click();
  // persona switch mid-tour: tour re-renders, welcome does not fight it
  w.setPersona('pgm');
  OK('switching mid-tour re-renders the tour, no welcome fight', !d.getElementById('tourModal').hidden && wm.hidden
    && d.getElementById('tourRoleName').textContent.includes('Program manager'));
  w.closeTour();
  // deep links skip the welcome
  const dom2 = new JSDOM(html.replace('</body>', '<script>localStorage.clear();</script>'), { url: 'http://mock.test/mock.html#scr=waves&persona=pm', runScripts: 'dangerously', pretendToBeVisual: true });
  setTimeout(() => {
    const d2 = dom2.window.document;
    OK('deep link with unseen persona skips the welcome (shared context)', d2.getElementById('welcomeModal').hidden);
    // boot with no hash in a fresh storage greets
    const dom3 = new JSDOM(html, { url: 'http://mock.test/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
    setTimeout(() => {
      OK('fresh boot (no hash, no flags) greets the boot persona', !dom3.window.document.getElementById('welcomeModal').hidden);
      console.log(pass + ' passed, ' + fail + ' failed');
      process.exit(fail ? 1 : 0);
    }, 700);
  }, 700);
}, 700);
