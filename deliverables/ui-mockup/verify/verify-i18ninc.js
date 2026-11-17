const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const OK = (n, c) => console.log((c ? 'PASS' : 'FAIL') + '  ' + n);
const mk = (lang) => {
  const dom = new JSDOM(html, { url: 'http://localhost/mock.html#lang=' + lang, runScripts: 'dangerously', pretendToBeVisual: true });
  return new Promise(res => setTimeout(() => res(dom.window), 900));
};
(async () => {
  const EXP = {
    de: { tab: 'Triage-Warteschlange', ins: 'Erkenntnisse', chip: 'Mir zugewiesen', inc: 'Vorfälle', of: 'von', pp: '20 pro Seite' },
    fr: { tab: 'File de triage', ins: 'Constats', chip: 'Assigné à moi', inc: 'incidents', of: 'sur', pp: '20 par page' },
    ja: { tab: 'トリアージキュー', ins: 'インサイト', chip: '自分に割り当て済み', inc: '件のインシデント', of: '/', pp: '1ページ20件' },
  };
  for (const L of Object.keys(EXP)) {
    const w = await mk(L);
    const d = w.document;
    w.setPersona('migrator', true); w.show('incidents');
    await new Promise(r => setTimeout(r, 150));
    const E = EXP[L];
    const tabs = [...d.querySelectorAll('#scr-incidents .pf-v6-c-tabs__item-text')].map(t => t.textContent);
    OK(L + ': Triage-queue tab translated', tabs[0] === E.tab);
    OK(L + ': Insights tab translated', tabs[1].startsWith(E.ins));
    OK(L + ': Assigned-to-me chip translated', d.getElementById('incMineChip').textContent.includes(E.chip));
    const foot = d.getElementById('incPgFrom').parentElement.textContent.replace(/\s+/g, ' ');
    OK(L + ': count line composed (' + E.of + ' + ' + E.inc + ')', foot.includes(E.of) && foot.includes(E.inc) && foot.includes('9'));
    // per-page pick writes a new text node -> observer -> rule
    const opt20 = [...d.querySelectorAll('#scr-incidents .pf-v6-c-menu__item-text')].find(t => t.dataset.value === undefined && /20/.test(t.textContent) && t.closest('.pf-v6-c-pagination'));
    opt20.closest('button').click();
    await new Promise(r => setTimeout(r, 120));
    OK(L + ': per-page label after pick translated', d.getElementById('incPerPageText').textContent === E.pp);
    // #70: search placeholder (an attribute — translated in setLang, not by the text-node walk)
    if (L === 'de'){
      OK('DE: incidents search placeholder translated', d.getElementById('inc-search').placeholder === 'Nach Vorfall filtern …');
      w.show('inventory');
      await new Promise(r => setTimeout(r, 120));
      OK('DE: inventory name filter placeholder translated', d.getElementById('filter-name').placeholder === 'Nach Name filtern …');
    }
  }

  // EN byte-exact regression
  const w = await mk('');
  const d = w.document;
  w.setPersona('migrator', true); w.show('incidents');
  await new Promise(r => setTimeout(r, 150));
  const tabs = [...d.querySelectorAll('#scr-incidents .pf-v6-c-tabs__item-text')].map(t => t.textContent);
  const foot = d.getElementById('incPgFrom').parentElement.textContent.replace(/\s+/g, ' ');
  OK('EN: tabs byte-exact', tabs[0] === 'Triage queue' && tabs[1].startsWith('Insights'));
  OK('EN: chip byte-exact + count line byte-exact', d.getElementById('incMineChip').textContent.includes('Assigned to me') && foot === '1 – 9 of 9 incidents');
  OK('EN: placeholders byte-exact', d.getElementById('inc-search').placeholder === 'Filter by incident…' && d.getElementById('filter-name').placeholder === 'Filter by name…');
  // inventory footer also benefits from the " of "/" applications" rules
  w.show('inventory');
  await new Promise(r => setTimeout(r, 150));
  const de = await mk('de');
  const dd = de.document;
  de.setPersona('admin', true); de.show('inventory');
  await new Promise(r => setTimeout(r, 150));
  const ifoot = dd.getElementById('invCount').textContent.replace(/\s+/g, ' ');
  OK('DE: inventory count line composed too', ifoot.includes('von') && ifoot.includes('Anwendungen'));
  process.exit(0);
})().catch(e => { console.log('ERROR', e.message); process.exit(1); });
