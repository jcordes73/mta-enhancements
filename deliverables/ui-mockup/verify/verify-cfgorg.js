const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
let pass = 0, fail = 0;
const OK = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); c ? pass++ : fail++; };

function boot(hash) {
  const dom = new JSDOM(html, { url: 'http://localhost/mock.html' + (hash || ''), runScripts: 'dangerously', pretendToBeVisual: true });
  dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
  return dom;
}

const d0 = boot();
setTimeout(() => {
  const d = d0.window.document, w = d0.window;

  // ---- parentage sweeps ----
  const dangling = [...d.querySelectorAll('[role="tabpanel"]')]
    .map(p => p.getAttribute('aria-labelledby'))
    .filter(lb => lb && !d.getElementById(lb));
  OK('tabpanel parentage sweep: every aria-labelledby resolves (' + [...d.querySelectorAll('[role="tabpanel"]')].length + ' panels)', dangling.length === 0);

  // ---- nav structure: 4 groups, 15 leaves ----
  const nav = d.getElementById('cfgSubnav');
  const groups = [...nav.querySelectorAll('.pf-v6-c-nav__section-title')].map(h => h.textContent.trim());
  const leaves = [...nav.querySelectorAll('a[data-pane]')];
  OK('four group headings', groups.join(',') === 'Organization,Access,Analysis,Platform');
  OK('15 leaf destinations, every data-pane target exists',
    leaves.length === 15 && leaves.every(a => d.getElementById(a.dataset.pane)));

  // ---- content re-homed (row 233 invariants survive) ----
  OK('Identities card lives in Access', !!d.querySelector('#panel-cfg-access #regIdentBody'));
  OK('Analysis leaves carry targets + rulesets content',
    d.getElementById('pane-ana-targets').textContent.includes('Custom migration targets')
    && d.getElementById('pane-ana-rules').textContent.includes('Custom rulesets'));
  OK('Platform leaves: tracker + source platforms + gateways/agents/api',
    d.getElementById('pane-plat-tracker').textContent.includes('Sync is a first-class outcome')
    && !!d.getElementById('pane-plat-plats') && d.getElementById('panel-aut-gw').textContent.includes('Gateway usage')
    && !d.getElementById('pane-plat-ai'));
  OK('Organization group keeps the row-125 panes',
    !!d.getElementById('panel-ctrl-org') && !!d.getElementById('panel-ctrl-audit'));

  // ---- default + click path ----
  w.setPersona('admin');
  w.show('config');
  OK('default leaf: People & roles (org group), aria-current set',
    w.eval('state.cfgTab') === 'org' && !d.getElementById('panel-ctrl-people').hidden
    && d.querySelector('a[data-cfg-sub="people"]').getAttribute('aria-current') === 'page'
    && d.querySelector('a[data-cfg-sub="people"]').classList.contains('active'));
  OK('exactly one leaf current', [...nav.querySelectorAll('a[aria-current="page"]')].length === 1);
  [...nav.querySelectorAll('a[data-pane]')].forEach(a => { if (a.dataset.cfgSub !== 'people') { /* others hidden below */ } });
  OK('all other leaf panes hidden at default',
    leaves.every(a => a.dataset.cfgSub === 'people' ? !d.getElementById(a.dataset.pane).hidden : d.getElementById(a.dataset.pane).hidden));

  d.querySelector('a[data-cfg-sub="rules"]').click();
  OK('leaf click -> rulesets pane + state (tab=analysis, sub=rules)',
    !d.getElementById('pane-ana-rules').hidden && w.eval('state.cfgTab') === 'analysis' && w.eval('state.cfgSub') === 'rules');
  d.querySelector('a[data-cfg-tab="access"]').click();
  OK('Access leaf -> whole access panel visible (no sub in hash state)',
    !d.getElementById('panel-cfg-access').hidden && w.eval('state.cfgTab') === 'access' && w.eval('state.cfgSub') === null);

  // group containers stay visible; only leaf panes toggle
  OK('group containers never hidden by the nav',
    ['panel-cfg-org', 'panel-cfg-analysis', 'panel-cfg-platform'].every(id => !d.getElementById(id).hidden));

  // ---- row 235: in-pane card tabs (multi-card leaf panes show one card at a time) ----
  const TABBED = [['panel-ctrl-people', 3], ['panel-ctrl-landscape', 3], ['panel-ctrl-org', 3],
                  ['pane-ana-q', 2], ['pane-plat-settings', 3], ['pane-plat-tracker', 2],
                  ['panel-aut-api', 2], ['panel-cfg-access', 4]];
  let tabok = 0;
  for (const [pane, n] of TABBED) {
    const p = d.getElementById(pane);
    const tabs = [...p.querySelectorAll(':scope > .pf-v6-c-tabs .pf-v6-c-tabs__link[data-card]')];
    const cards = [...p.querySelectorAll(':scope > [data-card]')];
    const vis = cards.filter(c => !c.hidden);
    /* row 236: the hidden PROPERTY is not enough (PF6 card display:flex beats UA [hidden]) —
       assert computed display from the mock's own style layer */
    const visDisp = c => w.getComputedStyle(c).getPropertyValue('display').trim();
    if (tabs.length === n && cards.length === n && vis.length === 1 && vis[0].dataset.card === '1'
        && tabs[0].getAttribute('aria-selected') === 'true'
        && visDisp(vis[0]) !== 'none' && cards.filter(c => c !== vis[0]).every(c => visDisp(c) === 'none')) tabok++;
  }
  OK('8 panes converted to card tabs (tab count per pane, default first card visible, computed display)', tabok === TABBED.length);
  const ptabs = [...d.getElementById('panel-ctrl-people').querySelectorAll(':scope > .pf-v6-c-tabs .pf-v6-c-tabs__link[data-card]')];
  ptabs[1].click();
  const ppeople = d.getElementById('panel-ctrl-people');
  const pcard = k => [...ppeople.querySelectorAll(':scope > [data-card]')].find(c => c.dataset.card === k);
  OK('card tab click switches the visible card (Stakeholder groups)',
    !pcard('2').hidden && pcard('1').hidden && ptabs[1].getAttribute('aria-selected') === 'true');
  OK('row-125 card-level guard intact behind the Organizations tab (data-rbac on the card, not the tab)',
    !!d.querySelector('#panel-ctrl-org [data-card="3"][data-rbac="tenants:read"]'));
  OK('Access: 4 tabs in the user-chosen order (row 240: Users / Users & stakeholders / Identities / Tokens), Users default',
    d.getElementById('cfg-users').dataset.card === '1' && !d.getElementById('cfg-users').hidden
    && d.getElementById('cfgcp-access-2').dataset.card === '2'
    && [...d.querySelectorAll('#panel-cfg-access > [data-card]')].length === 4
    && [...d.querySelectorAll('#panel-cfg-access .pf-v6-c-tabs__link[data-card]')].map(b => b.textContent.trim()).join('|') === 'Users|Users & stakeholders|Identities|Tokens');
  // ---- row 237: the org admin sees only his own organization ----
  const orgTabs = [...d.getElementById('panel-ctrl-org').querySelectorAll(':scope > .pf-v6-c-tabs .pf-v6-c-tabs__link[data-card]')];
  orgTabs[2].click();   // Organizations card
  OK('org admin: orgs table lists only his own org (1 row, no Meridian Health)',
    d.querySelectorAll('#orgsBody tr').length === 1
    && !d.getElementById('orgsBody').textContent.includes('Meridian Health'));
  OK('org admin: row-125 disabled guard stays on the Organizations card',
    !!d.querySelector('#panel-ctrl-org [data-card="3"].rbac-disabled'));
  OK('org admin: "Add organization" button hidden, not just disabled (row 238)',
    d.querySelector('#panel-ctrl-org [data-card="3"] button[data-rbac="tenants:create"]').classList.contains('rbac-hidden'));
  w.setPersona('padmin', true);
  OK('padmin: "Add organization" button visible again',
    !d.querySelector('#panel-ctrl-org [data-card="3"] button[data-rbac="tenants:create"]').classList.contains('rbac-hidden'));
  OK('padmin: orgs table lists all orgs (2 rows)',
    d.querySelectorAll('#orgsBody tr').length === 2);
  OK('padmin: tenancy switcher still lists both orgs',
    w.eval('renderTenancyMenu(),document.getElementById("tenancyMenuContent").textContent').includes('Meridian Health'));
  w.setPersona('admin', true);
  OK('org admin: tenancy switcher lists ONLY his own org',
    w.eval('renderTenancyMenu(),document.getElementById("tenancyMenuContent").textContent').includes('Northwind Financial')
    && !w.eval('document.getElementById("tenancyMenuContent").textContent').includes('Meridian Health'));
  ptabs[0].click();  // restore default card for later assertions

  // ---- deep-link alias matrix (state + hash semantics unchanged) ----
  const cases = [
    ['#scr=config&tab=controls', 'org', 'people'],
    ['#scr=config&tab=controls&sub=org', 'org', 'org'],
    ['#scr=config&tab=registries', 'analysis', 'targets'],
    ['#scr=config&tab=rules', 'analysis', 'rules'],
    ['#scr=config&tab=tracker', 'platform', 'tracker'],
    ['#scr=config&tab=automation', 'platform', 'gw'],
    ['#scr=config&tab=platform&sub=ai', 'platform', 'gw'],
    ['#scr=config&tab=platform&sub=plats', 'platform', 'plats'],
    ['#scr=config&tab=access', 'access', ''],
    ['#scr=config&tab=tasks', 'org', 'people'],
  ];
  let done = 0;
  for (const [h, tab, sub] of cases) {
    const dom = boot(h);
    setTimeout(() => {
      const dd = dom.window.document, ww = dom.window;
      const eff = ww.eval('state.cfgSub') || (tab === 'access' ? '' : { org: 'people', analysis: 'q', platform: 'settings' }[tab]);
      const cur = dd.querySelector('#cfgSubnav a[aria-current="page"]');
      OK('deep link ' + h + ' -> ' + tab + (sub ? ' / ' + sub : ''),
        ww.eval('state.cfgTab') === tab && String(eff) === sub
        && !!cur && cur.dataset.cfgTab === tab && (cur.dataset.cfgSub || '') === String(sub)
        && !dd.getElementById(cur.dataset.pane).hidden);
      if (++done === cases.length) {
        console.log(fail === 0 ? 'ALL PASS (' + pass + ')' : 'FAILURES: ' + fail);
        process.exit(fail === 0 ? 0 : 1);
      }
    }, 400);
  }
}, 400);
