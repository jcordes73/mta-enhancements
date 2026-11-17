const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
function make(hash){
  const dom = new JSDOM(html, { url: 'http://localhost/mock.html' + (hash || ''), runScripts: 'dangerously', pretendToBeVisual: true });
  dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
  return dom;
}
let pass = 0, fail = 0;
const OK = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); c ? pass++ : fail++; };

const dom = make('#scr=home&persona=architect');
setTimeout(async () => {
  const d = dom.window.document, w = dom.window;
  w.eval("localStorage.setItem('mta.welcome.architect','1'); localStorage.setItem('mta.welcome.admin','1')");
  const navApp = () => d.querySelector('.pf-v6-c-nav__link[data-screen="inventory"]');   // locate by screen, not text (text is the thing under test)
  const enNav = navApp().textContent, enTitle = d.querySelector('#scr-home .page-title').textContent;

  const langSel = (l) => d.getElementById('langMenu').querySelector('[data-lang="' + l + '"]').classList.contains('pf-m-selected');

  // boot: EN default — dropdown marks EN selected, toggle shows the native name
  OK('boots in English (row 98: toggle label is the native name, no flag)', d.body.dataset.lang === 'en' && langSel('en') && d.getElementById('langToggleLabel').textContent === 'English');

  // dropdown behavior: opens with 8 language options (row 98: countries/flags removed), selection switches language
  d.getElementById('langSwitch').click();
  OK('dropdown opens with 8 language options, no flags/countries (row 98)', !d.getElementById('langMenu').hidden
    && d.querySelectorAll('#langMenu [data-lang]').length === 8
    && !d.querySelector('#langMenu .lang-flag')
    && d.querySelector('#langMenu [data-lang="ja"] .pf-v6-c-menu__item-text').textContent === '日本語'
    && d.querySelector('#langMenu [data-lang="de"] .pf-v6-c-menu__item-text').textContent === 'Deutsch');
  d.querySelector('#langMenu [data-lang="de"]').click();

  // switch to DE
  w.setLang('de');
  OK('body + switcher reflect DE', d.body.dataset.lang === 'de' && langSel('de') && d.getElementById('langToggleLabel').textContent === 'Deutsch'
    && d.getElementById('langMenu').hidden);   /* dropdown closed again after selection */
  OK('nav translated', navApp().textContent.includes('Anwendungen'));
  OK('Home page title translated', d.querySelector('#scr-home .page-title').textContent.includes('Startseite'));
  OK('masthead chrome translated', d.querySelector('.anno-switch .pf-v6-c-switch__label').textContent.includes('Anmerkungen'));
  OK('KPI card titles translated', [...d.querySelectorAll('#scr-home .pf-v6-c-card__title')].some(t => t.textContent.includes('Aufwandssumme')));
  OK('table headers translated', [...d.querySelectorAll('#scr-home th')].some(t => t.textContent.trim() === 'Domäne') || [...d.querySelectorAll('#scr-home th')].some(t => t.textContent.includes('Domäne')));
  OK('state carries lang', w.eval('state.lang') === 'de');
  OK('trend caption: dynamic date fragments translated (user report)', d.getElementById('lpArchTrendCaption').textContent.includes('am 3. Nov')
    && d.getElementById('lpArchTrendCaption').textContent.includes('seit 8. Sep'));
  OK('DE: ISO dataset dates render in German everywhere', d.getElementById('lpArchTrendDates').textContent.includes('3. Nov')
    && !/\d{4}-\d{2}-\d{2}/.test(d.getElementById('scr-home').textContent));

  // #58: annotation content stays English — badges (#N), tip prose (data-tip → #annoTip), in every language
  const annoBadge = [...d.querySelectorAll('.anno[data-tip]')].find(a => a.dataset.tip.length > 30);
  w.showAnnoTip(annoBadge);
  await new Promise(r => setTimeout(r, 60));
  OK('annotation tip prose byte-exact English in DE', d.getElementById('annoTip').getAttribute('data-i18n-skip') === '1'
    && d.getElementById('annoTip').textContent === annoBadge.dataset.tip);
  OK('annotation badge text stays #N', /^#\d+$/.test(annoBadge.textContent.trim()));
  w.hideAnnoTip();

  // #61: monetary amounts render in the active locale's currency (row 98: locale, not country lists), USD default; store keeps USD
  const sleep61 = (ms) => new Promise(r => setTimeout(r, ms));
  await sleep61(120);   /* let the observer settle after DE renders */
  d.getElementById('annoTip').textContent = '';   /* audit excludes the EN-only tip (its #20 text carries a literal $) */
  const moneyOnPage = (() => {
    const walker = d.createTreeWalker(d.body, w.NodeFilter.SHOW_TEXT);
    const hits = new Set();
    while (walker.nextNode()){
      if (walker.currentNode.parentElement.closest('script, style')) continue;   /* source, not UI */
      const m = walker.currentNode.nodeValue.match(/[€$¥₺]|ر\.س/g);
      if (m) m.forEach(x => hits.add(x));
    }
    return [...hits].sort().join(' ');
  })();
  console.log('  KPI:', JSON.stringify(d.getElementById('rptKpiCost')?.textContent));
  OK('DE: costs render in EUR (primary country DE), no other currency symbol on the page', moneyOnPage === '€');
  OK('DE: Reports KPI converted (run-derived $93.37 → €85,90)', d.getElementById('rptKpiCost')?.textContent === '85,90 €');
  const gwInp61 = () => [...d.getElementById('gwUseBody').querySelectorAll('input[type=number]')];
  OK('DE: rate inputs follow EUR (2.0971 USD → 1.9293) with EUR aria label', gwInp61()[0].value === '1.9293'
    && gwInp61()[0].getAttribute('aria-label').includes('(EUR)'));
  gwInp61()[0].value = '2';   /* type 2 EUR / 1M */
  gwInp61()[0].dispatchEvent(new w.Event('change'));
  OK('DE: EUR edit stores USD in the gateway (2 / 0.92 = 2.173913)', w.eval("MOCK_GATEWAYS[0].rate") === '2.173913');
  w.setLang('en');
  await sleep61(100);
  OK('EN round-trip: edited gateway re-priced ($89.57) and KPI back in $', [...d.getElementById('gwUseBody').querySelectorAll('tr')][0].cells[5].textContent.includes('$89.57')
    && d.getElementById('rptKpiCost')?.textContent.startsWith('$'));
  w.eval("MOCK_GATEWAYS[0].rate = '2.0971'; renderGateways();");   /* restore the shipped rate */
  w.setLang('de');   /* downstream checks expect DE */
  await sleep61(100);

  // composed labels via rules: tour + dock (MutationObserver is async — yield first)
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  w.openTour(1);
  await sleep(60);
  OK('tour modal translated', d.getElementById('tourRoleName').textContent === 'Architekt'
    && d.getElementById('tourQ').textContent.startsWith('Ihre erste Frage'));
  w.tourOpenView();   // park at step 2 → dock
  await sleep(60);
  OK('dock composed in German', d.getElementById('dockTitle').textContent.includes('Architekt-Tour')
    && d.getElementById('dockStep').textContent.startsWith('Schritt 2 von 5'));
  OK('Home resume label composed in German', d.getElementById('homeTourLabel').textContent.startsWith('Geführte Tour als Architekt fortsetzen'));
  w.dockResume();
  await sleep(60);
  OK('tour progress rule', d.getElementById('tourProgress').textContent.includes('Schritt 2 von 5'));
  OK('tour step title translated', [...d.querySelectorAll('#tourList li')].some(li => li.textContent.includes('Portfolio-Gesundheit')));
  w.closeTour();

  // dynamic content rendered AFTER the switch (observer): the scope note re-composes
  w.eval('applyTenancy && applyTenancy()');
  await sleep(60);
  OK('JS-composed scope note translated (observer)', [...d.querySelectorAll('#scr-home .u-meta')].some(el => el.textContent.includes('Datenbereich')));

  // round-trip: switching back restores exact original English
  w.setLang('en');
  OK('nav restored to exact original', navApp().textContent === enNav);
  OK('Home title restored to exact original', d.querySelector('#scr-home .page-title').textContent === enTitle);
  OK('body back to EN', d.body.dataset.lang === 'en' && w.eval('state.lang') === 'en');

  // persistence: localStorage holds the choice
  w.setLang('de');
  OK('choice persisted to localStorage', w.eval("localStorage.getItem('mta.lang')") === 'de');

  // ---- Arabic: RTL + dictionary ----
  w.setLang('en');
  await sleep(40);
  const enNav2 = navApp().textContent;   // captured in EN mode
  w.setLang('ar');
  OK('AR: document flips to RTL', d.documentElement.dir === 'rtl');
  OK('AR: nav translated', navApp().textContent.includes('التطبيقات'));
  OK('AR: Home title translated', d.querySelector('#scr-home .page-title').textContent.includes('الرئيسية'));
  OK('AR: masthead chrome translated', d.querySelector('.anno-switch .pf-v6-c-switch__label').textContent.includes('التعليقات التوضيحية'));
  w.openTour(1);
  await sleep(60);
  OK('AR: tour composed via rules', d.getElementById('tourRoleName').textContent === 'مهندس'
    && d.getElementById('tourQ').textContent.startsWith('سؤالك الأول'));
  w.tourOpenView();
  await sleep(60);
  OK('AR: dock composed in Arabic', d.getElementById('dockStep').textContent.startsWith('الخطوة 2 من 5'));
  w.dockResume(); w.closeTour();
  w.setLang('en');
  await sleep(60);
  OK('AR→EN: layout flips back to LTR', d.documentElement.dir === 'ltr');
  OK('AR→EN: nav restored byte-exact', navApp().textContent === enNav2);

  // ---- Spanish + French: dictionary + composition rules ----
  w.setLang('es');
  await sleep(40);
  OK('ES: switcher + state reflect ES', d.body.dataset.lang === 'es' && langSel('es') && d.getElementById('langToggleLabel').textContent === 'Español');
  OK('ES: nav translated', navApp().textContent.includes('Aplicaciones'));
  OK('ES: Home title translated', d.querySelector('#scr-home .page-title').textContent.includes('Inicio'));
  OK('ES: masthead chrome translated', d.querySelector('.anno-switch .pf-v6-c-switch__label').textContent.includes('Anotaciones'));
  w.openTour(1);
  await sleep(60);
  OK('ES: tour composed via rules', d.getElementById('tourRoleName').textContent === 'arquitecto'   /* mid-sentence form, matches the modal title */
    && d.getElementById('tourQ').textContent.startsWith('Tu primera pregunta'));
  w.tourOpenView();
  await sleep(60);
  OK('ES: dock composed in Spanish', d.getElementById('dockStep').textContent.startsWith('Paso 2 de 5'));
  w.dockResume(); w.closeTour();
  w.setLang('en');
  await sleep(40);
  OK('ES→EN: nav restored byte-exact', navApp().textContent === enNav2);

  w.setLang('fr');
  await sleep(40);
  OK('FR: switcher + state reflect FR', d.body.dataset.lang === 'fr' && langSel('fr') && d.getElementById('langToggleLabel').textContent === 'Français');
  OK('FR: nav translated', navApp().textContent.includes('Applications'));
  OK('FR: Home title translated', d.querySelector('#scr-home .page-title').textContent.includes('Accueil'));
  OK('FR: masthead chrome translated', d.querySelector('.anno-switch .pf-v6-c-switch__label').textContent.includes('Annotations'));
  w.openTour(1);
  await sleep(60);
  OK('FR: tour composed via rules', d.getElementById('tourRoleName').textContent === 'architecte'
    && d.getElementById('tourQ').textContent.startsWith('Votre première question'));
  w.tourOpenView();
  await sleep(60);
  OK('FR: dock composed in French', d.getElementById('dockStep').textContent.startsWith('Étape 2 sur 5'));
  w.dockResume(); w.closeTour();
  w.setLang('en');
  await sleep(60);
  OK('FR→EN: nav restored byte-exact', navApp().textContent === enNav2);
  OK('FR→EN: Home title restored byte-exact', d.querySelector('#scr-home .page-title').textContent === enTitle);

  // ---- Japanese: dictionary + composition rules (no RTL, no case) ----
  w.setLang('ja');
  await sleep(40);
  OK('JA: switcher + state reflect JA', d.body.dataset.lang === 'ja' && langSel('ja') && d.getElementById('langToggleLabel').textContent === '日本語');
  OK('JA: nav translated', navApp().textContent.includes('アプリケーション'));
  OK('JA: Home title translated', d.querySelector('#scr-home .page-title').textContent.includes('ホーム'));
  OK('JA: masthead chrome translated', d.querySelector('.anno-switch .pf-v6-c-switch__label').textContent.includes('アノテーション'));
  w.openTour(1);
  await sleep(60);
  OK('JA: tour composed via rules', d.getElementById('tourRoleName').textContent === 'アーキテクト'
    && d.getElementById('tourQ').textContent.startsWith('最初の質問'));
  w.tourOpenView();
  await sleep(60);
  OK('JA: dock composed in Japanese', d.getElementById('dockStep').textContent.startsWith('ステップ 2 / 5'));
  w.dockResume(); w.closeTour();
  w.setLang('en');
  await sleep(60);
  OK('JA→EN: nav restored byte-exact', navApp().textContent === enNav2);
  OK('JA→EN: Home title restored byte-exact', d.querySelector('#scr-home .page-title').textContent === enTitle);
  OK('JA→EN: dates restored to the EN short form', d.getElementById('lpArchTrendDates').textContent.includes('Nov 3')
    && d.getElementById('lpArchTrendCaption').textContent.includes('on Nov 3, −41% since Sep 8'));

  // ---- Italian: dictionary + composition rules ----
  w.setLang('it');
  await sleep(40);
  OK('IT: switcher + state reflect IT', d.body.dataset.lang === 'it' && langSel('it') && d.getElementById('langToggleLabel').textContent === 'Italiano');
  OK('IT: nav translated', navApp().textContent.includes('Applicazioni'));
  OK('IT: Home title translated', d.querySelector('#scr-home .page-title').textContent.includes('Pagina iniziale'));
  OK('IT: masthead chrome translated', d.querySelector('.anno-switch .pf-v6-c-switch__label').textContent.includes('Annotazioni'));
  w.openTour(1);
  await sleep(60);
  OK('IT: tour composed via rules', d.getElementById('tourRoleName').textContent === 'architetto'
    && d.getElementById('tourQ').textContent.startsWith('La tua prima domanda'));
  w.tourOpenView();
  await sleep(60);
  OK('IT: dock composed in Italian', d.getElementById('dockStep').textContent.startsWith('Passaggio 2 di 5'));
  w.dockResume(); w.closeTour();
  w.setLang('en');
  await sleep(60);
  OK('IT→EN: nav restored byte-exact', navApp().textContent === enNav2);
  OK('IT→EN: Home title restored byte-exact', d.querySelector('#scr-home .page-title').textContent === enTitle);

  // ---- Turkish: dictionary + composition rules ----
  w.setLang('tr');
  await sleep(40);
  OK('TR: switcher + state reflect TR', d.body.dataset.lang === 'tr' && langSel('tr') && d.getElementById('langToggleLabel').textContent === 'Türkçe');
  OK('TR: nav translated', navApp().textContent.includes('Uygulamalar'));
  OK('TR: Home title translated', d.querySelector('#scr-home .page-title').textContent.includes('Ana Sayfa'));
  OK('TR: masthead chrome translated', d.querySelector('.anno-switch .pf-v6-c-switch__label').textContent.includes('Açıklamalar'));
  const trCap = d.getElementById('lpArchTrendCaption').textContent.replace(/\s+/g, ' ');
    OK('TR: trend caption + composed chips translated', trCap.includes('3 Kas, tarihinde')
    && trCap.includes('8 Eyl itibarıyla'));
  w.openTour(1);
  await sleep(60);
  OK('TR: tour composed via rules', d.getElementById('tourRoleName').textContent === 'mimar'
    && d.getElementById('tourQ').textContent.startsWith('İlk sorunuz'));
  w.tourOpenView();
  await sleep(60);
  OK('TR: dock composed in Turkish', d.getElementById('dockStep').textContent.startsWith('Adım 2 / 5'));
  OK('TR: Home resume label capitalized', d.getElementById('homeTourLabel').textContent.startsWith('Mimar olarak rehberli tur'));
  w.dockResume(); w.closeTour();
  w.setLang('en');
  await sleep(60);
  OK('TR→EN: nav restored byte-exact', navApp().textContent === enNav2);
  OK('TR→EN: Home title restored byte-exact', d.querySelector('#scr-home .page-title').textContent === enTitle);

  // deep link boots in German
  const dom2 = make('#scr=home&persona=architect&lang=de');
  setTimeout(() => {
    const d2 = dom2.window.document;
    OK('deep link &lang=de boots German', d2.body.dataset.lang === 'de' && [...d2.querySelectorAll('.pf-v6-c-nav__link')].some(l => l.textContent.includes('Anwendungen')));
    // deep link boots in Arabic, RTL
    const dom3 = make('#scr=home&persona=architect&lang=ar');
    setTimeout(() => {
      const d3 = dom3.window.document;
      OK('deep link &lang=ar boots Arabic RTL', d3.documentElement.dir === 'rtl' && [...d3.querySelectorAll('.pf-v6-c-nav__link')].some(l => l.textContent.includes('التطبيقات')));
      const dom4 = make('#scr=home&persona=architect&lang=es');
      setTimeout(() => {
        const d4 = dom4.window.document;
        OK('deep link &lang=es boots Spanish', d4.body.dataset.lang === 'es' && [...d4.querySelectorAll('.pf-v6-c-nav__link')].some(l => l.textContent.includes('Aplicaciones')));
        const dom5 = make('#scr=home&persona=architect&lang=fr');
        setTimeout(() => {
          const d5 = dom5.window.document;
          OK('deep link &lang=fr boots French', d5.body.dataset.lang === 'fr' && [...d5.querySelectorAll('.pf-v6-c-nav__link')].some(l => l.textContent.includes('Accueil')));
          const dom6 = make('#scr=home&persona=architect&lang=ja');
          setTimeout(() => {
            const d6 = dom6.window.document;
            OK('deep link &lang=ja boots Japanese', d6.body.dataset.lang === 'ja' && [...d6.querySelectorAll('.pf-v6-c-nav__link')].some(l => l.textContent.includes('アプリケーション')));
            const dom7 = make('#scr=home&persona=architect&lang=it');
            setTimeout(() => {
              const d7 = dom7.window.document;
              OK('deep link &lang=it boots Italian', d7.body.dataset.lang === 'it' && [...d7.querySelectorAll('.pf-v6-c-nav__link')].some(l => l.textContent.includes('Applicazioni')));
              const dom8 = make('#scr=home&persona=architect&lang=tr');
              setTimeout(() => {
                const d8 = dom8.window.document;
                OK('deep link &lang=tr boots Turkish', d8.body.dataset.lang === 'tr' && [...d8.querySelectorAll('.pf-v6-c-nav__link')].some(l => l.textContent.includes('Uygulamalar')));
                console.log(pass + ' passed, ' + fail + ' failed');
              }, 700);
            }, 700);
          }, 700);
        }, 700);
      }, 700);
    }, 700);
  }, 700);
}, 700);
