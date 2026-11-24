const fs = require('fs');
const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const errors = [];
const dom = new JSDOM(html.replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, ''), { url: 'http://localhost/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => errors.push(e.message));
setTimeout(() => {
  const d = dom.window.document, w = dom.window;
  let pass = 0, fail = 0;
  const t = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL:', n); } };
  const rowNames = () => [...d.querySelectorAll('#invBody tr')].map(r => r.dataset.name);
  const laneCount = () => [...d.querySelectorAll('#scr-waves .wave-exec')].filter(l => !l.classList.contains('rbac-hidden')).length;

  // ---- boot: Northwind org scope, all 12 sampled apps ----
  t('boot: label = Northwind · Retail Banking · all teams', d.getElementById('tenancyLabel').textContent === 'Northwind Financial \u00b7 Retail Banking \u00b7 all teams');
  t('boot: 12 rows', rowNames().length === 12 && rowNames().includes('payments-api'));
  t('boot: scope notes', d.getElementById('scopeNoteHome').textContent.startsWith('Data scope: Northwind Financial') && d.getElementById('scopeNoteReports').textContent.includes('#41'));
  t('boot: wave count text', d.getElementById('waveScopeCount').textContent.startsWith('9 of the 12'));
  t('boot: waves visible (4 lanes)', laneCount() === 4 && d.getElementById('waveEmptyScope').hidden);

  // ---- exactly-one-team data invariant ----
  const inv = w.eval('MOCK_APPS.every(a => a.team && !!TEAM_BY_ID[a.team])');
  t('invariant: every app has exactly one valid team', inv === true);
  t('invariant: Meridian apps exist in store', w.eval('MOCK_APPS.filter(a => TEAM_BY_ID[a.team].org === "mrd").length') === 3);

  // ---- org isolation: Meridian (platform-admin pivot; architects are org-locked now) ----
  w.setOrg('mrd');
  t('architect is org-locked: setOrg(mrd) is a no-op (responsible for one organization)', w.eval('state.org') === 'nwf' && rowNames().length === 12);
  w.setPersona('padmin', true);
  w.setOrg('mrd');
  t('mrd: only its 3 apps', rowNames().slice().sort().join(',') === 'appointment-api,lab-results,patient-records');
  t('mrd: label', d.getElementById('tenancyLabel').textContent.startsWith('Meridian Health \u00b7 Clinical Systems'));
  t('mrd: no Northwind waves', laneCount() === 0 && !d.getElementById('waveEmptyScope').hidden);
  t('mrd: wave count text', d.getElementById('waveScopeCount').textContent.startsWith('0 of the 3'));
  t('mrd: home bsvc rows derive from scope (Meridian\u2019s own services; Northwind domains never render)',
    [...d.querySelectorAll('#scr-home [data-bsvc-row]')].length > 0 &&
    [...d.querySelectorAll('#scr-home [data-bsvc-row]')].every(r => /Records|Imaging/.test(r.textContent)) &&
    ![...d.querySelectorAll('#scr-home [data-bsvc-row]')].some(r => /Claims|Pricing|Customer/.test(r.textContent)));
  t('mrd: hash carries org', w.location.hash.includes('org=mrd'));

  // ---- team scope within Northwind ----
  w.setOrg('nwf');
  w.setTeam('claims');
  t('nwf/claims: 6 rows, all claims team', rowNames().length === 6 && rowNames().every(n => ['payments-api','invoicing','claims-web','claims-batch','ledger-sync','notification-router'].includes(n)));
  t('nwf/claims: count text names team', d.getElementById('waveScopeCount').textContent === '6 of the 6 sampled applications (team Claims)');
  t('nwf/claims: wave aggregates cascade (W4 = claims-web only, 610)', d.getElementById('waveEffort-4').textContent.includes('610'));
  t('nwf/claims: empty lanes hidden (2 of 4 visible)', laneCount() === 2);
  t('nwf/claims: hash carries team', w.location.hash.includes('team=claims'));

  w.setTeam('portfolio');
  t('nwf/portfolio: 2 rows', rowNames().join(',') === 'policy-engine,risk-scoring');
  t('nwf/portfolio: wave lanes with no scoped members hidden', laneCount() === 1 && d.getElementById('waveEffort-4').textContent.includes('79'));

  w.setTeam('');
  t('nwf/all: back to 12 rows + 4 lanes', rowNames().length === 12 && laneCount() === 4);

  // ---- deep links ----
  w.location.hash = '#scr=inventory&org=mrd&persona=padmin';   /* cross-org deep links are a platform-admin capability now */
  w.applyHash();
  t('deep link &org=mrd isolates (as platform admin)', rowNames().slice().sort().join(',') === 'appointment-api,lab-results,patient-records');
  w.setPersona('admin', true);   /* the org admin inherits the current org as its lock (an admin OF Meridian here) */
  t('org admin is locked to the inherited org', w.eval('state.org') === 'mrd' && rowNames().length === 3);
  w.location.hash = '#scr=inventory&org=nwf&persona=admin';
  w.applyHash();
  t('deep link &org=nwf as org admin loses to the org lock', w.eval('state.org') === 'mrd' && rowNames().length === 3);
  w.location.hash = '#scr=inventory&org=nwf&dept=wealth&team=portfolio&persona=padmin';
  w.applyHash();
  t('deep link &dept=&team= scopes (platform admin)', rowNames().join(',') === 'policy-engine,risk-scoring' && w.location.hash.includes('dept=wealth'));
  w.location.hash = '#scr=inventory&org=nwf&persona=padmin';   /* reset to the Northwind boot scope */
  w.applyHash();

  // ---- app form: team select, exactly-one-team on create/edit ----
  w.setPersona('migrator', true);
  w.show('inventory', true);
  w.openAppForm('');
  const afTeam = d.getElementById('afTeam');
  t('form: team select populated with current org teams (optgroups)', afTeam.options.length >= 5 && !!afTeam.querySelector('optgroup'));
  t('form: preselects current team scope or dept default', afTeam.value !== '');
  d.getElementById('afName').value = 'test-app-x';
  d.getElementById('afTeam').value = 'claims';
  w.appFormSubmit();
  t('create: app lands in chosen team', rowNames().includes('test-app-x') && w.eval('MOCK_APPS.find(a => a.name === "test-app-x").team') === 'claims');
  t('create: visible in team scope', rowNames().includes('test-app-x'));

  // ---- admin: Teams management surface ----
  w.setPersona('admin', true);
  w.show('config', true); w.cfgTabApply('org', 'org');   /* row 234: leaves replace the tab-ctrl-* buttons */
  t('teams tab: org admin sees its org only (4 nwf teams)', d.querySelectorAll('#teamsBody tr').length === 4);
  t('teams tab: nwf membership renders', d.getElementById('teamsBody').textContent.includes('M. Keller'));
  t('teams tab: org admin cannot see Meridian teams', !d.getElementById('teamsBody').textContent.includes('G. Hall'));
  // guarded delete: claims has apps
  const delBtn = [...d.querySelectorAll('#teamsBody button[data-rbac="teams:delete"]')][0];
  delBtn.click();
  t('guard: claims delete blocked (apps assigned)', d.getElementById('ctrlMsg').textContent.includes('Cannot delete') && !d.getElementById('ctrlMsg').hidden);
  // create + delete an empty team
  w.openTeamModal();
  d.getElementById('tmName').value = 'Collections';
  w.teamCreate();
  t('create team: appears in table (5 nwf teams)', d.querySelectorAll('#teamsBody tr').length === 5 && d.getElementById('teamsBody').textContent.includes('Collections'));
  const rows2 = [...d.querySelectorAll('#teamsBody tr')];
  const emptyRow = rows2.find(r => r.textContent.includes('Collections'));
  const del2 = emptyRow.querySelector('button[data-rbac="teams:delete"]');
  del2.click();  // arm
  t('armed state on empty team', del2.dataset.armed === '1');
  del2.click();  // confirm
  t('delete team: empty team removed (4 again)', d.querySelectorAll('#teamsBody tr').length === 4 && !d.getElementById('teamsBody').textContent.includes('Collections'));
  // RBAC: non-admin cannot create/delete teams
  w.setPersona('architect', true);
  t('rbac: teams verbs disabled for architect', [...d.querySelectorAll('#teamsBody button[data-rbac="teams:delete"]')].every(b => b.disabled) && [...d.querySelectorAll('[data-rbac="teams:create"]')].every(b => b.disabled));

  // ---- scope helpers: counts follow scope ----
  w.setPersona('padmin', true); w.setOrg('mrd');
  t('controls bsvc counts scoped (platform admin pivot)', w.eval('bsvcApps("Claims")') === 0);
  w.setOrg('nwf');
  t('controls bsvc counts scoped back', w.eval('bsvcApps("Claims")') === 6);

  // ---- structural integrity: a stray </div> once closed <main> early and orphaned every screen
  // after Waves below the fold (Reports/Agentic/Credentials/... painted blank while suites stayed
  // green) — pin the container relationship so this class of bug fails loudly ----
  { const main = d.querySelector('.pf-v6-c-page__main');
    const screens = [...d.querySelectorAll('.screen')];
    t('structure: all ' + screens.length + ' screens are direct children of page__main (no premature main close)', screens.length === 10 && screens.every(sc => sc.parentElement === main));
    t('structure: page__main sits in the page grid', main.parentElement.className.includes('pf-v6-c-page')); }

  // ---- run records follow their application's scope (#41): agentic tables + Reports agent tab ----
  w.setPersona('padmin', true);
  w.setOrg('mrd'); w.show('agentic', true); w.showAgentic('agentruns');
  t('runs: Meridian sees NO Northwind run records (agentic table is scope-clamped, honest empty state)', d.querySelector('#agRunsBody td').textContent.includes('No agent runs in this scope'));
  t('runs: workflow-runs table clamped too', d.querySelector('#agWfRunsBody td').textContent.includes('No workflow runs in this scope'));
  w.show('reports', true);
  d.querySelector('[id^=tab-rpt-agents]').click();
  t('runs: the Reports agent tab (KPIs + rollup) clamps to scope — the leak the "who sees reports" question exposed', d.getElementById('rptKpiRuns').textContent === '0' && d.getElementById('rptKpiCost').textContent === '$0.00' && d.querySelector('#rptRunBody td').textContent.includes('No agent runs in this scope'));
  w.setOrg('nwf');
  w.show('agentic', true); w.showAgentic('agentruns');
  t('runs: back in Northwind, all 12 records visible again', d.querySelectorAll('#agRunsBody tr').length === 12);
  w.show('reports', true);
  d.querySelector('[id^=tab-rpt-agents]').click();
  { /* KPIs now compute live from the scoped store — the static 16/51.0M/$140.50 contradicted the records */
    const runs = w.eval('MOCK_AGENT_RUNS');
    const pk = v => { const m = /^([\d.]+)(M|k)/.exec(String(v).trim()); return m ? parseFloat(m[1]) * (m[2] === 'M' ? 1e6 : 1e3) : 0; };
    const cost = runs.reduce((t2, r) => t2 + (parseFloat(String(r.cost).replace(/[^0-9.]/g, '')) || 0), 0);
    const tok = runs.reduce((t2, r) => t2 + pk(String(r.tokDetail || '0/0').split('/')[0]) + pk(String(r.tokDetail || '0/0').split('/')[1] || '0'), 0);
    t('runs: Reports KPIs reconcile with the records (12 runs, ' + (Math.round(tok / 1e5) / 10) + 'M tokens, $' + cost.toFixed(2) + ') — same store as the wave spend', d.getElementById('rptKpiRuns').textContent === '12' && d.getElementById('rptKpiCost').textContent === '$' + cost.toFixed(2) && d.getElementById('rptKpiTok').textContent.includes((Math.round(tok / 1e5) / 10) + 'M')); }

  // ---- regression ----
  w.setOrg('nwf'); w.setTeam(''); w.setPersona('architect', true);
  /* drop the app created in the CRUD test so the store matches the boot-state reference */
  w.eval('MOCK_APPS.splice(MOCK_APPS.findIndex(a => a.name === "test-app-x"), 1); renderInventory();');
  const ref = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'inv-rows-reference-wp3.json'), 'utf8'));
  const norm = s => s.replace(/&middot;/g, '\u00b7').replace(/\s+/g, ' ').trim();
  const irows = [...d.querySelectorAll('#invBody tr')].sort((a, b) => a.dataset.name.localeCompare(b.dataset.name));  /* reference was captured name-sorted */
  let mm = 0;
  irows.forEach((r, i) => { const got = [...r.children].map(c => norm(c.innerHTML)); const want = ref[i].cells.map(norm); if (got.some((c, j) => c !== want[j])) mm++; });
  t('byte-equality 12x10 (boot scope)', mm === 0 && irows.length === 12);
  t('no errors', errors.length === 0);
  console.log(pass + ' passed, ' + fail + ' failed');
}, 200);
