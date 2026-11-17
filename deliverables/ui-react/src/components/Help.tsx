/* #43 in-console help system — verbatim port of the mock's masthead help menu,
   persona-specific guided tour (modal + minimized dock), first-run role welcome,
   and the About modal. Tour content is the mock's TOURS data with the .anno-cite
   citation spans stripped (the React port renders no (#N) suggestion refs — the
   annotation system is tracked separately in MIGRATION.md). */
import { useEffect, useState } from 'react';
import {
  Modal, ModalHeader, ModalBody, ModalFooter, Button, Dropdown, DropdownList,
  DropdownItem, DropdownGroup, MenuToggle,
} from '@patternfly/react-core';
import { QuestionCircleIcon } from '@patternfly/react-icons';
import type { Persona } from '../state/appState';
import { authUser } from '../api/auth';
import { RhIcon } from './RhIcon';

const ROLE_NAMES: Record<Persona, string> = {
  architect: 'an Architect', pm: 'a Project manager', pgm: 'a Program manager',
  migrator: 'a Migrator', admin: 'an Administrator', padmin: 'a Platform administrator',
};
const VIEW_NAMES: Record<string, string> = {
  home: 'Home', inventory: 'Applications', incidents: 'Incidents', waves: 'Migration waves',
  reports: 'Reports', agentic: 'Agentic', credentials: 'Credentials',
  config: 'the Administration hub', tasks: 'the Task manager',
};

interface TourStep { view: string; sub?: string; title: string; why: string; do: string[] }
const TOURS: Record<Persona, { q: string; steps: TourStep[] }> = {
  architect: {
    q: '"Where is the portfolio hurting?"',
    steps: [
      { view: 'home', title: 'Portfolio health at a glance', why: 'Your landing answers the first question before you click anything: effort rollup, combined risk and analysis coverage, plus waves at risk.', do: ['Skim the KPI cards — effort, risk, coverage', 'In "Where the portfolio hurts", click the Claims row — it opens Applications pre-filtered to that business service'] },
      { view: 'inventory', title: 'Applications — the inventory', why: 'The single store of record: filter by risk or analysis state, sort by effort, and open any application for its eight-tab detail view.', do: ['Filter by Risk: High, then clear the filter', 'Click an application row — the detail modal carries Queue analysis, run comparison, incidents and dependencies'] },
      { view: 'reports', title: 'Reports — the rollups', why: 'Cross-portfolio aggregates: effort by business service, assessment/analysis risk provenance, and agent-run token & cost accounting.', do: ['Open the portfolio rollup tab', 'Check the token-accounting columns on the agent-runs rollup'] },
      { view: 'waves', title: 'Migration waves — planning & gates', why: 'Wave composition with gates and a timeline: per-wave analysis/risk/effort aggregates update live as members change.', do: ['Review Wave 3\u2019s gate state and planned-vs-actual', 'Open a wave to see its members\u2019 aggregates'] },
      { view: 'agentic', sub: 'agents', title: 'Agentic — the migration factory', why: 'Agents, skills and workflows: run records carry cost, gateway and model stamps so factory spend is attributable.', do: ['Scan the agents list and its gateway bindings', 'Open an agent run to see token/cost accounting'] },
    ],
  },
  pm: {
    q: '"Are the waves on track?"',
    steps: [
      { view: 'home', title: 'Your landing — wave status first', why: 'The PM landing leads with the wave timeline and what is at risk.', do: ['Note the at-risk count, then jump into waves'] },
      { view: 'waves', title: 'Migration waves — timeline & gates', why: 'Planned vs actual per wave, gate states, and live per-wave effort/risk aggregates as members move.', do: ['Check Wave 3\u2019s gate and member progress', 'Use the timeline to spot waves behind plan'] },
      { view: 'reports', title: 'Reports — effort & progress', why: 'Effort rollup by business service and wave execution rollups — the numbers to bring to the program review.', do: ['Open the effort rollup and sort by points'] },
      { view: 'inventory', title: 'Applications — drill into members', why: 'Every wave member\u2019s analysis state, effort and risk in one table; the detail modal has the full story.', do: ['Filter to Wave 3 and scan analysis states'] },
    ],
  },
  pgm: {
    q: '"Are the teams\u2019 waves coordinated?"',
    steps: [
      { view: 'home', title: 'Your landing — cross-team coordination first', why: 'The program landing aggregates across teams: teams in scope, waves that span more than one team, shared blockers.', do: ['Read the cross-team wave composition card', 'Open the full view in Migration waves'] },
      { view: 'waves', title: 'Migration waves — cross-team composition', why: 'The coordination card lists each wave\u2019s contributing teams and flags waves that span teams — the change-window conversations a program manager owns.', do: ['Check which waves are flagged Cross-team', 'Note the quota blocker and the team it hits'] },
      { view: 'reports', title: 'Reports — the program rollup', why: 'Effort and provenance aggregates across the scoped teams — the numbers to bring to the program review.', do: ['Open the portfolio rollup tab', 'Compare effort across business services'] },
      { view: 'tasks', title: 'Task manager — shared platform work', why: 'Quota blocks and platform tasks hit several teams at once; the queue is the escalation surface.', do: ['Scan the queue-health header for aging and causes'] },
    ],
  },
  padmin: {
    q: '"Which organizations need attention?"',
    steps: [
      { view: 'home', title: 'Your landing — the tenant portfolio', why: 'The Home board answers the first question directly: tenancy footprint KPIs, a per-organization status row with an attention verdict, and the audit trail up front.', do: ['Read the two organizations\u2019 attention verdicts', 'Follow the audit-trail link'] },
      { view: 'config', sub: 'controls', title: 'Organizations & the audit trail', why: 'You operate above the tenancy model: provision organizations here, and every cross-organization access is audit-logged.', do: ['Open the Organizations sub-tab', 'Review the audit trail entries'] },
      { view: 'waves', title: 'Cross-organization reads are deliberate', why: 'Switching organization works for you alone — and is recorded each time. Use it to check tenant health, not to do tenant work.', do: ['Switch organization via the masthead switcher', 'Watch the audit trail gain a tenant:access entry'] },
      { view: 'inventory', title: 'Tenant data stays isolated', why: 'Rows, waves, and aggregates always reflect the current organization — the isolation invariant holds for operators too.', do: ['Note the data-scope note naming the organization'] },
    ],
  },
  migrator: {
    q: '"What is assigned to me?"',
    steps: [
      { view: 'home', title: 'Your landing — your work first', why: 'The Migrator landing lists your assignments — no portfolio noise.', do: ['Jump from a task straight into its application'] },
      { view: 'incidents', title: 'Incidents — the triage queue', why: 'Your daily work surface: triage with writable states (confirmed / false positive / not an issue); Insights keeps informational findings out of the queue.', do: ['Triage one incident in the queue', 'Switch to the Insights tab and see why those are not incidents'] },
      { view: 'inventory', title: 'Applications — context for your work', why: 'Open the application behind an incident: related incidents, tasks, and the Assess questionnaire with archetype-inherited answers.', do: ['Open an app → Related incidents tab', 'Try the Assess action'] },
      { view: 'agentic', sub: 'agentruns', title: 'Agentic — let the factory run', why: 'Agent runs show what was changed, with token/cost stamps and failure reasons instead of silent gaps.', do: ['Open a run record and read its stage timeline'] },
    ],
  },
  admin: {
    q: '"Is my organization\u2019s migration on track?"',
    steps: [
      { view: 'home', title: 'Your landing — organization health', why: 'Your organization\u2019s numbers up front: applications, wave coverage, incidents, agent spend, expiring credentials — all org-scoped, the same clamp you are locked to.', do: ['Read the Organization status list', 'Follow "open Waves" to the failing gate'] },
      { view: 'tasks', title: 'Task manager — queue health', why: 'The queue-health header: aging, cause-grouped failures with structured diagnostics, quota state, live bulk selection.', do: ['Read the aging indicator', 'Bulk-select finished tasks and use Delete finished'] },
      { view: 'config', sub: 'access', title: 'Administration hub — one hub, six sections', why: 'Access & tokens, questionnaire authoring, the platform settings manifest, Controls (stakeholders, services, tags), Registries (platforms/targets/identities) and Automation.', do: ['Walk the hub tabs', 'In Automation, review the gateway showback and MCP configuration'] },
      { view: 'credentials', title: 'Credentials — team-owned trust surfaces', why: 'Credential health; credentials are owned by exactly one team and scoped like applications.', do: ['Check the least-recently-used credentials', 'Review the expiring ones before the next wave'] },
      { view: 'agentic', sub: 'agents', title: 'Agentic — registry curation', why: 'Approve/reject agent registrations as audited mutations; skills and workflows are curated the same way.', do: ['Open a pending registration request'] },
    ],
  },
};

const lsGet = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
const bareRole = (p: Persona) => ROLE_NAMES[p].replace(/^an? /, '');

export function HelpSuite() {
  const me = authUser();
  const persona: Persona = me?.persona ?? 'architect';
  const [helpOpen, setHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [tourIdx, setTourIdx] = useState<number | null>(null);   // null = tour closed
  const [parked, setParked] = useState<number | null>(null);     // the dock's step (survives navigation)
  const [dockDismissed, setDockDismissed] = useState(false);
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [taken, setTaken] = useState(lsGet('mta.tour.' + persona) === '1');

  const tour = TOURS[persona];

  /* first-run welcome (the mock's boot rule): fires only with no deep-link hash —
     a deep link is shared context, not a first login. Persona is token-bound here,
     so the mock's per-persona-switch trigger collapses to one mount check. */
  useEffect(() => {
    if (location.hash) return;
    if (lsGet('mta.welcome.' + persona) === '1') return;
    setWelcomeOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* mark the shown step visited (the mock's tourRender side effect) */
  useEffect(() => {
    if (tourIdx == null) return;
    setVisited((prev) => {
      const k = persona + ':' + tourIdx;
      if (prev.has(k)) return prev;
      const next = new Set(prev); next.add(k); return next;
    });
  }, [tourIdx, persona]);

  const openTour = (idx?: number) => {
    const start = (typeof idx === 'number' && idx >= 0) ? idx : (parked ?? 0);
    setParked(null);
    setTourIdx(Math.min(start, tour.steps.length - 1));
  };
  const closeTour = () => setTourIdx(null);
  const finishTour = () => {
    setVisited((prev) => { const n = new Set(prev); n.add(persona + ':' + (tour.steps.length - 1)); return n; });
    lsSet('mta.tour.' + persona, '1');
    setTaken(true);
    setParked(null);
    setTourIdx(null);
  };
  const tourGo = (i: number) => {
    if (i < 0) return;
    if (i >= tour.steps.length) { finishTour(); return; }
    setTourIdx(i);
  };
  /* the tour sent you somewhere: park the position, minimize to the dock */
  const tourOpenView = () => {
    if (tourIdx == null) return;
    const st = tour.steps[tourIdx];
    setParked(tourIdx);
    setDockDismissed(false);
    setTourIdx(null);
    const h = '#scr=' + st.view + (st.sub ? '&tab=' + st.sub : '');
    if (location.hash !== h) location.hash = h;
  };

  const step = tourIdx != null ? tour.steps[tourIdx] : null;
  const visitedCount = [...visited].filter((k) => k.startsWith(persona + ':')).length;

  return (
    <>
      {/* #43 help menu-toggle — label flips to a replay offer once the role's tour was completed */}
      <Dropdown
        isOpen={helpOpen}
        onOpenChange={setHelpOpen}
        popperProps={{ position: 'end' }}   /* right-aligned, or the menu clips at the viewport edge */
        toggle={(toggleRef) => (
          <MenuToggle ref={toggleRef} variant="plain" isExpanded={helpOpen}
            onClick={() => setHelpOpen(!helpOpen)}
            aria-label="Help">
            <QuestionCircleIcon />
          </MenuToggle>
        )}
      >
        <DropdownList>
          <DropdownGroup label="Help">
            <DropdownItem key="tour" onClick={() => { setHelpOpen(false); openTour(); }}>
              <RhIcon name={taken ? 'refresh' : 'target'} />{' '}
              {taken ? <>Replay the {bareRole(persona)} guided tour</> : 'Guided tour'}
            </DropdownItem>
            <DropdownItem key="welcome" onClick={() => { setHelpOpen(false); setWelcomeOpen(true); }}>
              <RhIcon name="refresh" /> Replay the role welcome
            </DropdownItem>
            <DropdownItem key="docs" href="https://docs.redhat.com/en/documentation/migration_toolkit_for_applications" onClick={() => setHelpOpen(false)}>
              <RhIcon name="book-closed" /> Product documentation
            </DropdownItem>
            <DropdownItem key="support" href="https://access.redhat.com/support/cases/#/case/new" onClick={() => setHelpOpen(false)}>
              <RhIcon name="support" /> Support and feedback
            </DropdownItem>
            <DropdownItem key="release" href="https://docs.redhat.com/en/documentation/migration_toolkit_for_applications/8.3/html/release_notes/index" onClick={() => setHelpOpen(false)}>
              <RhIcon name="document" /> Release notes
            </DropdownItem>
            <DropdownItem key="about" onClick={() => { setHelpOpen(false); setAboutOpen(true); }}>
              ℹ️ About
            </DropdownItem>
          </DropdownGroup>
        </DropdownList>
      </Dropdown>

      {/* ---- guided tour modal ---- */}
      <Modal variant="large" isOpen={tourIdx != null} onClose={closeTour} aria-label="Guided tour">
        <ModalHeader
          title={<>Guided tour — working with MTA as {ROLE_NAMES[persona]}</>}
          labelId="tour-title"
          description={<>Your first question: <b>{tour.q}</b></>}
        />
        <ModalBody>
          <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 'var(--rh-space-lg)' }}>
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--rh-space-xs)' }}>
              {tour.steps.map((st, i) => {
                const cur = i === tourIdx, done = visited.has(persona + ':' + i);
                return (
                  <li key={i}>
                    <button type="button" onClick={() => tourGo(i)}
                      style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 'var(--rh-space-md)', alignItems: 'baseline', padding: 'var(--rh-space-md)', borderRadius: 'var(--pf-t--global--border--radius--small)', width: '100%', boxSizing: 'border-box', fontSize: 'var(--rh-font-size-body-text-sm)', ...(cur ? { background: 'var(--pf-t--global--color--brand--default)', color: 'var(--pf-t--color--white)' } : {}) }}>
                      <span aria-hidden="true">{done && !cur ? '✔' : cur ? '▸' : '○'}</span>
                      <span>{st.title}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {step && (
              <div>
                <h3 style={{ marginTop: 0, fontSize: 'var(--rh-font-size-body-text-md)' }}>{(tourIdx ?? 0) + 1}. {step.title}</h3>
                <p style={{ marginTop: 0, fontSize: 'var(--rh-font-size-body-text-sm)' }}>{step.why}</p>
                <div style={{ fontSize: 'var(--rh-font-size-body-text-sm)' }}>
                  <b>Try this:</b>
                  <ul style={{ margin: 'var(--rh-space-md) 0 0', paddingLeft: 'var(--rh-space-lg)' }}>
                    {step.do.map((d, i) => <li key={i} style={{ marginBottom: 'var(--rh-space-xs)' }}>{d}</li>)}
                  </ul>
                </div>
                <Button variant="primary" style={{ marginTop: 'var(--rh-space-md)' }} onClick={tourOpenView}>
                  Open {VIEW_NAMES[step.view]}
                </Button>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <Button variant="secondary" isDisabled={tourIdx === 0} onClick={() => tourGo((tourIdx ?? 0) - 1)}>Back</Button>
            <Button variant="primary" style={{ marginInlineStart: 'var(--rh-space-md)' }} onClick={() => tourGo((tourIdx ?? 0) + 1)}>
              {tourIdx === tour.steps.length - 1 ? 'Finish' : 'Next'}
            </Button>
            <Button variant="link" style={{ marginInlineStart: 'var(--rh-space-md)' }} onClick={closeTour}>Skip tour</Button>
            <span style={{ marginInlineStart: 'auto', fontSize: 'var(--rh-font-size-body-text-xs)', color: 'var(--pf-t--global--text--color--subtle)' }}>
              Step {(tourIdx ?? 0) + 1} of {tour.steps.length}{visitedCount > 1 ? ' · ' + visitedCount + ' visited' : ''}
            </span>
          </div>
        </ModalFooter>
      </Modal>

      {/* ---- the dock: the minimized tour that survives step-to-page navigation ---- */}
      {parked != null && tourIdx == null && !dockDismissed && (
        <div className="tour-dock">
          <div className="pf-v6-c-card pf-m-compact" style={{ maxWidth: 340, boxShadow: 'var(--rh-box-shadow-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--rh-space-md)', padding: 'var(--rh-space-lg) var(--rh-space-lg) var(--rh-space-md)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--rh-font-size-body-text-xs)', fontWeight: 600 }}>🎯 {bareRole(persona)} tour</div>
                <div className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)', marginTop: 'var(--rh-space-xs)' }}>
                  Step {parked + 1} of {tour.steps.length} — {tour.steps[parked]?.title}
                </div>
              </div>
              <Button variant="plain" size="sm" aria-label="Dismiss the tour dock" onClick={() => setDockDismissed(true)}>✕</Button>
            </div>
            <div style={{ display: 'flex', gap: 'var(--rh-space-md)', padding: 'var(--rh-space-xs) var(--rh-space-lg) var(--rh-space-lg)' }}>
              <Button variant="primary" size="sm" onClick={() => openTour(parked)}>Resume tour</Button>
              <Button variant="secondary" size="sm" onClick={() => (parked + 1 >= tour.steps.length ? finishTour() : openTour(parked + 1))}>
                {parked + 1 >= tour.steps.length ? 'Finish tour ✓' : 'Next step ›'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ---- first-run role welcome (Help can replay it anytime) ---- */}
      <Modal variant="small" isOpen={welcomeOpen} onClose={() => setWelcomeOpen(false)} aria-labelledby="welcome-title">
        <ModalHeader
          title="Welcome to the Migration Toolkit console"
          labelId="welcome-title"
          description={<>You are signed in as <b>{ROLE_NAMES[persona]}</b>.</>}
        />
        <ModalBody>
          <p style={{ marginTop: 0, fontSize: 'var(--rh-font-size-body-text-sm)' }}>Your first question: <b>{tour.q}</b></p>
          <p style={{ margin: 0, fontSize: 'var(--rh-font-size-body-text-sm)' }}>
            The Home landing answers it for your scope, and every number on it derives from the live hub data.
            A short guided tour walks your role through the views that matter — you can replay it anytime from <b>Help → Guided tour</b>.
          </p>
        </ModalBody>
        <ModalFooter>
          {/* both actions persist the seen-state; ✕ merely closes (the mock's welcomeStart/welcomeSkip) */}
          <Button variant="primary" onClick={() => { lsSet('mta.welcome.' + persona, '1'); setWelcomeOpen(false); openTour(0); }}>
            Start the {bareRole(persona)} tour
          </Button>
          <Button variant="secondary" onClick={() => { lsSet('mta.welcome.' + persona, '1'); setWelcomeOpen(false); }}>
            Skip — don&apos;t show again
          </Button>
        </ModalFooter>
      </Modal>

      {/* ---- About (adapted: live-API console, no workspace-relative doc links) ---- */}
      <Modal variant="small" isOpen={aboutOpen} onClose={() => setAboutOpen(false)} aria-label="About this console">
        <ModalHeader
          title="About this console"
          labelId="about-title"
          description="Migration Toolkit for Applications — console UI (PatternFly 6 React port of the UX mockup)"
        />
        <ModalBody>
          <table style={{ borderCollapse: 'collapse', fontSize: 'var(--rh-font-size-body-text-sm)' }}><tbody>
            <tr><td className="u-muted" style={{ padding: 'var(--rh-space-xs) var(--rh-space-lg) var(--rh-space-xs) 0', whiteSpace: 'nowrap' }}>Build</td><td style={{ padding: 'var(--rh-space-xs) 0' }}>2026-11-16 — UI states are synthetic, data comes live from the hub backend</td></tr>
            <tr><td className="u-muted" style={{ padding: 'var(--rh-space-xs) 0' }}>Rendering</td><td style={{ padding: 'var(--rh-space-xs) 0' }}>real <b>PatternFly 6</b> React components (v6.7.0), PF6 blue brand as shipped in the MTA console</td></tr>
            <tr><td className="u-muted" style={{ padding: 'var(--rh-space-xs) 0' }}>Auth</td><td style={{ padding: 'var(--rh-space-xs) 0' }}>Keycloak (realm <b>mta</b>) — your realm role is the persona</td></tr>
          </tbody></table>
          <div style={{ marginTop: 'var(--rh-space-lg)', fontWeight: 600 }}>Documents</div>
          <ul style={{ margin: 'var(--rh-space-md) 0 0', paddingLeft: 'var(--rh-space-lg)', fontSize: 'var(--rh-font-size-body-text-sm)' }}>
            <li><a href="https://docs.redhat.com/en/documentation/migration_toolkit_for_applications">Upstream product documentation</a></li>
            <li><a href="https://github.com/konveyor">Konveyor project on GitHub</a> (upstream of MTA)</li>
          </ul>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={() => setAboutOpen(false)}>Close</Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
