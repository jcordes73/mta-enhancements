const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
let pass = 0, fail = 0;
const OK = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); c ? pass++ : fail++; };
setTimeout(() => {
  const d = dom.window.document, w = dom.window;
  w.setPersona('admin');

  // ---- agents: edit pencil + pre-filled edit ----
  const agentRow = () => d.querySelector('#agAgentsBody tr[data-agent="verifier-citrus"]');
  OK('agent rows carry Edit + Delete (live kebab parity)', !!agentRow() && !!agentRow().querySelector('button[aria-label="Edit"]') && !!agentRow().querySelector('button[aria-label="Delete"]'));
  agentRow().querySelector('button[aria-label="Edit"]').click();
  OK('agent edit opens pre-filled with the title/button flipped to Save',
    d.getElementById('aa-title').textContent === 'Edit agent'
    && d.getElementById('agAgentSaveBtn').textContent === 'Save'
    && d.getElementById('agAgentName').value === 'verifier-citrus');
  d.getElementById('agAgentName').value = 'verifier-citrus-v2';
  w.agentSave();
  OK('agent rename saves, cascades into run records, and is audited (agents:update)',
    !!d.querySelector('#agAgentsBody tr[data-agent="verifier-citrus-v2"]')
    && w.eval("MOCK_AGENT_RUNS.some(r => r.agent === 'verifier-citrus-v2')")
    && !w.eval("MOCK_AGENT_RUNS.some(r => r.agent === 'verifier-citrus')")
    && w.eval("AUDIT_LOG[0].action === 'agents:update' && AUDIT_LOG[0].target === 'verifier-citrus-v2'"));
  // rename back
  d.querySelector('#agAgentsBody tr[data-agent="verifier-citrus-v2"] button[aria-label="Edit"]').click();
  d.getElementById('agAgentName').value = 'verifier-citrus';
  w.agentSave();

  // cancelled edit must not leak into create
  d.querySelector('#agAgentsBody tr[data-agent="verifier-citrus"] button[aria-label="Edit"]').click();
  w.closeModals();
  d.querySelector('#panel-ag-agents .pf-m-primary').click();
  OK('a cancelled edit resets the create modal (title Create, empty fields)',
    d.getElementById('aa-title').textContent === 'Create agent' && d.getElementById('agAgentName').value === '');
  w.closeModals();

  // ---- skills: edit pencil + rename cascades into agent bindings ----
  const skillRow = () => d.querySelector('#agSkillsBody tr[data-skill="mig-plan"]');
  OK('skill rows carry Edit + Delete', !!skillRow() && !!skillRow().querySelector('button[aria-label="Edit"]'));
  skillRow().querySelector('button[aria-label="Edit"]').click();
  OK('skill edit opens pre-filled (title Edit skill card, Save)',
    d.getElementById('as-title').textContent === 'Edit skill card' && d.getElementById('agSkillSaveBtn').textContent === 'Save'
    && d.getElementById('agSkillName').value === 'mig-plan');
  d.getElementById('agSkillName').value = 'mig-plan-v2';
  w.skillSave();
  OK('skill rename cascades into BOTH agents\u2019 bindings (analyzer + planner bind mig-plan)',
    w.eval("String(MOCK_AGENTS.find(a => a.name === 'analyzer-jboss-eap-7-to-8').skills).includes('mig-plan-v2')")
    && w.eval("String(MOCK_AGENTS.find(a => a.name === 'planner-spring-boot-to-quarkus').skills).includes('mig-plan-v2')")
    && !w.eval("MOCK_AGENTS.some(a => String(a.skills).includes('mig-plan,')) || MOCK_AGENTS.some(a => String(a.skills).endsWith('mig-plan'))")
    && w.eval("AUDIT_LOG[0].action === 'skills:update'"));
  OK('the agents table re-rendered with the new binding', d.getElementById('agAgentsBody').textContent.includes('mig-plan-v2'));
  // rename back
  d.querySelector('#agSkillsBody tr[data-skill="mig-plan-v2"] button[aria-label="Edit"]').click();
  d.getElementById('agSkillName').value = 'mig-plan';
  w.skillSave();

  // ---- workflow stages builder ----
  /* row 221: the authoring card (New workflow → wfyaml drawer) now precedes the registry card —
     target the registry's Create-workflow stages builder explicitly */
  d.querySelector('#panel-ag-workflows button[onclick="agWfOpen()"]').click();
  OK('the workflow modal carries the live stages builder (starter row + Add stage + chaining alert)',
    d.querySelectorAll('#agWfStageList .wf-stage-row').length === 1
    && !!d.querySelector('#panel-ag-workflows ~ * , .pf-v6-c-backdrop') // noop guard
    && d.getElementById('agWfModal').textContent.includes('Add stage')
    && d.getElementById('agWfModal').textContent.includes('Each stage receives the previous stage\u2019s artifacts'));
  OK('a stage row is name + agent select + instructions (live builder fields)',
    (() => { const r = d.querySelector('#agWfStageList .wf-stage-row'); return !!r.querySelector('input') && !!r.querySelector('select') && !!r.querySelector('textarea'); })());
  d.getElementById('agWfName').value = 'quarkus-containerize';
  w.wfSave();
  OK('empty stage name is rejected with location+cause', !d.getElementById('agWfError').hidden && d.getElementById('agWfError').textContent.includes('needs a name'));
  const row = d.querySelector('#agWfStageList .wf-stage-row');
  row.querySelector('input').value = 'plan';
  row.querySelector('textarea').value = 'Load the plan skill and produce docs/plan.md';
  w.wfStageAdd();
  OK('Add stage appends a second row', d.querySelectorAll('#agWfStageList .wf-stage-row').length === 2);
  const row2 = d.querySelectorAll('#agWfStageList .wf-stage-row')[1];
  row2.querySelector('input').value = 'execute';
  row2.querySelector('select').value = 'rewriter-spring-boot-to-quarkus';
  d.getElementById('agWfName').value = 'quarkus-containerize';
  w.wfSave();
  OK('create lands with the stage count derived from the builder rows (2) + the chosen guide',
    w.eval("MOCK_WORKFLOWS.find(w => w.name === 'quarkus-containerize').stages === 2")
    && w.eval("MOCK_WORKFLOWS.find(w => w.name === 'quarkus-containerize').stagesList.length === 2")
    && w.eval("MOCK_WORKFLOWS.find(w => w.name === 'quarkus-containerize').stagesList[1].agent") === 'rewriter-spring-boot-to-quarkus');
  OK('workflow create is audited (workflows:create with the stage count)', w.eval("AUDIT_LOG[0].action === 'workflows:create' && AUDIT_LOG[0].target.includes('2 stages')"));
  OK('the workflow table re-rendered with the new draft row', !!d.querySelector('#agWfBody tr[data-wf="quarkus-containerize"]'));
  OK('the run-create form\u2019s workflow select does NOT list the draft (ready-only, unchanged rule)',
    !w.eval("[...document.getElementById('agWfRunWf').options].some(o => o.text === 'quarkus-containerize')"));

  console.log(fail === 0 ? 'ALL PASS (' + pass + ')' : 'FAILURES: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}, 400);
