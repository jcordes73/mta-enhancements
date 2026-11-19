/* Suggestion 55 / defect row 190 — Migration assistant demo:
   grounded answers computed live from scopedApps(), attribution footer per answer,
   read-only action card (accept queues), session meter, fixed-set fallback,
   and the #41 scoping behavior (padmin pivot -> refusal naming the org). */
const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
let pass = 0, fail = 0;
const OK = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); c ? pass++ : fail++; };

const dom = new JSDOM(html, { url: 'http://localhost/mock.html#persona=architect', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
setTimeout(() => {
  const w = dom.window, d = w.document;

  OK('masthead carries the assistant button (sparkle, aria-label, #55 anno)',
    !!d.getElementById('assistantBtn') && d.getElementById('assistantBtn').getAttribute('aria-label') === 'Migration assistant'
    && !!d.querySelector('.anno[data-tip^="#55"]'));
  d.getElementById('assistantBtn').click();
  OK('opens the drawer with the scope note naming the org + governance citations',
    !d.getElementById('drawerRoot').hidden
    && d.getElementById('assistantScopeNote').textContent.includes('Northwind Financial')
    && d.getElementById('assistantScopeNote').textContent.includes('#41')
    && d.getElementById('assistantScopeNote').textContent.includes('#16') && d.getElementById('assistantScopeNote').textContent.includes('#20'));
  OK('four suggested prompts + input + meter present, panel skip-pinned (English-only content)',
    d.querySelectorAll('#assistantSuggest button').length === 4
    && !!d.getElementById('assistantInput') && !!d.getElementById('assistantMeter')
    && !!d.querySelector('.assistant-panel[data-i18n-skip]'));

  w.assistantAskIdx(0);
  const a1 = d.querySelectorAll('.assistant-msg')[0].querySelector('.assistant-a');
  OK('risk answer is grounded in the live record (High by inheritance, 214 incidents, 1180 pts)',
    a1.textContent.includes('High') && a1.textContent.includes('EAP8-archetype') && a1.textContent.includes('214 incidents') && a1.textContent.includes('1180'));
  OK('every answer cites its sources + carries the attribution footer (AI marker, agent, gateway+model, tokens, cost, event log)',
    a1.querySelectorAll('.assistant-cites a').length === 3
    && !!a1.querySelector('.ai-marker')
    && a1.querySelector('.assistant-attr').textContent.includes('planner')
    && a1.querySelector('.assistant-attr').textContent.includes('llm-gateway-1 (granite-3.3-70b)')
    && a1.querySelector('.assistant-attr').textContent.includes('tok') && a1.querySelector('.assistant-attr').textContent.includes('$0.0041'));

  w.assistantAskIdx(1);
  const card = d.getElementById('assistantAction');
  OK('proposed write renders as an explicit accept/reject card (read-only until accepted, #16)',
    card.textContent.includes('read-only until you accept') && card.querySelectorAll('button').length === 2);
  card.querySelector('button').click();
  OK('accept executes the real queue action (docs-portal -> queued, task row created)',
    d.getElementById('assistantAction').textContent.includes('Queued')
    && w.eval("scopedApps().find(x => x.name === 'docs-portal').state") === 'queued');

  w.assistantAskIdx(3);
  OK('summary answer computes live from scopedApps() (12 applications in scope) and cites #1',
    d.querySelectorAll('.assistant-msg')[2].textContent.includes('12 applications')
    && d.querySelectorAll('.assistant-msg')[2].textContent.includes('run-diff'));
  OK('session meter accumulates questions, tokens and cost (#20 showback)',
    d.getElementById('assistantMeter').textContent.includes('3 questions')
    && d.getElementById('assistantMeter').textContent.includes('3,776 tok') && d.getElementById('assistantMeter').textContent.includes('$0.0124'));

  w.assistantAsk('what is the meaning of life');
  OK('off-scope question gets the fixed-set fallback (no invented answer)',
    d.querySelectorAll('.assistant-msg')[3].textContent.includes('fixed set of questions'));

  // scoping (#41): the assistant only cites what the user can open — padmin pivot demo
  setTimeout(() => {
    const dom2 = new JSDOM(html, { url: 'http://localhost/mock.html#persona=padmin', runScripts: 'dangerously', pretendToBeVisual: true });
    dom2.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
    setTimeout(() => {
      const w2 = dom2.window, d2 = dom2.window.document;
      d2.getElementById('assistantBtn').click();
      w2.assistantAskIdx(0);
      OK('padmin in Northwind: full grounded answer (214 incidents)',
        d2.querySelectorAll('.assistant-msg')[0].textContent.includes('214 incidents'));
      w2.eval("setOrg('mrd')");
      OK('pivot is audited and the scope note follows (Meridian Health)',
        !!d2.getElementById('rbacToast')
        && d2.getElementById('assistantScopeNote').textContent.includes('Meridian Health'));
      w2.assistantAskIdx(0);
      OK('same question after the pivot: scope refusal naming the org (#41) — no cross-tenant leakage',
        d2.querySelectorAll('.assistant-msg')[1].textContent.includes('not in your current scope')
        && d2.querySelectorAll('.assistant-msg')[1].textContent.includes('Meridian Health'));
      console.log(pass + ' passed, ' + fail + ' failed');
      process.exit(fail ? 1 : 0);
    }, 700);
  }, 50);
}, 700);
