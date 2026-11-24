const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://mock.test/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
const OK = (name, cond) => console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
setTimeout(() => {
  const d = dom.window.document, w = dom.window;
  w.setPersona('migrator', true);
  const dump = () => [...d.querySelectorAll('#lpMigrRows tr')].map(tr => [...tr.cells].map(c => c.textContent.replace(/\s+/g,' ').trim()));
  console.log('=== migrator My work (boot, nwf/claims) ==='); dump().forEach(r => console.log('  ', r.join(' | ')));
  OK('3 rows at boot (the assigned-to-me rule)', dump().length === 3);
  OK('row order = scoped store order (payments-api, invoicing, claims-web)', dump().map(r => r[0]).join(',') === 'payments-api,invoicing,claims-web');
  OK('titles from APP_INCIDENTS row 0', dump()[0][1].includes('41') && dump()[1][1].includes('JNDI') && dump()[2][1].includes('ORM'));
  OK('wave column from app store', dump().map(r => r[2]).join(',') === 'Wave 3,Wave 3,Wave 4');
  OK('state labels with store colors', dump()[0][3] === 'Triage' && dump()[1][3] === 'In progress' && dump()[2][3] === 'Assigned');
  OK('rows clickable (pf-m-clickable)', d.querySelector('#lpMigrRows tr').classList.contains('pf-m-clickable'));
  // reactivity 1: claims-web's ticket cleared -> row drops out of My work
  w.eval('delete WAVE_TICKETS["claims-web"]; renderMigrLanding();');
  OK('ticket removed -> row disappears', dump().length === 2 && !dump().map(r => r[0]).includes('claims-web'));
  // reactivity 2: ticket assigned to claims-batch (incident, no ticket) -> it becomes my work
  w.eval('WAVE_TICKETS["claims-batch"] = { title: "Batch descriptors", key: "MIG-430", outcome: "queued", oc: "outline", detail: " no ticket yet", when: "-" }; renderMigrLanding();');
  const names = dump().map(r => r[0]);
  OK('ticket added -> claims-batch joins My work', names.includes('claims-batch'));
  OK('un-ticketed incident apps stay out (notification-router)', !names.includes('notification-router') && !names.includes('ledger-sync'));
  // empty state: no tickets at all
  w.eval('for (const k of Object.keys(WAVE_TICKETS)) delete WAVE_TICKETS[k]; renderMigrLanding();');
  OK('honest empty state when nothing assigned', dump().length === 1 && dump()[0][0].includes('No incidents assigned'));
  // restore + persona re-switch re-derives (teamLockScope -> applyTenancy -> renderArchitectLanding chain)
  w.eval('WAVE_TICKETS["invoicing"] = { title: "Migrate JNDI lookups", key: "MIG-412", outcome: "synced", oc: "green", detail: " comment posted", when: "2h ago" }; WAVE_TICKETS["payments-api"] = { title: "Namespace migration", key: "MIG-418", outcome: "synced", oc: "green", detail: " status to In Progress", when: "2h ago" }; WAVE_TICKETS["claims-web"] = { title: "ORM hint replacement", key: "MIG-425", outcome: "failed", oc: "red", detail: " 410 Gone", when: "1h ago" };');
  w.setPersona('pm', true); w.setPersona('migrator', true);
  OK('persona re-switch re-derives through applyTenancy chain', dump().length === 3);
}, 500);
