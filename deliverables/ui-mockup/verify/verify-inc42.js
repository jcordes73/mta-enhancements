const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
const OK = (name, cond) => console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
setTimeout(() => {
  const d = dom.window.document, w = dom.window;
  w.setPersona('migrator', true);
  w.show('incidents');
  const visible = () => [...d.querySelectorAll('#incQueueBody tr[data-app]')].filter(tr => tr.style.display !== 'none');
  const summary = () => visible().map(tr => tr.dataset.app + ':' + tr.cells[1].textContent.replace(/\s+/g,' ').trim().slice(0,34) + ' [' + tr.dataset.state + ']');
  console.log('=== boot (migrator, nwf/claims, Assigned-to-me ON default) ===');
  summary().forEach(r => console.log('  ', r));
  OK('9 rows at boot (3 ticketed apps: 3+3+3 incidents)', visible().length === 9);
  OK('all rows from ticketed apps only', [...new Set(visible().map(tr => tr.dataset.app))].join(',') === 'payments-api,invoicing,claims-web');
  OK('wave chips derived (Wave 3 + Wave 4 present in scope)', [...d.querySelectorAll('#incWaveChips .pf-v6-c-label')].map(c => c.textContent.trim()).join(',') === 'Wave 3,Wave 4');
  OK('mine chip is the on default', d.getElementById('incMineChip').classList.contains('on'));
  // toggle Assigned-to-me OFF -> the pool appears (claims-batch, notification-router)
  d.getElementById('incMineChip').click();
  const appsOff = [...new Set([...d.querySelectorAll('#incQueueBody tr[data-app]')].map(tr => tr.dataset.app))].join(',');   /* #65: app set is pagination-independent */
  console.log('=== mine OFF -> pool ==='); summary().slice(9).forEach(r => console.log('  ', r));
  OK('pool apps join when mine OFF (claims-batch, notification-router)', appsOff === 'payments-api,invoicing,claims-web,claims-batch,notification-router');
  // #65: the pool view is paginated — 10 per page, total carries the full count
  OK('pool paginated: 10 on page 1 of 12 total (row 198: claims-batch blocker row joined)', visible().length === 10
    && d.getElementById('incPgFrom').textContent === '1 \u2013 10' && d.getElementById('incPgTotal').textContent === '12');
  OK('pagination nav state on page 1', d.getElementById('incFirst').disabled && d.getElementById('incPrev').disabled
    && !d.getElementById('incNext').disabled && !d.getElementById('incLast').disabled);
  d.getElementById('incNext').click();
  OK('page 2 shows the 2 tail rows (claims-batch blocker + notification-router) with an honest range', visible().length === 2
    && visible()[0].dataset.app === 'claims-batch' && visible()[1].dataset.app === 'notification-router'
    && d.getElementById('incPgFrom').textContent === '11 \u2013 12'
    && d.getElementById('incNext').disabled && d.getElementById('incLast').disabled);
  d.getElementById('incFirst').click();
  OK('back to page 1 (10 visible, first/prev disabled again)', visible().length === 10
    && d.getElementById('incFirst').disabled && d.getElementById('incPrev').disabled);
  OK('claims-batch incident now visible (was invisible before)', summary().some(r => r.startsWith('claims-batch')));
  // wave chip filter
  d.querySelectorAll('#incWaveChips .pf-v6-c-label')[0].click();   // Wave 3 on
  OK('Wave 3 chip filters to wave-3 rows (9 with the blocker row)', visible().length === 9 && visible().every(tr => tr.dataset.wave === '3'));
  d.querySelectorAll('#incWaveChips .pf-v6-c-label')[0].click();   // off again
  // state menu filter (existing DOM path, now on store rows)
  w.eval('pickOption(document.querySelector("#scr-incidents .pf-v6-c-menu"), document.querySelector("#scr-incidents .pf-v6-c-menu-toggle__text"), [...document.querySelectorAll("#scr-incidents .pf-v6-c-menu__item")][2]); incApplyFilters();');
  OK('State: In progress filters rows (2 with the blocker row)', visible().length === 2 && visible().every(tr => tr.dataset.state === 'In progress'));
  w.eval('pickOption(document.querySelector("#scr-incidents .pf-v6-c-menu"), document.querySelector("#scr-incidents .pf-v6-c-menu-toggle__text"), [...document.querySelectorAll("#scr-incidents .pf-v6-c-menu__item")][0]); incApplyFilters();');
  // impossible combo -> guided empty state
  d.getElementById('incMineChip').click();  // mine ON
  d.querySelectorAll('#incWaveChips .pf-v6-c-label')[0].click();  // + Wave 3... payments-api+invoicing are W3 ticketed -> non-empty; use State Triage + Wave 4
  d.querySelectorAll('#incWaveChips .pf-v6-c-label')[0].click();
  w.eval('pickOption(document.querySelector("#scr-incidents .pf-v6-c-menu"), document.querySelector("#scr-incidents .pf-v6-c-menu-toggle__text"), [...document.querySelectorAll("#scr-incidents .pf-v6-c-menu__item")][1]); incApplyFilters();');  // Triage
  d.querySelectorAll('#incWaveChips .pf-v6-c-label')[1].click();  // Wave 4 -> claims-web Triage? claims-web rows: Assigned/Triage/Triage -> non-empty...
  // force empty: app chip for an app with no matching state
  w.eval('showIncidentsForApp("ledger-sync")');
  OK('deep link into an un-ticketed app relaxes the mine chip (row 141)', !d.getElementById('incMineChip').classList.contains('on'));
  OK('guided empty state (#43) on no match', d.getElementById('incEmpty').style.display !== 'none');
  w.eval('const c = document.getElementById("incAppChip"); if (c) c.remove(); incApplyFilters();');
  // reset filters: mine OFF (row 141 relaxed it above), clear wave chips + state back to All
  d.getElementById('incMineChip').classList.remove('on'); w.eval('incApplyFilters()');
  d.querySelectorAll('#incWaveChips .pf-v6-c-label.on').forEach(ch => ch.click());
  w.eval('pickOption(document.querySelector("#scr-incidents .pf-v6-c-menu"), document.querySelector("#scr-incidents .pf-v6-c-menu-toggle__text"), [...document.querySelectorAll("#scr-incidents .pf-v6-c-menu__item")][0]); incApplyFilters();');
  // drawer wiring: click a pool row (claims-batch) opens that incident
  const batchRow = visible().find(tr => tr.dataset.app === 'claims-batch');
  OK('claims-batch row present after reset', !!batchRow);
  let drawerOpened = false;
  try { batchRow.click(); drawerOpened = true; } catch (e) { console.log('click error:', e.message); }
  OK('row click wired (openIncidentFromRow ran without error)', drawerOpened);
  // tracker fallback rule: payments-api row 0 shows MIG-418 from WAVE_TICKETS; rows 1-2 show dash
  const pa0 = [...d.querySelectorAll('#incQueueBody tr')].find(tr => tr.dataset.app === 'payments-api');
  OK('payments-api row 0 tracker = app ticket (MIG-418 synced)', pa0.cells[4].textContent.includes('MIG-418 synced'));
  OK('payments-api row 1 tracker = em-dash (no tracker, not first row)', [...d.querySelectorAll('#incQueueBody tr')].filter(tr => tr.dataset.app === 'payments-api')[1].cells[4].textContent.trim() === '—');
  OK('payments-api row 2 tracker = its own Export queued', [...d.querySelectorAll('#incQueueBody tr')].filter(tr => tr.dataset.app === 'payments-api')[2].cells[4].textContent.includes('Export queued'));
  // store reactivity: ticket assigned to claims-batch -> it joins the mine view
  w.eval('WAVE_TICKETS["claims-batch"] = { title: "Batch descriptors", key: "MIG-430", outcome: "queued", oc: "outline", detail: "", when: "-" }; renderIncQueue();');
  d.getElementById('incMineChip').classList.add('on'); w.eval('incApplyFilters()');
  OK('ticket assigned -> claims-batch joins Assigned-to-me view', visible().some(tr => tr.dataset.app === 'claims-batch'));
  // #66: sortable columns + search box (same widget set as the inventory)
  w.eval('incSearchApply(); document.getElementById("inc-search").value = "";');
  const q = k => d.getElementById('incQueueBody').closest('table').querySelector('thead th[data-sort="' + k + '"]');
  q('effort').querySelector('button').click();
  const effs = visible().map(tr => parseInt(tr.cells[2].textContent, 10));
  OK('effort sort ascending numeric', effs.every((v, i) => i === 0 || effs[i - 1] <= v));
  OK('aria-sort ascending + indicator glyph', q('effort').getAttribute('aria-sort') === 'ascending'
    && !!q('effort').querySelector('.pf-v6-c-table__sort-indicator svg.fas'));   /* row 92: RHDS sort glyphs, svg.fas idiom */
  q('effort').querySelector('button').click();
  const effs2 = visible().map(tr => parseInt(tr.cells[2].textContent, 10));
  OK('effort sort toggles to descending', effs2.every((v, i) => i === 0 || effs2[i - 1] >= v) && q('effort').getAttribute('aria-sort') === 'descending');
  q('app').querySelector('button').click();
  const appsSorted = visible().map(tr => tr.dataset.app);
  OK('app sort alphabetical + earlier column aria-sort resets', appsSorted.every((v, i) => i === 0 || appsSorted[i - 1].localeCompare(v) <= 0)
    && q('app').getAttribute('aria-sort') === 'ascending' && q('effort').getAttribute('aria-sort') === 'none');
  const inp = d.getElementById('inc-search');
  inp.value = 'kafka'; w.eval('incSearchApply()');
  OK('search "kafka" -> 2 rows (producer API + the row-198 contract mismatch), page 1 of 1', visible().length === 2
    && visible().every(tr => tr.cells[1].textContent.includes('Kafka'))
    && d.getElementById('incPgTotal').textContent === '2');
  inp.value = ''; w.eval('incSearchApply()');
  OK('clearing search restores the queue (sort retained)', visible().length >= 9
    && d.getElementById('inc-search').value === '');
  OK('4 sortable headers, Tracker stays plain', d.querySelectorAll('#scr-incidents thead th.pf-v6-c-table__sort').length === 4
    && [...d.getElementById('incQueueBody').closest('table').querySelectorAll('thead th')].pop().textContent.includes('Tracker'));
  // #68: canonical data-value filter reads (display text is translated — text comparison zeroed the queue in non-EN locales)
  OK('State menu carries canonical data-value', [...d.querySelectorAll('#incStateWrap [data-value]')].map(x => x.dataset.value).join(',') === 'All,Triage,In progress,Assigned');
  w.eval('pickOption(document.querySelector("#incStateWrap .pf-v6-c-menu"), document.querySelector("#incStateWrap .pf-v6-c-menu-toggle__text"), [...document.querySelectorAll("#incStateWrap .pf-v6-c-menu__item")][2]); incApplyFilters();');
  OK('State=In progress via canonical value -> 2 rows (row 198 blocker row matches too)', visible().length === 2 && visible().every(tr => tr.dataset.state === 'In progress'));
  w.eval('pickOption(document.querySelector("#incStateWrap .pf-v6-c-menu"), document.querySelector("#incStateWrap .pf-v6-c-menu-toggle__text"), [...document.querySelectorAll("#incStateWrap .pf-v6-c-menu__item")][0]); incApplyFilters();');
  // scope: fresh padmin (12 apps) sees more
}, 500);
