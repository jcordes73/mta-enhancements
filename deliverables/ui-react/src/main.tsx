import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@patternfly/react-core/dist/styles/base.css';
import './index.css';
import App from './App';

/* App owns the provider chain (auth gate → HubProvider → AppProvider):
   the Keycloak check-sso runs BEFORE the hub loads and BEFORE AppProvider
   derives its initial hash state, so tenancy is installed from the token
   before anything renders. */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
