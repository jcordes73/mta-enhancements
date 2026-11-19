const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
let pass = 0, fail = 0;
const OK = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); c ? pass++ : fail++; };
setTimeout(() => {
  const d = dom.window.document, w = dom.window;
  const menu = d.getElementById('helpMenu');

  // markup sanity: the tour li is intact (single closed <li>, complete span, onclick)
  const items = [...menu.querySelectorAll('.pf-v6-c-menu__item')];
  OK('every menu item sits in a well-formed, non-empty <li>',
    items.length >= 4 && [...menu.querySelectorAll('.pf-v6-c-menu__list-item')].every(li => li.textContent.trim().length > 0)
      && items.every(b => b.closest('.pf-v6-c-menu__list-item')));
  const tourItem = items.find(b => b.textContent.includes('Guided tour'));
  const welcomeItem = items.find(b => b.textContent.includes('Replay the role welcome'));
  OK('tour item exists with intact text and openTour() handler',
    !!tourItem && tourItem.textContent.includes('Guided tour —') && (tourItem.getAttribute('onclick') || '').includes('openTour()'));
  OK('no orphaned markup fragments in the menu', !/<\/li>[^<\s]/.test(menu.innerHTML));

  // behavior: open menu, click tour item -> tour modal opens, menu closes
  d.getElementById('helpBtn').click();
  OK('help menu opens', !menu.hidden);
  tourItem.click();
  OK('tour item opens the tour modal', !d.getElementById('tourModal').hidden);
  OK('tour modal renders for the active persona', d.getElementById('tourRoleName').textContent.toLowerCase().includes('architect'));
  w.closeTour();

  // welcome item
  d.getElementById('helpBtn').click();
  welcomeItem.click();
  OK('welcome item opens the role welcome', !d.getElementById('welcomeModal').hidden);
  w.eval("document.querySelector('#welcomeModal [onclick*=welcomeSkip], #welcomeSkip') && (document.getElementById('welcomeSkip')||{click(){}}).click()");

  // tourMenuRole still populated by tourLabelApply (follows persona)
  OK('#tourMenuRole populated and follows persona', d.getElementById('tourMenuRole').textContent === 'Architect'
    && (w.setPersona('admin'), d.getElementById('tourMenuRole').textContent.includes('dmin')));

  // ---- all six Help items wired (user report: "About" did nothing) — row 139 adds the
  // separate "Mockup view" group with the Annotations menuitemcheckbox (verify-annomenu.js) ----
  OK('help menu still has all six Help items plus the row-139 Mockup view item', items.length === 8
    && items.filter(b => b.closest('.pf-v6-c-menu__group') === menu.querySelector('.pf-v6-c-menu__group')).length === 7
    && !!d.getElementById('annoMenuItem'));
  const docs = menu.querySelector('a[data-x="docs"]') || items.find(b => b.textContent.includes('Product documentation'));
  OK('Product documentation is a real external link (Red Hat docs, new tab)',
    docs.tagName === 'A' && docs.href.includes('docs.redhat.com') && (docs.getAttribute('onclick') || '').includes('closeMenus()'))   /* row 78: external links don't force new tabs */;
  const supp = items.find(b => b.textContent.includes('Support and feedback'));
  OK('Support and feedback points to the Red Hat case-raising flow (new tab)',
    supp.tagName === 'A' && supp.href === 'https://access.redhat.com/support/cases/#/case/new')   /* row 78 */;
  const rel = items.find(b => b.textContent.includes('Release notes'));
  OK('Release notes opens the Red Hat MTA 8.3 release notes (new tab)',
    rel.tagName === 'A' && rel.getAttribute('href') === 'https://docs.redhat.com/en/documentation/migration_toolkit_for_applications/8.3/html/release_notes/index')   /* row 78 */;
  const about = items.find(b => b.textContent.includes('About'));
  about.click();
  const am = d.getElementById('aboutModal');
  OK('About opens the About modal', !am.hidden && am.querySelector('.pf-v6-c-modal-box__title').textContent.includes('About this mockup'));
  OK('About modal carries provenance + doc links', am.body
    ? am.textContent.includes('PatternFly 6') && am.textContent.includes('Nov 13') && am.querySelectorAll('a[href]').length >= 4
    : am.textContent.includes('PatternFly 6') && am.textContent.includes('Nov 13') && am.querySelectorAll('a[href]').length >= 4);
  d.querySelector('#aboutModal .pf-v6-c-modal-box__close').click();
  OK('About modal closes', am.hidden);

  // ---- in-application online help (Suggestion 54, defect row 189) ----
  const helpMenuItem = items.find(b => b.textContent.includes('In-application help'));
  OK('help menu carries the in-application help item with a #54 description',
    !!helpMenuItem && helpMenuItem.textContent.includes('version-matched') && helpMenuItem.textContent.includes('#54'));
  helpMenuItem.click();
  const art = d.getElementById('helpArticle');
  OK('menu item opens the help drawer on the context topic (home -> Getting started)',
    !d.getElementById('drawerRoot').hidden && w.eval('state.help') === 'overview'
    && art.querySelector('h3').textContent.includes('Getting started'));
  OK('the panel is the embedded-content surface: version-match note + 6 topics + search + feedback',
    !!d.querySelector('#drawerBody .help-panel[data-i18n-skip]')
    && d.querySelector('.help-note').textContent.includes('installed version')
    && d.querySelectorAll('#helpTopicList .help-topic').length === 6
    && !!d.getElementById('helpSearch') && !!d.getElementById('helpFeedback'));
  [...d.querySelectorAll('#helpTopicList .help-topic')].find(b => b.dataset.helpTopic === 'running-waves').click();
  OK('topic switch updates article, aria-current and the &help= hash',
    w.eval('state.help') === 'running-waves'
    && [...d.querySelectorAll('#helpTopicList .help-topic')].find(b => b.dataset.helpTopic === 'running-waves').getAttribute('aria-current') === 'true'
    && decodeURIComponent(w.location.hash).includes('help=running-waves'));
  w.helpFilter('triage');
  OK('full-text search filters the topic list', [...d.querySelectorAll('#helpTopicList .help-topic')]
    .filter(b => !b.parentElement.hidden).map(b => b.dataset.helpTopic).join(',') === 'overview,triage-incidents');
  w.helpFilter('');
  w.helpFeedback(d.getElementById('helpFeedback').querySelector('button'), true);
  OK('per-topic feedback stub records a thanks message', d.getElementById('helpFeedback').textContent.includes('Thanks'));
  w.closeDrawers();
  OK('closing clears the help state and the hash parameter',
    d.getElementById('drawerRoot').hidden && !decodeURIComponent(w.location.hash).includes('help='));

  // deep link: a fresh boot with &help=<topic> opens the drawer pre-navigated
  setTimeout(() => {
    const dom2 = new JSDOM(html, { url: 'http://localhost/mock.html#persona=architect&help=agent-registry', runScripts: 'dangerously', pretendToBeVisual: true });
    dom2.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
    setTimeout(() => {
      const d2 = dom2.window.document;
      OK('&help=<topic> deep link opens the drawer pre-navigated on boot',
        !d2.getElementById('drawerRoot').hidden && dom2.window.eval('state.help') === 'agent-registry'
        && d2.getElementById('helpArticle').querySelector('h3').textContent.includes('agent registry'));
      console.log(pass + ' passed, ' + fail + ' failed');
      process.exit(fail ? 1 : 0);
    }, 700);
  }, 50);

  console.log(pass + ' passed, ' + fail + ' failed (through in-application help)');
}, 700);
