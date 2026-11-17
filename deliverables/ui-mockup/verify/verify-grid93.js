// row 93: RHDS fluid 12-column grid base — structural assertions
const fs = require('fs');
const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true });
const { document } = dom.window;
let pass = 0, fail = 0;
const assert = (name, ok) => { if (ok) { pass++; } else { fail++; console.log('FAIL:', name); } };

setTimeout(() => {
  // 1. container census
  const grids = [...document.querySelectorAll('.grid12')];
  assert('11 grid12 containers (row 115: the cohort dashboard card — one grid12 — moved into the archetype detail rows, which are component-internal; row 125: the Registries grid12 went away — its three cards became full-width sub-tab panels; row 131: the Access panel split into two containers — bind+tokens row and the full-width Users card)', grids.length === 11);
  assert('1 five-tile (c5) container (org-admin landing; padmin moved to the row-107 8-tile stat wall)', grids.filter(g => g.classList.contains('c5')).length === 1);

  // 2. no legacy inline grid-template-columns left at the content-layout layer
  //    (the config modal's 230px/1fr pane split is PF component-internal chrome — stays)
  assert('no inline auto-fit left', !html.includes('auto-fit'));
  const inlineGrids = [...html.matchAll(/style="[^"]*grid-template-columns[^"]*"/g)];
  assert('only component-internal inline grid remains', inlineGrids.length === 1 && inlineGrids[0][0].includes('230px 1fr'));

  // 3. CSS base rules present
  assert('12-track rule', html.includes('.grid12{display:grid; grid-template-columns:repeat(12,1fr); gap:var(--rh-space-2xl);}'));
  assert('RHDS fluid desktop gap', html.includes('gap:var(--rh-space-2xl)'));
  assert('mobile 2-track rule', html.includes('grid-template-columns:repeat(2,1fr); gap:var(--rh-space-lg);'));
  assert('mobile margins --rh-space-lg', html.includes('gap:var(--rh-space-lg)'));
  for (let k = 1; k <= 5; k++) assert(`c5 tile ${k} centered placement`, html.includes(`.grid12.c5>*:nth-child(${k}){grid-column:${2 * k}/span 2;}`));
  assert('mobile wide-pane full span', html.includes('.grid12>.gc6{grid-column:span 2;}') && html.includes('@media (max-width:767px)'));
  assert('mobile stat-tile half span', /\.grid12>\.gc2,\.grid12>\.gc3,\.grid12>\.gc4\{grid-column:span 1;\}/.test(html));

  // 4. per-container child spans sum to 12 (or c5 placement)
  const SPAN = { gc2: 2, gc3: 3, gc4: 4, gc6: 6, gc12: 12 };   /* gc12 = row 131 full-width card (Users), own container */
  for (const g of grids) {
    const kids = [...g.children];
    if (g.classList.contains('c5')) {
      assert('c5 has 5 children', kids.length === 5);
    } else if (g.id === 'lpPgmKpis') {
      // JS-filled on tenancy switch — span coverage asserted via the gc4 source check below
      assert('lpPgmKpis empty at boot', kids.length === 0);
    } else {
      const sum = kids.reduce((a, k) => a + (SPAN[[...k.classList].find(c => SPAN[c])] || 0), 0);
      assert(`container children span 12 (got ${sum}, ${kids.length} kids)`, sum === 12);
      assert('every child carries a span class', kids.every(k => [...k.classList].some(c => SPAN[c])));
    }
  }

  // 5. JS-rendered KPI cards carry gc4 in both branches (non-nwf org + nwf)
  assert('JS KPI cards carry gc4', (html.match(/pf-v6-c-card gc4/g) || []).length >= 6);

  // 6. JS-rendered lpPgmKpis container exists and is a grid12
  const kpis = document.getElementById('lpPgmKpis');
  assert('lpPgmKpis is grid12', kpis && kpis.classList.contains('grid12'));

  console.log(`\ngrid93: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 2500);
