import { Shell } from './components/Shell';
import { useApp } from './state/appState';
import { HubProvider } from './api/hub';
import { AppProvider } from './state/appState';
import { KEYCLOAK, initAuth, login } from './api/auth';
import { useEffect, useState } from 'react';
import { Button } from '@patternfly/react-core';
import { Home } from './screens/Home';
import { Inventory } from './screens/Inventory';
import { Incidents } from './screens/Incidents';
import { Waves } from './screens/Waves';
import { Reports } from './screens/Reports';
import { Agentic } from './screens/Agentic';
import { Credentials } from './screens/Credentials';
import { Tasks } from './screens/Tasks';
import { Wizard } from './screens/Wizard';
import { Config } from './screens/Config';
import { Card, CardBody, Title, Content, ContentVariants } from '@patternfly/react-core';
import { canView } from './state/appState';
import { initI18n } from './i18n/i18n';

/* Hash router: #scr=<view> — the mock's deep-link grammar, preserved.
   Screens not yet ported render an honest placeholder (see MIGRATION.md). */
export function Router() {
  const { state } = useApp();
  const view = canView(state.persona, state.scr) ? state.scr : 'home';
  switch (view) {
    case 'home': return <Home />;
    case 'inventory': return <Inventory />;
    case 'incidents': return <Incidents />;
    case 'waves': return <Waves />;
    case 'reports': return <Reports />;
    case 'agentic': return <Agentic />;
    case 'credentials': return <Credentials />;
    case 'tasks': return <Tasks />;
    case 'wizard': return <Wizard />;
    case 'config': return <Config />;
    default: return <Placeholder view={view} />;
  }
}

function Placeholder({ view }: { view: string }) {
  const names: Record<string, string> = {
    incidents: 'Incidents', waves: 'Migration waves', reports: 'Reports',
    agentic: 'Agentic', credentials: 'Credentials', wizard: 'Application import',
    tasks: 'Task manager', config: 'Administration',
  };
  return (
    <Card>
      <CardBody>
        <Title headingLevel="h1" size="2xl">{names[view] ?? view}</Title>
        <Content component={ContentVariants.p}>
          This screen is on the React migration checklist but not yet ported —
          the HTML mock (<code>ui-mockup/index.html</code>) carries the full,
          verified implementation. See <code>ui-react/MIGRATION.md</code>.
        </Content>
      </CardBody>
    </Card>
  );
}

export default function App() {
  /* Auth gate first (check-sso): anonymous visitors get the sign-in screen;
     authenticated users get hub data + the console. Provider order matters:
     HubProvider wraps AppProvider so tenancy is installed before the hash
     router derives its initial state (hard API dependency: unreachable
     backend ⇒ error state with retry, no mock fallback). */
  const [authState, setAuthState] = useState<'pending' | 'in' | 'out'>('pending');

  useEffect(() => {
    void initAuth().then(() => setAuthState(KEYCLOAK.authenticated ? 'in' : 'out'));
    /* the mock's i18n DOM layer — boots once, observes React's renders */
    initI18n();
  }, []);

  if (authState === 'pending') {
    return (
      <Centered>
        <Title headingLevel="h1" size="xl">Checking sign-in…</Title>
      </Centered>
    );
  }
  if (authState === 'out') {
    return <SignIn />;
  }
  return (
    <HubProvider>
      <AppProvider>
        <Shell>
          <Router />
        </Shell>
      </AppProvider>
    </HubProvider>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ margin: 'var(--rh-space-6xl) auto', maxWidth: 480, textAlign: 'center' }}>
      {children}
    </div>
  );
}

function SignIn() {
  return (
    <Centered>
      <Title headingLevel="h1" size="2xl">Migration Toolkit for Applications</Title>
      <Content component={ContentVariants.p} style={{ margin: 'var(--rh-space-md) 0 var(--rh-space-lg)' }}>
        Sign in with your Red Hat SSO (Keycloak, realm <code>mta</code>) to open the
        console. Your realm role defines your workspace (architect, migrator, pm, pgm,
        admin, platform admin) and your token's organization claim scopes your view (#41).
      </Content>
      <Button variant="primary" onClick={() => login()}>Sign in</Button>
    </Centered>
  );
}
