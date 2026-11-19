const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
let pass = 0, fail = 0;
const OK = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); c ? pass++ : fail++; };
setTimeout(() => {
  const d = dom.window.document, w = dom.window;
  w.setPersona('architect', true);
  w.show('waves');

  // live facts recomputed from the inventory rows (the same source the chart derives from)
  const live = {};
  [1, 2, 3, 4].forEach(wv => {
    let total = 0, done = 0, n = 0;
    [...d.querySelectorAll('#invBody tr[data-wave="' + wv + '"]')].forEach(tr => {
      const p = parseInt(tr.dataset.pts, 10);
      if (!isNaN(p)) { total += p; n++; if (tr.dataset.state === 'succeeded') done += p; }
    });
    live[wv] = { total, done, rem: total - done, n };
  });

  // structure: waves 3/4 host the chart in a Burndown tab below the gate strip;
  // member-less waves 1/2 (no tab bar) keep the inline honest dash
  const ctn = wv => d.getElementById('waveBurn-' + wv);
  OK('waves 3/4 carry a Burndown tab with the chart inside its panel (renders while hidden)',
    [3, 4].every(wv => !!d.getElementById('tab-wave-burn-' + wv)
      && d.getElementById('tab-wave-burn-' + wv).getAttribute('aria-controls') === 'panel-wave-burn-' + wv
      && d.getElementById('panel-wave-burn-' + wv).contains(ctn(wv)) && !!ctn(wv).querySelector('svg[role="img"]')));
  OK('waves 1/2 keep the inline honest dash (no tab bar exists there)',
    !!ctn(1) && !!ctn(2) && ctn(1).querySelector('.u-muted') !== null);
  OK('Burndown tab starts unselected (Applications stays the default lens)',
    d.getElementById('tab-wave-burn-3').getAttribute('aria-selected') === 'false'
    && d.getElementById('panel-wave-burn-3').hidden === true);
  // clicking the tab reveals the chart (headless-idempotent panel toggle in jsdom: selectTab is a plain DOM toggle)
  w.eval("document.getElementById('tab-wave-burn-3').click()");
  OK('Burndown tab click selects it and reveals the chart panel',
    d.getElementById('tab-wave-burn-3').getAttribute('aria-selected') === 'true'
    && d.getElementById('panel-wave-burn-3').hidden === false
    && !!d.getElementById('panel-wave-burn-3').querySelector('svg[role="img"]'));

  // wave 1: honest empty state (no sampled applications)
  OK('wave 1 (no sampled apps) renders the honest dash', ctn(1).querySelector('.u-muted') !== null && ctn(1).querySelector('svg') === null);

  // wave 3 (in flight, past its window): svg + live-anchored caption
  const svg3 = ctn(3).querySelector('svg[role="img"]');
  OK('wave 3 renders a burndown chart (svg, role=img)', !!svg3 && svg3.getAttribute('role') === 'img');
  const cap3 = ctn(3).textContent.replace(/\s+/g, ' ');
  OK('wave 3 caption is anchored to the live facts: <rem>/<total> pts remaining',
    cap3.includes(live[3].rem + '/' + live[3].total + ' pts remaining'));
  OK('wave 3 is drawn past its window end (axis extends to the snapshot date, state named in text)',
    svg3.getAttribute('aria-label').includes('past the window end') && svg3.textContent.includes('2026-11-18'));

  // wave 2 is a done wave with no sampled member rows in the mock's inventory — honest dash
  OK('wave 2 (done, no sampled rows) renders the honest dash, not a synthetic zero-burn',
    ctn(2).querySelector('svg[role="img"]') === null && ctn(2).querySelector('.u-muted') !== null);

  // wave 4: two members already succeeded (pre-window analyses in the seed), so the
  // honest render is in-flight — remaining/total from the live rows, not the pill's fiction
  const cap4 = ctn(4).textContent.replace(/\s+/g, ' ');
  OK('wave 4 renders its live remaining (seed has succeeded analyses despite the planned pill)',
    cap4.includes(live[4].rem + '/' + live[4].total + ' pts remaining') && live[4].done > 0);

  // legend carries the dict keys (EN identity here)
  OK('legend names both series in text (Ideal / Remaining effort — never color alone)',
    ctn(3).textContent.includes('Ideal') && ctn(3).textContent.includes('Remaining effort'));
  const polys3 = [...svg3.querySelectorAll('polyline')];
  const dots3 = [...svg3.querySelectorAll('circle')];
  OK('wave 3 actual series draws as a solid line with a tooltip-carried dot per analysis-run point (values on hover + caption)',
    polys3.filter(pl => !pl.getAttribute('style').includes('dasharray')).length === 1
    && dots3.length === 4 && dots3.every(dt => dt.querySelector('title')));
  OK('wave 3 chart carries the polish layer: nice-scale gridlines + gradient under the ideal',
    svg3.querySelectorAll('.burn-grid').length >= 3 && !!svg3.querySelector('linearGradient') && !!svg3.querySelector('polygon'));
  /* row 207 white-panel pass: hosts carry the wave-burn class but NO background — tab
     parity with the white panels; labels keep the body font size in the fallback svg */
  OK('chart sits on WHITE (primary-background surface over the gray detail well, tab parity) and fallback labels use the body font size',
    ctn(3).classList.contains('wave-burn') && d.getElementById('waveBurnAll').classList.contains('wave-burn')
    && [...d.querySelectorAll('style')].some(st => st.textContent.includes('.wave-burn{background:var(--pf-t--global--background--color--primary--default)'))
    && !svg3.getAttribute('style').includes('background')
    && svg3.querySelector('text').getAttribute('style').includes('font-size:var(--pf-t--global--font-size--body--default)'));
  OK('wave 3 keeps the dashed ideal as a line (exactly 1 dashed polyline)', polys3.filter(pl => pl.getAttribute('style').includes('dasharray')).length === 1);

  // Reports aggregate
  w.show('reports');
  w.eval('document.querySelector(\'[aria-controls="panel-trends"]\').click()');
  const agg = d.getElementById('waveBurnAll');
  const aggSvg = agg && agg.querySelector('svg[role="img"]');
  OK('Reports → Trends carries the all-waves Wave burndown card (inside panel-trends, row 207)', !!aggSvg && d.getElementById('panel-trends').contains(d.getElementById('waveBurnAllCard')) && !d.getElementById('waveBurnAllCard').closest('[hidden]'));
  const aggDots = aggSvg ? [...aggSvg.querySelectorAll('circle')] : [];
  const aggActuals = aggSvg ? [...aggSvg.querySelectorAll('polyline')].filter(p => !p.getAttribute('style').includes('dasharray')) : [];
  const aggIdeals = aggSvg ? [...aggSvg.querySelectorAll('polyline')].filter(p => p.getAttribute('style').includes('dasharray')) : [];
  /* row 209: wave 4's pill is now yellow "blocked by dependency" — the aggregate hue
     follows the pill live (burnPillHue), so wave 4's 2 dots draw yellow */
  OK('aggregate draws one line per wave with data (2 of 4 — waves 1/2 have no sampled rows): 4 red + 2 yellow dots, ideals dashed',
    aggActuals.length === 2 && aggIdeals.length === 2 && aggDots.length === 6 && aggDots.every(dt => dt.querySelector('title'))
    && aggDots.filter(r => r.getAttribute('style').includes('nonstatus--red')).length === 4
    && aggDots.filter(r => r.getAttribute('style').includes('nonstatus--yellow')).length === 2
    && aggSvg.querySelectorAll('.burn-grid').length >= 3);
  OK('aggregate legend names the waves (never color alone)',
    agg.textContent.includes('Wave 3') && agg.textContent.includes('Wave 4'));

  // i18n: DE render translates the chrome
  w.eval("setLang('de')");
  setTimeout(() => {
    const cap3de = ctn(3).textContent.replace(/\s+/g, ' ');
    OK('DE: legend + caption chrome translated', ctn(3).textContent.includes('Verbleibender Aufwand') && cap3de.includes('Pt. verbleibend'));
    OK('DE: Reports card title translated (Wellen-Burndown)', (d.getElementById('waveBurnAllCard') || {}).textContent.includes('Wellen-Burndown'));
    console.log(pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
  }, 300);
}, 900);
