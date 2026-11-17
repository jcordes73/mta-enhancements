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
  const navVisible = () => [...d.querySelectorAll('.pf-v6-c-nav__link[data-screen]')].filter(l => !l.classList.contains('rbac-hidden')).map(l => l.dataset.screen).sort().join(',');
  const EXPECT_NAV = {
    architect: 'agentic,credentials,home,incidents,inventory,reports,waves',
    pm: 'home,incidents,inventory,reports,tasks,waves',
    migrator: 'agentic,credentials,home,incidents,inventory,tasks,waves',
    admin: 'agentic,config,credentials,home,incidents,inventory,reports,tasks,waves',
    padmin: 'agentic,config,credentials,home,incidents,inventory,reports,tasks,waves',
  };
  const btn = sel => d.querySelector(sel);
  const rbacBtns = scope => [...d.querySelectorAll((scope || '') + ' [data-rbac]')];
  const byScope = (scope, name) => rbacBtns(scope).filter(e => e.dataset.rbac === name);

  // ---- nav matrix ----
  for (const p of ['architect','pm','migrator','admin','padmin']){
    w.setPersona(p, true);
    t('nav matrix ' + p, navVisible() === EXPECT_NAV[p]);
  }
  // masthead task shortcut follows the tasks view
  w.setPersona('architect', true);
  t('masthead task btn hidden for architect', btn('#taskQueueBtn').classList.contains('rbac-hidden'));
  // ---- flat nav (user request: no "Administration" section header) ----
  t('no Administration section header remains', !d.querySelector('.pf-v6-c-nav__section') && d.getElementById('nav-admin-title') === null);
  t('nav is a single flat list', d.querySelectorAll('.pf-v6-c-nav__list').length === 1);
  const mainList = d.querySelector('.pf-v6-c-nav__list');
  t('admin entries sit flat in the main list', mainList.contains(d.querySelector('.pf-v6-c-nav__link[data-screen="config"]'))
    && mainList.contains(d.querySelector('.pf-v6-c-nav__link[data-screen="tasks"]')));
  w.setPersona('pm', true);
  t('pm: flat nav shows Task manager without any header', navVisible() === EXPECT_NAV.pm
    && !d.querySelector('.pf-v6-c-nav__section'));
  w.setPersona('pm', true);
  t('masthead task btn visible for pm', !btn('#taskQueueBtn').classList.contains('rbac-hidden'));
  t('pm tasks nav visible (admin-only class removed)', [...d.querySelectorAll('[data-screen="tasks"]')].every(l => !l.classList.contains('admin-only') || l.classList.contains('rbac-hidden')));

  // ---- deep-link guard ----
  w.setPersona('pm', true);
  w.location.hash = '#scr=config&persona=pm';
  if (w.applyHash) w.applyHash();
  t('deep link #scr=config as pm redirects home', w.eval('state.scr') === 'home');
  t('guard toast shown', !!d.getElementById('rbacToast') && d.getElementById('rbacToast').textContent.includes('Not authorized'));
  w.location.hash = '#scr=reports&persona=migrator';
  if (w.applyHash) w.applyHash();
  t('deep link #scr=reports as migrator redirects home', w.eval('state.scr') === 'home');

  // ---- pm: read-only enforcement ----
  w.setPersona('pm', true); w.show('inventory', true);
  const createBtn = byScope('#scr-inventory', 'applications:create')[0];
  t('pm: Create new disabled', createBtn.disabled && createBtn.title.includes('applications:create'));
  t('pm: Import disabled', byScope('#scr-inventory', 'applications:create')[1].disabled);
  t('pm: select-all disabled', btn('#invSelAll').disabled);
  t('pm: row checkboxes disabled', [...d.querySelectorAll('#invBody input[type=checkbox]')].every(c => c.disabled));
  t('pm: select menu disabled (rbac-disabled)', rbacBtns('#scr-inventory').filter(e => e.dataset.rbac === 'applications:edit' && e.tagName !== 'INPUT').every(e => e.classList.contains('rbac-disabled') || e.disabled));
  w.openAppRow(d.querySelector('#invBody [data-name="payments-api"]'));  /* dynamic modal — post-render RBAC hook gates it */
  t('pm: Queue analysis disabled (static modal)', byScope('#modalAppBody', 'applications:analyze')[0].disabled);
  t('pm: Edit + Delete disabled (static modal)', byScope('#modalAppBody', 'applications:edit')[0].disabled && byScope('#modalAppBody', 'applications:delete')[0].disabled);
  t('pm: wave re-validate disabled', byScope('#scr-waves', 'waves:edit')[0].disabled);
  w.show('tasks', true);
  t('pm: task select-all disabled', btn('#taskSelAll').disabled);
  t('pm: cancel btn stays disabled', btn('#cancelBtn').disabled);

  // ---- migrator: executes, cannot plan or curate ----
  w.setPersona('migrator', true); w.show('inventory', true);
  t('migrator: Create new enabled', !createBtn.disabled);
  t('migrator: Edit/Delete enabled (helpers)', byScope('#modalAppBody', 'applications:edit')[0].disabled === false);
  t('migrator: re-validate disabled (no waves:edit)', byScope('#scr-waves', 'waves:edit')[0].disabled);
  w.show('tasks', true);
  t('migrator: task select-all enabled', !btn('#taskSelAll').disabled);
  w.show('agentic', true);
  t('migrator: Create run enabled', !byScope('#scr-agentic', 'runs:create')[0].disabled);
  t('migrator: Create agent disabled', byScope('#scr-agentic', 'agents:create').every(b => b.disabled));
  t('migrator: Delete finished disabled', btn('#agRunsDelFinished').disabled);
  // review sign-off: migrator keeps the read-only note
  w.show('inventory', true);
  w.openReview('payments-api');
  t('migrator: review modal read-only note', d.getElementById('reviewBody').textContent.includes('lacks review:write'));

  // ---- architect: plans, cannot triage or curate ----
  w.setPersona('architect', true); w.show('waves', true);
  t('architect: re-validate enabled', !byScope('#scr-waves', 'waves:edit')[0].disabled);
  w.show('tasks', true);
  t('architect: tasks deep link redirects home', w.eval('state.scr') === 'home');
  w.show('incidents', true);
  w.openDrawer('incident');
  t('architect: Mark false positive disabled (no incidents:triage)', byScope('#drawerBody', 'incidents:triage').every(b => b.disabled));
  t('architect: Mark resolved disabled', byScope('#drawerBody', 'incidents:resolve').every(b => b.disabled));
  w.show('agentic', true);
  t('architect: agent registry create disabled', byScope('#scr-agentic', 'agents:create').every(b => b.disabled));
  t('architect: Create run enabled', !byScope('#scr-agentic', 'runs:create')[0].disabled);
  w.openReview('payments-api');
  t('architect: review steward buttons render', !!d.getElementById('rvComment') && d.getElementById('reviewBody').textContent.includes('Approve'));
  w.closeReview();

  // ---- migrator triage verbs enabled ----
  w.setPersona('migrator', true); w.show('incidents', true);
  w.openDrawer('incident');
  t('migrator: triage verbs enabled', byScope('#drawerBody', 'incidents:triage').every(b => !b.disabled));

  // ---- notification feed role filter (#36 item 5) ----
  const feedCount = () => [...d.querySelectorAll('#notifDrawer [data-for]')].filter(li => !li.classList.contains('rbac-hidden')).length;
  w.setPersona('architect', true);
  t('feed: architect sees 1', feedCount() === 1 && d.getElementById('notifStatus').textContent.startsWith('1 unread'));
  w.setPersona('pm', true);
  t('feed: pm sees 1 (waves item)', feedCount() === 1);
  w.setPersona('migrator', true);
  t('feed: migrator sees 1', feedCount() === 1);
  w.setPersona('admin', true);
  /* org filter (user report: nwf admin saw Meridian's tenant-provisioning event): the admin
     blanket-bypass is role-only; org-tagged items follow state.org — so nwf admin now sees 5 */
  t('feed: admin sees 5 (org filter hides Meridian item)', feedCount() === 5 && d.getElementById('notifStatus').textContent.startsWith('5 unread'));
  t('feed: nwf admin does NOT see Meridian item', [...d.querySelectorAll('#notifDrawer [data-for="padmin"]')].every(li => li.classList.contains('rbac-hidden')));
  w.eval('state.org = "mrd"'); w.eval('applyRbac()');
  /* every feed item now declares data-org (user requirement: waves/tasks/incident/analysis
     belong to an organization) — the mrd seat sees only its own org's item */
  t('feed: mrd admin sees only Meridian items (all items org-tagged)', feedCount() === 1 && ![...d.querySelectorAll('#notifDrawer [data-for="padmin"]')].every(li => li.classList.contains('rbac-hidden')));
  w.eval('state.org = "nwf"'); w.eval('applyRbac()');
  w.setPersona('padmin', true);
  t('feed: padmin spans orgs (sees Meridian item)', feedCount() === 1 && ![...d.querySelectorAll('#notifDrawer [data-for="padmin"]')].every(li => li.classList.contains('rbac-hidden')));

  // ---- admin: full power ----
  w.setPersona('admin', true);
  t('admin: config reachable', (w.show('config', true), w.eval('state.scr') === 'config'));
  let ok = 0;
  [...d.querySelectorAll('#scr-config > .pf-v6-c-tabs .pf-v6-c-tabs__link')].forEach(b => { b.click(); const p = d.getElementById(b.getAttribute('aria-controls')); if (p && !p.hidden) ok++; });
  t('admin: config 8/8', ok === 8);
  w.show('agentic', true);
  ok = 0;
  [...d.querySelectorAll('#scr-agentic > .pf-v6-c-tabs .pf-v6-c-tabs__link')].forEach(b => { b.click(); const p = d.getElementById(b.getAttribute('aria-controls')); if (p && !p.hidden) ok++; });
  t('admin: agentic 6/6', ok === 6);
  t('admin: all verbs enabled', rbacBtns().filter(e => (e.tagName === 'BUTTON' || e.tagName === 'INPUT') && !e.closest('#panel-ctrl-orgs') && !e.closest('.lp-padmin') && e.id !== 'tab-ctrl-orgs' && !e.hasAttribute('data-gate-disable')).every(b => !b.disabled));   /* tenants:* verbs are platform-admin-only; data-gate-disable buttons carry the STATE-based queue gate (only Not started / Succeeded analyses queue — a Running app is unqueueable for every persona, so scope-enablement doesn't apply) */
  t('admin: agent registry create enabled', byScope('#scr-agentic', 'agents:create').every(b => !b.disabled));

  // ---- regression (as admin for screen walks; rows unchanged) ----
  w.setPersona('architect', true);
  /* reset the tenancy scope to boot state — the pm walk above locked it to team Claims (#41) */
  w.eval("state.org='nwf'; state.dept='retail'; state.team=''; applyTenancy();");
  const ref = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'inv-rows-reference-wp3.json'), 'utf8'));
  const norm = s => s.replace(/&middot;/g, '\u00b7').replace(/\s+/g, ' ').trim();
  const irows = [...d.querySelectorAll('#invBody tr')];
  let mm = 0;
  irows.forEach((r, i) => { const got = [...r.children].map(c => norm(c.innerHTML)); const want = ref[i].cells.map(norm); if (got.some((c, j) => c !== want[j])) mm++; });
  t('byte-equality 12x10 (architect)', mm === 0 && irows.length === 12);
  t('masthead count 4', d.getElementById('taskQueueCount').textContent === '4');

  // ---- persona split: Project manager (team-locked) vs Program manager (#41) ----
  w.setPersona('pm', true);
  t('split: pm locked to team Claims', w.eval('state.org') === 'nwf' && w.eval('state.dept') === 'retail' && w.eval('state.team') === 'claims');
  t('split: pm sees 6 team rows', [...d.querySelectorAll('#invBody tr')].length === 6);
  t('split: pm tenancy switcher disabled with reason', btn('#tenancyBtn').disabled && btn('#tenancyBtn').title.includes('Program manager'));
  t('split: pm sees no cross-team strips (team-scoped — the info names other teams)', [1, 2, 3, 4].every(n => d.getElementById('waveCoord-' + n).hidden));
  w.location.hash = '#scr=inventory&org=mrd&persona=pm';
  w.applyHash();
  t('split: pm deep-link org param loses to the team lock', w.eval('state.org') === 'nwf' && w.eval('state.team') === 'claims');
  w.setPersona('migrator', true);
  t('split: migrator locked to team Claims too (executor within the team)', w.eval('state.org') === 'nwf' && w.eval('state.team') === 'claims' && [...d.querySelectorAll('#invBody tr')].length === 6 && btn('#tenancyBtn').disabled);
  w.location.hash = '#scr=inventory&org=mrd&persona=migrator';
  w.applyHash();
  t('split: migrator deep-link org param loses to the team lock', w.eval('state.org') === 'nwf' && w.eval('state.team') === 'claims');
  w.setPersona('pgm', true);
  w.setTeam('');   /* the pgm inherits the pm's team scope until they widen it — widen to all teams */
  t('split: pgm has free scope (12 rows)', [...d.querySelectorAll('#invBody tr')].length === 12 && !btn('#tenancyBtn').disabled);
  w.show('waves', true);
  { /* coordination info lives IN each wave (user request — the separate pgm-only card is gone);
       the Home program landing keeps its summary mirror */
    const strip = n => d.getElementById('waveCoord-' + n).textContent;
    t('split: pgm gets per-wave coordination strips (the card is gone)', [1, 2, 3, 4].every(n => !d.getElementById('waveCoord-' + n).hidden));
    t('split: W3 strip — single team + dependency edge verdict (stays within Claims)', strip(3).includes('Claims') && strip(3).includes('Single team') && strip(3).includes('stays within team Claims'));
    t('split: W4 strip — cross-team flag (3 teams) + the shared quota blocker naming both teams', strip(4).includes('Claims, Portfolio, Customer digital') && strip(4).includes('Cross-team') && strip(4).includes('claims-web (team Claims)') && strip(4).includes('risk-scoring (team Portfolio)'));
    t('split: W1/W2 strips honest (no sampled members)', strip(1).includes('no sampled members') && strip(2).includes('no sampled members')); }
  w.setOrg('mrd');
  t('split: pgm in Meridian gets the guided empty state (per wave)', d.getElementById('waveCoord-3').textContent.includes('No migration waves'));
  w.setOrg('nwf');
  t('split: pgm notification item present', [...d.querySelectorAll('#notifDrawer [data-for="pgm"]')].length === 1);
  w.setPersona('architect', true);
  w.show('waves', true);
  t('split: architect has no coordination strips (program scope only)', [1, 2, 3, 4].every(n => d.getElementById('waveCoord-' + n).hidden));
  t('split: tour exists for pgm', w.eval('TOURS.pgm.steps.length') === 4);

  // ---- admin tiers: organization admin (org-locked) vs platform administrator (#41/#42) ----
  w.setPersona('admin', true);
  w.setOrg('mrd');
  t('tiers: org admin cannot switch organization', w.eval('state.org') === 'nwf');
  w.show('config', true); w.cfgTabApply('controls');
  d.getElementById('tab-ctrl-teams').click();
  t('tiers: org admin teams table = its org only (4)', d.querySelectorAll('#teamsBody tr').length === 4);
  t('tiers: organizations tab disabled for org admin', btn('#tab-ctrl-orgs').disabled);
  w.setPersona('padmin', true);
  t('tiers: padmin nav matrix', navVisible() === EXPECT_NAV.padmin);
  t('tiers: padmin teams table = all orgs (6)', d.querySelectorAll('#teamsBody tr').length === 6);
  t('tiers: organizations tab enabled for padmin', !btn('#tab-ctrl-orgs').disabled);
  btn('#tab-ctrl-orgs').click();
  t('tiers: orgs table lists 2 organizations', d.querySelectorAll('#orgsBody tr').length === 2);
  const auditBefore = d.querySelectorAll('#auditBody tr').length;
  w.setOrg('mrd');
  t('tiers: padmin cross-org pivot works', w.eval('state.org') === 'mrd');
  t('tiers: pivot announced with an audit toast', d.getElementById('rbacToast') && d.getElementById('rbacToast').textContent.includes('audit trail'));
  t('tiers: pivot recorded as tenant:access', d.querySelectorAll('#auditBody tr').length === auditBefore + 1 && d.getElementById('auditBody').textContent.includes('tenant:access') && d.getElementById('auditBody').textContent.includes('Meridian Health'));
  w.openOrgModal();
  d.getElementById('omName').value = 'Acme Logistics';
  d.getElementById('omDept').value = 'Freight Operations';
  w.orgCreate();
  t('tiers: organization provisioned (3 orgs)', d.querySelectorAll('#orgsBody tr').length === 3);
  t('tiers: provisioning audited (tenant:provision)', d.getElementById('auditBody').textContent.includes('tenant:provision') && d.getElementById('auditBody').textContent.includes('Acme Logistics'));
  t('tiers: padmin notification item present', [...d.querySelectorAll('#notifDrawer [data-for="padmin"]')].length === 1);
  t('tiers: tour exists for padmin (leads with the tenant-portfolio landing)', w.eval('TOURS.padmin.steps.length') === 4);

  // ---- architect responsibility levels: application / team / department / organization ----
  const invRows = () => d.querySelectorAll('#invBody tr').length;
  const lanesVisible = () => [...d.querySelectorAll('#scr-waves .wave-exec')].filter(l => !l.classList.contains('rbac-hidden')).length;
  t('levels: responsibility selector hidden for non-architect (padmin)', btn('#archLevelBtn').classList.contains('rbac-hidden'));
  w.setPersona('architect', true);
  t('levels: selector visible for architect; boot level = Organization', !btn('#archLevelBtn').classList.contains('rbac-hidden') && w.eval('state.archLevel') === 'org' && btn('#archLevelLabel').textContent === 'Organization');
  t('levels: org level = free dept/team within the org (12 rows)', invRows() === 12 && !btn('#tenancyBtn').disabled);
  w.setArchLevel('dept');
  t('levels: dept level clamps to Retail Banking', w.eval('state.dept') === 'retail');
  w.setDept('wealth');
  t('levels: dept architect cannot switch department (no-op)', w.eval('state.dept') === 'retail' && invRows() === 12);
  w.setTeam('portfolio');
  t('levels: dept architect teams still free (2 portfolio rows)', w.eval('state.team') === 'portfolio' && invRows() === 2);
  w.setTeam('');
  w.setArchLevel('team');
  t('levels: team level locks to Claims (6 rows, switcher disabled)', w.eval('state.team') === 'claims' && invRows() === 6 && btn('#tenancyBtn').disabled && btn('#tenancyBtn').title.includes('Team architects'));
  w.setArchLevel('app');
  w.show('waves', true);
  t('levels: app level = single app (payments-api), path suffix', invRows() === 1 && d.querySelector('#invBody tr').dataset.name === 'payments-api' && btn('#tenancyLabel').textContent.includes('app payments-api'));
  t('levels: app level waves cascade to its lane only (Wave 3)', lanesVisible() === 1 && d.querySelector('#scr-waves .wave-exec:not(.rbac-hidden)').textContent.includes('Wave 3'));
  t('levels: app level switcher disabled + tooltip', btn('#tenancyBtn').disabled && btn('#tenancyBtn').title.includes('Application architects'));
  w.location.hash = '#scr=inventory&org=mrd&arch=app&persona=architect';
  w.applyHash();
  t('levels: deep link org=mrd loses to the architect org clamp; arch honored', w.eval('state.org') === 'nwf' && w.eval('state.archLevel') === 'app' && invRows() === 1);
  w.setArchLevel('org');
  t('levels: back to organization: switcher re-enabled (position kept, movement unlocked)', !btn('#tenancyBtn').disabled && w.location.hash.includes('arch=org'));
  w.setTeam('');
  t('levels: org architect can widen back to all teams (12 rows)', invRows() === 12);

  // ---- credential governance: team-owned credentials (#15 + #41) ----
  const credRows = () => [...d.querySelectorAll('#credsBody tr')].map(r => r.querySelector('b').textContent).sort();
  w.setPersona('pm', true);
  w.show('credentials', true);
  t('identities: pm has no Credentials view (deep link redirects Home)', w.eval('state.scr') === 'home');
  w.show('waves', true);
  { /* readiness was folded into the wave's GATE conditions (user challenge: a separate card duplicated
       the Credentials view and was hidden from the personas gating the wave) — gate STATE is visible
       to everyone, credential MANAGEMENT stays behind identities:* on the Credentials view */
    const gateTxt = [...d.querySelectorAll('#wave-members-3 .pf-v6-c-list li')].map(li => li.textContent).join(' ');
    t('identities: credential readiness is a wave GATE condition — visible to pm (no identities:read)', gateTxt.includes('Credentials verified') && gateTxt.includes('expiring')); }
  w.setPersona('migrator', true);
  w.show('credentials', true);
  t('identities: team-locked migrator sees exactly Claims\' 3 credentials', w.eval('state.scr') === 'credentials' && credRows().join(',') === 'gitlab-pat,nexus-mvn,svn-read-key');
  t('identities: migrator manages the team\'s credentials (add enabled, re-test enabled)', !d.querySelector('#credsCard button[data-rbac="identities:create"]').disabled && ![...d.querySelectorAll('#credsBody button[data-rbac="identities:verify"]')].some(b => b.disabled));
  w.show('waves', true);
  t('identities: the credentials gate names the blast radius (svn-read-key → the Wave-3 members it serves)', [...d.querySelectorAll('#wave-members-3 .pf-v6-c-list li')].some(li => li.textContent.includes('svn-read-key') && li.textContent.includes('invoicing')));
  w.location.hash = '#scr=credentials&org=mrd&persona=migrator';
  w.applyHash();
  t('identities: migrator deep-link org=mrd loses to the team lock (3 Claims rows)', w.eval('state.org') === 'nwf' && credRows().join(',') === 'gitlab-pat,nexus-mvn,svn-read-key');
  w.setPersona('architect', true);
  w.setTeam('');   /* the architect inherits the migrator's team clamp — org-level widening is explicit */
  w.show('credentials', true);
  t('identities: org architect sees all 4 Northwind credentials (2 teams)', credRows().join(',') === 'github-wealth-pat,gitlab-pat,nexus-mvn,svn-read-key');
  w.setOrg('mrd');
  t('identities: architect org-locked — Meridian credentials invisible', w.eval('state.org') === 'nwf' && !credRows().includes('epic-fhir-token'));
  w.setArchLevel('team');
  t('identities: team architect clamps to Claims (3 rows)', credRows().join(',') === 'gitlab-pat,nexus-mvn,svn-read-key');
  w.setArchLevel('org');
  w.show('config', true);
  t('identities: hub tab is gone (8 tabs) — credentials promoted to a first-class view', w.eval('CFG_TABS.includes("credentials")') === false && !d.getElementById('tab-cfg-credentials'));
  w.setPersona('padmin', true); w.setOrg('nwf');   /* pivot back — the org admin inherits the pivot target as its lock */
  w.setPersona('admin', true);
  w.show('credentials', true);
  t('identities: org admin sees the org-wide set (4 nwf credentials)', credRows().length === 4 && !credRows().includes('epic-fhir-token'));

  // agentic registry deletion is NOT an architect capability (#16 item 4): agents are platform infrastructure
  w.setPersona('architect', true);
  w.show('agentic', true); w.showAgentic('agents');
  const agDel = () => d.querySelector('#agAgentsBody button[data-rbac="agents:delete"]');
  t('rbac: architect cannot delete agents (was mis-scoped to applications:delete)', agDel() && agDel().disabled && agDel().title.includes('agents:delete'));
  t('rbac: architect cannot delete skills/workflows either (agents:delete)', [...d.querySelectorAll('#scr-agentic button[data-rbac="agents:delete"]')].every(b => b.disabled));
  w.showAgentic('wfruns');
  t('rbac: architect cannot delete workflow-run records (runs:delete — evidence)', [...d.querySelectorAll('#scr-agentic button[data-rbac="runs:delete"]')].every(b => b.disabled));
  w.setPersona('admin', true);
  w.showAgentic('agents');
  t('rbac: org admin deletes registry entries (agents:delete enabled)', !agDel().disabled);
  w.setPersona('architect', true);

  // stop/resume: stopping pauses a run at its last checkpoint (resumable); cancel stays terminal
  w.setPersona('migrator', true);
  w.show('agentic', true); w.showAgentic('wfruns');
  { const stop = d.querySelector('#agWfRunsBody button[aria-label="Stop run"]');
    t('runs: migrator sees Stop on the running workflow run (runs:pause, held with runs:cancel)', stop && !stop.disabled && stop.dataset.rbac === 'runs:pause');
    stop.click(); }
  t('runs: stopping WR-14 pauses it — checkpoint semantics, not cancellation', w.eval('MOCK_WFRUNS.find(r => r.name === "WR-14").state') === 'paused' && w.eval('MOCK_WFRUNS.find(r => r.name === "WR-14").duration').includes('(paused)'));
  t('runs: stop PROPAGATES to the running stage #27 (the workflow pauses with its stage)', w.eval('MOCK_AGENT_RUNS.find(r => r.id === 27).state') === 'paused');
  t('runs: the stop is logged as a structured event (resumable; quota spend halted)', w.eval('MOCK_AGENT_RUNS.find(r => r.id === 27).events.slice(-1)[0][1]').includes('run stopped') && w.eval('MOCK_AGENT_RUNS.find(r => r.id === 27).events.slice(-1)[0][1]').includes('quota'));
  w.showAgentic('agentruns');
  t('runs: the paused stage row offers Resume', !!d.querySelector('#agRunsBody tr[data-run="27"] button[aria-label="Resume run"]'));
  { const nWithPaused = w.eval('MOCK_AGENT_RUNS.filter(r => scopedApps().some(a => a.name === r.app) && r.state !== "running" && r.state !== "queued").length');
    const nSans = w.eval('MOCK_AGENT_RUNS.filter(r => scopedApps().some(a => a.name === r.app) && r.state !== "running" && r.state !== "queued" && r.state !== "paused").length');
    t('runs: a paused run is NOT in the Delete-finished set (it is not finished)', nWithPaused !== nSans && d.getElementById('agRunsDelFinished').textContent.includes('(' + nSans + ')')); }
  w.showAgentic('wfruns');
  { const res = d.querySelector('#agWfRunsBody tr[data-wfrun="WR-14"] button[aria-label="Resume run"]');
    t('runs: the paused workflow run offers Resume (same runs:pause scope)', res && !res.disabled);
    res.click(); }
  t('runs: resuming WR-14 resumes its paused stage #27 (propagation down)', w.eval('MOCK_WFRUNS.find(r => r.name === "WR-14").state') === 'running' && w.eval('MOCK_AGENT_RUNS.find(r => r.id === 27).state') === 'running');
  t('runs: resume logs the checkpoint continuation and restores the live duration', w.eval('MOCK_AGENT_RUNS.find(r => r.id === 27).events.slice(-1)[0][1]').includes('run resumed') && !w.eval('MOCK_AGENT_RUNS.find(r => r.id === 27).duration').includes('(paused)'));

  // run cancellation: the personas who create runs may cancel them (runs:cancel) — the migrator executes, not just watches
  w.setPersona('migrator', true);
  w.show('agentic', true); w.showAgentic('wfruns');
  const wfrunCancel = () => d.querySelector('#scr-agentic button[data-rbac="runs:cancel"]');
  t('runs: migrator sees Cancel on the running workflow run (WR-14, runs:cancel enabled)', wfrunCancel() && !wfrunCancel().disabled && wfrunCancel().dataset.rbac === 'runs:cancel');
  wfrunCancel().click();
  t('runs: cancel flips the record to Cancelled — kept, not deleted', w.eval('MOCK_WFRUNS.find(r => r.name === "WR-14").state') === 'cancelled' && d.getElementById('rbacToast').textContent.includes('record is kept'));
  t('runs: the cancelled WR-14 offers no Resume — cancel stays terminal, stop is the resumable action', !d.querySelector('#agWfRunsBody tr[data-wfrun="WR-14"] button[aria-label="Resume run"]') && w.eval('MOCK_WFRUNS.find(r => r.name === "WR-14").state') === 'cancelled');
  t('runs: cancelling WR-14 PROPAGATES to its running stage #27 (reason names the parent)', w.eval('MOCK_AGENT_RUNS.find(r => r.id === 27).state') === 'cancelled' && w.eval('MOCK_AGENT_RUNS.find(r => r.id === 27).reason').includes('WR-14'));
  t('runs: propagated cancellation appends a terminal stage CANCELLED event to #27\'s log (#50)', w.eval('MOCK_AGENT_RUNS.find(r => r.id === 27).events.slice(-1)[0][1]').includes('stage CANCELLED'));
  w.showAgentic('agentruns');
  { const cbs = [...d.querySelectorAll('#agRunsBody button[data-rbac="runs:cancel"]')];
    t('runs: only the still-running stage #22 offers cancel (#27 was cancelled by propagation)', cbs.length === 1 && !cbs[0].disabled && !!cbs[0].closest('tr[data-run="22"]'));
    cbs[0].click(); }
  t('runs: cancelling stage #22 PROPAGATES up to its parent WR-15 (a workflow cannot proceed past a cancelled stage)', w.eval('MOCK_WFRUNS.find(r => r.name === "WR-15").state') === 'cancelled');
  t('runs: WR-15\'s reason names the cancelled stage and actor', w.eval('MOCK_WFRUNS.find(r => r.name === "WR-15").reason').includes('stage #22'));
  t('runs: cancelled run lands in the scoped Delete-finished set (slot freed, #38)', w.eval('MOCK_AGENT_RUNS.find(r => r.id === 22).state') === 'cancelled' && d.getElementById('agRunsDelFinished').textContent.includes('(' + w.eval('MOCK_AGENT_RUNS.filter(r => scopedApps().some(a => a.name === r.app) && r.state !== "running" && r.state !== "queued").length') + ')'));
  t('runs: cancelled run lands in the scoped Delete-finished set (slot freed, #38)', w.eval('MOCK_AGENT_RUNS.find(r => r.id === 22).state') === 'cancelled' && d.getElementById('agRunsDelFinished').textContent.includes('(' + w.eval('MOCK_AGENT_RUNS.filter(r => scopedApps().some(a => a.name === r.app) && r.state !== "running" && r.state !== "queued").length') + ')'));
  w.setPersona('architect', true);
  w.showAgentic('wfruns');
  { /* both running runs were cancelled (with propagation) by the migrator above: no workflow-run row
       offers cancel any more — cancel belongs to running records only */
    const cbs = [...d.querySelectorAll('#agWfRunsBody button[data-rbac="runs:cancel"]')];
    t('runs: no cancel buttons remain once every running run is cancelled (propagation included)', cbs.length === 0);
  }
  w.setPersona('admin', true);
  w.show('agentic', true); w.showAgentic('agentruns');
  t('runs: admin holds runs:cancel as well', w.eval('MOCK_AGENT_RUNS.some(r => r.state === "running")') ? !d.querySelector('#agRunsBody button[data-rbac="runs:cancel"]').disabled : true);

  // run drill-down: workflow runs and agent runs are one lifecycle — linked, not merged (user question on consolidation)
  w.setPersona('architect', true);
  w.showAgentic('wfruns');
  // workflow-run rows open a modal (user request); agent-run rows stay in the drawer
  d.querySelector('#agWfRunsBody tr[data-wfrun="WR-14"]').click();
  t('runs: clicking a workflow-run row opens the detail MODAL (not the drawer)', !d.getElementById('modalApp').hidden && d.getElementById('drawerRoot').hidden);
  const kidsLink = [...d.getElementById('modalAppBody').querySelectorAll('a')].find(a => (a.getAttribute('onclick') || '').includes('jumpToAgentRun(26)'));
  t('runs: WR-14 modal lists its stage records (#26 plan / #27 execute, jump links)', !!kidsLink && d.getElementById('modalAppBody').textContent.includes('Agent runs composing this workflow run'));
  { /* the stage records live IN the modal (user request): identity + accounting embedded */
    const mb = d.getElementById('modalAppBody').textContent;
    t('runs: the modal embeds the stage records\' identity + token/cost accounting (#20/#28)', mb.includes('58,410') && mb.includes('granite-3.3-70b') && mb.includes('est. cost') && mb.includes('plan-agent@sha256'));
    w.closeModals();
    d.querySelector('#agWfRunsBody tr[data-wfrun="WR-12"]').click();
    const m12 = d.getElementById('modalAppBody').textContent;
    t('runs: a failed child\'s cause surfaces in the parent modal (#3)', m12.includes('kafka-contract step red') && m12.includes('18,404'));
    // run-total line: summed across the composing records (user request)
    w.closeModals();
    d.querySelector('#agWfRunsBody tr[data-wfrun="WR-13"]').click();
    const m13 = d.getElementById('modalAppBody').textContent;
    t('runs: run-total sums multi-record runs (WR-13: 2 agent runs, 1M/96k, $30.90)', m13.includes('Run total') && m13.includes('2 agent runs') && m13.includes('1M/96k') && m13.includes('$30.90'));
    { /* the composing records render as a pipeline (user request): phase-ordered nodes + connectors */
      const pipe = d.querySelector('#modalAppBody [data-pipeline]');
      const nodeIds = [...pipe.querySelectorAll(':scope > div')].filter(n => n.querySelector('a')).map(n => n.querySelector('a').textContent);
      t('runs: WR-13 pipeline orders the stages plan → execute with arrow connectors', nodeIds.join(',') === '#17,#16' && pipe.querySelectorAll('svg.fas').length >= 1);
      t('runs: pipeline nodes are state-colored and phase-labeled', pipe.innerHTML.includes('--status--success--default') && pipe.textContent.includes('plan') && pipe.textContent.includes('execute'));
    }
    w.closeModals();
    d.querySelector('#agWfRunsBody tr[data-wfrun="WR-14"]').click();
    const m14 = d.getElementById('modalAppBody').textContent;
    t('runs: WR-14\'s pipeline reflects the propagated cancellation (stage #27 shows Cancelled) with its run total intact', m14.includes('Run total') && m14.includes('2 agent runs') && m14.includes('$6.30') && m14.includes('stage CANCELLED'));
  }
  /* user model correction: one agent run = ONE stage — the triplet record was decomposed;
     the rich canonical record moved to the workflow-run level (WR-8, a completed run) */
  t('runs: invariant — every agent run covers exactly one stage', w.eval('MOCK_AGENT_RUNS.every(r => ["plan", "execute", "verify"].includes(r.phase))'));
  d.querySelector('#agWfRunsBody tr[data-wfrun="WR-8"]').click();
  { const mb = d.getElementById('modalAppBody');
    t('runs: the canonical completed run (WR-8) opens the rich workflow-run record', !d.getElementById('modalApp').hidden && mb.textContent.includes('Workflow run WR-8') && mb.textContent.includes('Stage (agent run)'));
    t('runs: the rich record links its three stage records (#23/#24/#25)', [...mb.querySelectorAll('a')].filter(a => (a.getAttribute('onclick') || '').includes('jumpToAgentRun')).length >= 3); }
  w.jumpToAgentRun(24);
  t('runs: stage record #24 links back to parent WR-8 (in the modal)', [...d.getElementById('modalAppBody').querySelectorAll('a')].some(a => (a.getAttribute('onclick') || '').includes("jumpToWfRun('WR-8')")));
  w.jumpToAgentRun(26);
  t('runs: jump from the wfrun modal opens stage record #26 as the agent-run modal', w.eval('state.agTab') === 'agentruns' && !d.getElementById('modalApp').hidden && d.getElementById('drawerRoot').hidden && d.getElementById('modalAppBody').textContent.includes('Run #26'));
  const backLink = [...d.getElementById('modalAppBody').querySelectorAll('a')].find(a => (a.getAttribute('onclick') || '').includes("jumpToWfRun('WR-14')"));
  t('runs: run #26 (plan stage) links back to parent WR-14', !!backLink);
  /* the 'logs' of a running agent = its structured event stream (#42): live tail on running records,
     frozen into the record afterwards; the raw model transcript stays ephemeral by upstream design */
  w.jumpToAgentRun(27);
  { const db = d.getElementById('modalAppBody');
    t('runs: the cancelled stage record (#27) keeps its frozen log — pre-cancel events intact, terminal CANCELLED event appended', db.textContent.includes('+28:47') && db.textContent.includes('stage CANCELLED') && !db.textContent.includes('live tail'));
    t('runs: the event log keeps the audit posture — sandbox denials surface (#16 item 6), transcript stays ephemeral', db.textContent.includes('OCSF 4001') && [...db.querySelectorAll('.anno')].some(a => a.dataset.tip.includes('ephemeral'))); }
  w.jumpToAgentRun(18);
  t('runs: a failed record\'s event log ends with the failure cause (#3)', d.getElementById('modalAppBody').textContent.includes('stage FAILED — suite exited 1'));
  d.querySelector('#agRunsBody tr[data-run="27"]').click();
  t('runs: clicking an agent-run row opens the record MODAL (agent runs match workflow runs)', !d.getElementById('modalApp').hidden && d.getElementById('drawerRoot').hidden && d.getElementById('modalAppBody').textContent.includes('Run #27'));
  w.closeModals();
  // discoverability: rows carrying an event log are badged #50 in the Agent-runs table
  w.showAgentic('agentruns');
  { const rows = [...d.querySelectorAll('#agRunsBody tr')];
    const badged = rows.filter(tr => tr.querySelector('.anno') && tr.querySelector('.anno').dataset.tip.includes('event log'));
    const scopedN = w.eval('MOCK_AGENT_RUNS.filter(r => scopedApps().some(a => a.name === r.app)).length');
    t('runs: EVERY stage record carries an event log — all VISIBLE rows badged #50 (' + scopedN + ' in scope; logs are universal, the table is scope-clamped)', badged.length === rows.length && rows.length === scopedN);
    const noLog = rows.map(tr => tr.dataset.run).filter(id => !w.eval('MOCK_AGENT_RUNS.find(r => r.id == ' + id + ').events'));
    t('runs: no record is without its event log (incl. the queued on-demand run)', noLog.length === 0); }
  w.jumpToWfRun('WR-14');
  t('runs: jump back re-opens the WR-14 modal', w.eval('state.agTab') === 'wfruns' && !d.getElementById('modalApp').hidden && d.getElementById('drawerRoot').hidden && d.getElementById('modalAppBody').textContent.includes('Workflow run WR-14'));
  w.closeModals();
  t('runs: closing the modal clears state and hash', d.getElementById('modalApp').hidden && w.eval('state.drawer') === null);
  // user rule: an agent run is ALWAYS part of a workflow run — pinned as a data invariant
  t('runs: invariant — every agent run has a parent workflow run', w.eval('MOCK_AGENT_RUNS.every(r => r.wr && MOCK_WFRUNS.some(x => x.name === r.wr))'));
  t('runs: invariant — every workflow run carries its stage-level agent runs', w.eval('MOCK_WFRUNS.every(x => MOCK_AGENT_RUNS.some(r => r.wr === x.name))'));
  t('runs: invariant — parent and child agree on the application', w.eval('MOCK_AGENT_RUNS.every(r => { const p = MOCK_WFRUNS.find(x => x.name === r.wr); return p && p.app === r.app; })'));
  w.jumpToAgentRun(22);
  t('runs: run #22 links to its parent WR-15 (was ad-hoc — rule closed the gap)', [...d.getElementById('modalAppBody').querySelectorAll('a')].some(a => (a.getAttribute('onclick') || '').includes("jumpToWfRun('WR-15')")));
  w.jumpToAgentRun(18);
  t('runs: run #18 links to its parent WR-12 (verify stage of citrus-verification)', [...d.getElementById('modalAppBody').querySelectorAll('a')].some(a => (a.getAttribute('onclick') || '').includes("jumpToWfRun('WR-12')")));

  // credential assignment in the application form (#15 + #41): the form offers the owning team's credentials
  const afCred = () => d.getElementById('afCred');
  const credOpts = () => [...afCred().options].map(o => o.value).filter(Boolean);
  w.setPersona('migrator', true);
  w.show('inventory', true);
  w.openAppForm('');
  t('identities: app form offers the selected team\'s credentials (Claims, 3)', credOpts().join(',') === 'gitlab-pat,svn-read-key,nexus-mvn');
  d.getElementById('afTeam').value = 'portfolio';
  d.getElementById('afTeam').dispatchEvent(new w.Event('change'));
  t('identities: credential select follows the team (Portfolio → its 1 credential)', credOpts().join(',') === 'github-wealth-pat');
  d.getElementById('afTeam').value = 'imaging';
  d.getElementById('afTeam').dispatchEvent(new w.Event('change'));
  t('identities: team without credentials gets a guided none-option', afCred().options.length === 1 && afCred().options[0].textContent.includes('no credentials yet'));
  w.openAppForm('payments-api');
  t('identities: edit preselects the assigned credential (gitlab-pat)', afCred().value === 'gitlab-pat');
  d.getElementById('afCred').value = 'svn-read-key';
  w.appFormSubmit();
  t('identities: reassignment persists on the application', w.eval('MOCK_APPS.find(a => a.name === "payments-api").credName') === 'svn-read-key');
  { /* the readiness card is gone; the used-by blast radius lives (and recomputes) on the Credentials view */
    const usedBy = name => { const tr = [...d.querySelectorAll('#credsBody tr')].find(r => r.cells[0].textContent.includes(name));
      return tr ? [...tr.cells].find(td => /application/.test(td.textContent)).textContent.trim() : '?'; };
    t('identities: used-by counts cascade on the Credentials view (gitlab-pat 4→3, svn-read-key 2→3)', usedBy('gitlab-pat').startsWith('3') && usedBy('svn-read-key').startsWith('3')); }
  t('identities: canonical template path follows the reassignment (payments-api modal)', (() => {
    const tr = [...d.querySelectorAll('#invBody tr')].find(r => r.dataset.name === 'payments-api');
    tr.click();
    return d.getElementById('modalAppBody').textContent.includes('svn-read-key');
  })());
  w.openAppForm('payments-api');
  d.getElementById('afCred').value = 'gitlab-pat';
  w.appFormSubmit();   /* restore the seed assignment */
  t('identities: application detail names the assigned credential', (() => {
    const tr = [...d.querySelectorAll('#invBody tr')].find(r => r.dataset.name === 'payments-api');
    tr.click();   /* openAppRow → the application detail modal */
    const body = d.getElementById('modalAppBody').textContent;
    return body.includes('gitlab-pat') && body.includes('team-owned');
  })());
  w.setPersona('padmin', true);
  w.location.hash = '#scr=credentials&org=mrd&persona=padmin';
  w.applyHash();
  t('identities: platform-admin pivot to Meridian (1 credential) is audited', credRows().join(',') === 'epic-fhir-token' && w.eval('state.org') === 'mrd' && d.querySelectorAll('#auditBody tr').length >= 1);
  w.setPersona('architect', true);
  w.setPersona('architect', true);
  t('no errors', errors.length === 0);
  console.log(pass + ' passed, ' + fail + ' failed');
}, 150);
