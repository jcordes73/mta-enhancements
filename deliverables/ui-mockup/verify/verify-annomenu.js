const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
let pass = 0, fail = 0;
const OK = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); c ? pass++ : fail++; };
setTimeout(() => {
  const w = dom.window, d = w.document;

  // ---- masthead: the switch is gone, the divider CSS no longer paints a border ----
  OK('no annotations switch left in the masthead', !d.querySelector('.anno-switch') && !d.getElementById('annoToggle'));
  const rule = [...d.styleSheets].some(ss => { try { return [...ss.cssRules].some(r => r.cssText && r.cssText.includes('.mh-group + .mh-group') && !r.cssText.includes('border-left')); } catch (e) { return false; } });
  OK('the masthead group rule no longer paints a border-left', rule);
  const mainRule = [...d.styleSheets].some(ss => { try { return [...ss.cssRules].some(r => r.selectorText === '.pf-v6-c-masthead__main' && r.style.flex === '0 0 auto'); } catch (e) { return false; } });
  const contentAuto = [...d.styleSheets].some(ss => { try { return [...ss.cssRules].some(r => r.selectorText === '.pf-v6-c-masthead__content' && (r.style.getPropertyValue('margin-inline-start') === 'auto' || /margin-inline-start:\s*auto/.test(r.style.cssText))); } catch (e) { return false; } });
  OK('row 140: __main cannot shrink (brand overflow fix) and the content cluster right-aligns via margin-inline-start:auto', mainRule && contentAuto);

  // ---- the help menu carries the toggle as a menuitemcheckbox in its own group ----
  const mi = d.getElementById('annoMenuItem');
  OK('help menu: Annotations is a menuitemcheckbox in a "Mockup view" group, default off',
    !!mi && mi.getAttribute('role') === 'menuitemcheckbox' && mi.getAttribute('aria-checked') === 'false'
    && !!mi.querySelector('.pf-v6-c-menu__item-check input[type="checkbox"]')
    && !!mi.closest('.pf-v6-c-menu__group') && mi.closest('.pf-v6-c-menu__group').textContent.includes('Mockup view'));

  // ---- open the help menu and toggle ----
  d.getElementById('helpBtn').click();
  OK('help menu opens with the checkbox item present', !d.getElementById('helpMenu').hidden && !!d.getElementById('helpMenu').querySelector('#annoMenuItem'));
  mi.click();
  OK('clicking the item turns annotation mode ON (body class, aria-checked, checkbox synced, menu stays open)',
    w.eval('state.anno') === true
    && !d.body.classList.contains('anno-off')
    && mi.getAttribute('aria-checked') === 'true'
    && mi.querySelector('input[type="checkbox"]').checked
    && !d.getElementById('helpMenu').hidden);
  mi.click();
  OK('clicking again turns it OFF and re-hides the annotation chrome',
    w.eval('state.anno') === false
    && d.body.classList.contains('anno-off')
    && mi.getAttribute('aria-checked') === 'false'
    && !mi.querySelector('input[type="checkbox"]').checked);
  OK('Suggestions button follows anno-off (hidden while annotations are off)',
    d.getElementById('annoBtn').getBoundingClientRect().width >= 0 && w.eval("getComputedStyle(document.getElementById('annoBtn')).display") === 'none');

  // ---- the &anno=1 deep link still drives the menu item ----
  w.eval("annoApply(true, true)");
  OK('deep-link annoApply syncs the menu item state',
    mi.getAttribute('aria-checked') === 'true' && mi.querySelector('input[type="checkbox"]').checked);
  w.eval("annoApply(false, true)");

  // ---- the other help-menu items still close the menu ----
  d.getElementById('helpBtn').click();
  const tour = [...d.querySelectorAll('#helpMenu .pf-v6-c-menu__item')].find(b => b.textContent.includes('Guided tour'));
  tour.click();
  OK('navigation items still close the menu (Guided tour opens the tour)', d.getElementById('helpMenu').hidden);

  console.log(fail === 0 ? 'ALL PASS (' + pass + ')' : 'FAILURES: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}, 400);
