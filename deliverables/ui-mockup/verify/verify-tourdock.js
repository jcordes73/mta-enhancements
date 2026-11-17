const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => console.log('RUNTIME ERROR:', e.message));
let pass = 0, fail = 0;
const OK = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); c ? pass++ : fail++; };
setTimeout(() => {
  const d = dom.window.document, w = dom.window;
  const TOURS63_N = w.eval('TOURS.architect.steps.length');
  w.eval("localStorage.setItem('mta.welcome.architect','1'); localStorage.setItem('mta.welcome.admin','1')");

  // boot: no dock without a tour
  OK('no dock at boot', d.getElementById('tourDock').hidden);
  OK('Home tour button hidden when no tour is parked (idle entry removed)', d.getElementById('homeTourWrap').hidden
    && d.getElementById('homeTourLabel').textContent.startsWith('Take the'));

  // open tour, park it via a step CTA (tourOpenView)
  w.openTour(1);   // step 2: pick a step with a view target
  w.tourOpenView();
  const dock = d.getElementById('tourDock');
  OK('CTA navigation minimizes the tour into the dock (guide does not disappear)', !dock.hidden && d.getElementById('tourModal').hidden);
  OK('dock button reads "Next step \u203a" when steps remain', d.getElementById('dockNextLabel').textContent === 'Next step \u203a');
  OK('dock shows the parked step and role', d.getElementById('dockTitle').textContent.includes('Architect tour')
    && d.getElementById('dockStep').textContent.includes('Step 2 of'));
  OK('Home button appears while parked, reading the resume label', !d.getElementById('homeTourWrap').hidden
    && d.getElementById('homeTourLabel').textContent.includes('Resume the Architect tour')
    && d.getElementById('homeTourLabel').textContent.includes('step 2 of'));

  // resume from the dock: modal reopens at the parked step, dock hides
  w.dockResume();
  OK('Resume reopens the modal at the parked step (not step 1)', !d.getElementById('tourModal').hidden && dock.hidden
    && d.getElementById('tourProgress').textContent.includes('Step 2 of'));

  // reopen-from-Home also resumes now (no explicit index)
  w.closeTour();
  w.eval("document.getElementById('homeTourBtn') || document.querySelector('[onclick*=\\'openTour()\\']')").click();
  OK('reopening the tour from Home resumes the parked position', d.getElementById('tourProgress').textContent.includes('Step 2 of'));

  // dock Next advances the step
  w.tourOpenView();          // park again at step 2
  w.dockNext();
  OK('dock Next advances to the next step', d.getElementById('tourProgress').textContent.includes('Step 3 of'));

  // position is per-persona: admin has no parked tour
  w.tourOpenView();          // park architect at step 3
  w.setPersona('admin');
  OK('switching to a role without a parked tour hides the dock', dock.hidden);
  OK('switching back restores the architect position', (() => { w.setPersona('architect'); return dock.hidden === false && d.getElementById('dockStep').textContent.includes('Step 3 of'); })());

  // ✕ dismisses the card but Home still offers resume
  w.dockEnd();
  OK('✕ dismisses the dock, Home still offers Resume', dock.hidden && !d.getElementById('homeTourWrap').hidden
    && d.getElementById('homeTourLabel').textContent.includes('Resume'));

  // finishing the tour clears the position AND checks the last step
  w.dockResume();
  const n = w.eval('TOURS.architect.steps.length');
  w.tourGo(n);               // one past the last step = finish
  OK('finishing the tour clears the parked position (Home button hides again)', dock.hidden
    && d.getElementById('homeTourWrap').hidden && d.getElementById('homeTourLabel').textContent.startsWith('Take the'));
  OK('finishing marks the LAST step as visited (\u2713 in the set)', w.eval("tourVisited.has('architect:' + (TOURS.architect.steps.length - 1))"));
  w.openTour();   // reopen from step 0: the list should render the last step with a check
  const lastLi = [...d.querySelectorAll('#tourList li')].pop();
  OK('reopened tour list shows the last step checked (\u2714, not \u25cb)', lastLi.textContent.includes('\u2714'));
  w.closeTour();
  // dock Next on the last parked step finishes (and checks) instead of just reopening
  w.openTour(n - 1); w.tourOpenView();   // park at the last step
  OK('dock button reads "Finish tour \u2713" when parked at the last step', d.getElementById('dockNextLabel').textContent === 'Finish tour \u2713');
  w.dockNext();
  OK('dock Next on the last step finishes the tour', dock.hidden && d.getElementById('tourModal').hidden
    && w.eval("tourVisited.has('architect:' + (TOURS.architect.steps.length - 1))"));

  // #63: completion persists per persona — only the finish path marks it; the help menu offers a replay
  const lead63 = () => d.getElementById('tourMenuLead')?.textContent;
  w.eval("localStorage.removeItem('mta.tour.architect'); tourLabelApply();");   // isolate from the earlier finish in this suite
  OK('help menu leads with "Guided tour" while not taken', lead63() === 'Guided tour');
  w.openTour(0); w.closeTour();   // ✕-close mid-tour: no completion
  OK('\u2715-closing mid-tour does NOT mark the tour taken', w.eval("localStorage.getItem('mta.tour.architect')") === null);
  w.openTour(TOURS63_N - 1); w.tourGo(TOURS63_N);
  OK('finishing persists mta.tour.<persona> = 1', w.eval("localStorage.getItem('mta.tour.architect')") === '1');
  w.setPersona('pm');
  OK('completion is per persona (pm still leads with "Guided tour")', lead63() === 'Guided tour'
    && w.eval("localStorage.getItem('mta.tour.pm')") === null);
  w.setPersona('architect');
  OK('help menu offers a replay once taken ("Replay the Architect guided tour")', lead63() === 'Replay the Architect guided tour'
    && !!(d.getElementById('tourMenuEmoji')?.querySelector('svg')));   /* row 75: emoji replaced by RHDS icon svg */

  // mid-tour persona switch re-renders at the NEW role's parked position
  w.openTour(0); w.tourOpenView();          // architect parked at step 1
  w.setPersona('admin');
  OK('mid-tour switch resumes the new role at its own position (none → step 1)', d.getElementById('tourProgress').textContent.includes('Step 1 of'));

  console.log(pass + ' passed, ' + fail + ' failed');
}, 700);
