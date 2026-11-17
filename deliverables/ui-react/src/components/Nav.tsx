import { Nav as PfNav, NavList, NavItem } from '@patternfly/react-core';
import { canView, useApp } from '../state/appState';
import { RhIcon } from './RhIcon';

/* RBAC-driven navigation (mock #36 item 2): items derive from the persona's
   views list; the flat order mirrors the mock's nav (no section headers). */
const NAV = [
  { view: 'home', label: 'Home', icon: 'home' },
  { view: 'inventory', label: 'Applications', icon: 'applications' },
  { view: 'incidents', label: 'Incidents', icon: 'warning' },
  { view: 'waves', label: 'Migration waves', icon: 'waveform' },
  { view: 'reports', label: 'Reports', icon: 'pie-chart' },
  { view: 'agentic', label: 'Agentic', icon: 'robot' },
  { view: 'credentials', label: 'Credentials', icon: 'key' },
  /* no "Application import" nav item — the mock's nav has none; the import
     wizard is part of Applications (its Import button) and stays deep-linkable
     via #scr=wizard. The RBAC views list carries 'wizard' for screen-clamp
     purposes only — don't derive nav entries from it. */
  { view: 'tasks', label: 'Task manager', icon: 'task' },
  { view: 'config', label: 'Administration', icon: 'list' },
];

export function Nav() {
  const { state, set } = useApp();
  return (
    <PfNav aria-label="Global">
      <NavList>
        {NAV.filter(n => canView(state.persona, n.view)).map(n => (
          <NavItem
            key={n.view}
            itemId={n.view}
            isActive={state.scr === n.view}
            onClick={() => set({ scr: n.view })}
            to={`#scr=${n.view}`}
            component="a"
          >
            <RhIcon name={n.icon} /> {n.label}
          </NavItem>
        ))}
      </NavList>
    </PfNav>
  );
}
