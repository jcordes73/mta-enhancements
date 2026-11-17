/* Keycloak authentication — the console is a confidential-surface SPA.
   Realm `mta`, public client `mta-console` (PKCE). The logged-in user's
   realm roles DEFINE the persona (roles-define-persona decision): the mock's
   persona switcher is replaced by the login; demo users exist per persona
   (keycloak/mta-realm.json in hub-backend). The `mta-org` (display name)
   and `team` token claims carry tenancy (#41); `mta-orgs` carries native
   Keycloak-Organizations membership (aliases) as a fallback tenancy source;
   the `mta-scopes` claim (test/automation users) carries extra scopes merged
   by the backend's RoleScopeMapper. */
import Keycloak from 'keycloak-js';
import type { Persona } from '../state/appState';

const KC_URL: string = (import.meta.env.VITE_KEYCLOAK_URL as string | undefined) ?? 'http://localhost:8180';

export const KEYCLOAK = new Keycloak({ url: KC_URL, realm: 'mta', clientId: 'mta-console' });

let initPromise: Promise<void> | null = null;

/** check-sso: the app renders a sign-in screen for anonymous visitors instead of forcing a redirect. */
export function initAuth(): Promise<void> {
  initPromise ??= KEYCLOAK.init({
    onLoad: 'check-sso',
    pkceMethod: 'S256',
    checkLoginIframe: false,
  }).then(() => undefined);
  return initPromise;
}

export function login() {
  void KEYCLOAK.login({ redirectUri: window.location.href });
}

export function logout() {
  KEYCLOAK.logout({ redirectUri: window.location.origin });
}

/** Fresh access token (refreshes when close to expiry); null when signed out. */
export async function token(minValidity = 30): Promise<string | null> {
  if (!KEYCLOAK.authenticated) return null;
  try {
    await KEYCLOAK.updateToken(minValidity);
  } catch {
    return null;
  }
  return KEYCLOAK.token ?? null;
}

export interface AuthUser {
  userName: string;
  persona: Persona;
  /** `mta-org` claim (display name) — null when absent. */
  orgName: string | null;
  /** native Keycloak Organizations membership (`mta-orgs` claim: org
      aliases, e.g. "northwind-financial") — empty when absent. Tenancy
      resolves from aliases when the display-name claim is missing
      (users provisioned via the orgs feature, e.g. olson). */
  orgAliases: string[];
  /** optional `team` claim narrowing the scope (team-locked personas). */
  teamName: string | null;
}

/** Realm-role precedence: the strongest role defines the persona. */
const PERSONA_PRECEDENCE: Persona[] = ['padmin', 'admin', 'architect', 'migrator', 'pgm', 'pm'];

export function authUser(): AuthUser | null {
  const parsed = KEYCLOAK.tokenParsed as {
    preferred_username?: string;
    /** display-name string from the realm user attribute (mapped claim) */
    'mta-org'?: string;
    /** native Keycloak-org memberships (aliases); the built-in `organization`
        claim (array) is Keycloak-native shape — only read as a string fallback */
    organization?: string | string[];
    'mta-orgs'?: string[];
    team?: string;
    realm_access?: { roles?: string[] };
  } | null;
  if (!parsed) return null;
  const roles = parsed.realm_access?.roles ?? [];
  const persona = PERSONA_PRECEDENCE.find(r => roles.includes(r)) ?? 'migrator';
  const legacyOrg = parsed['mta-org'] ?? (typeof parsed.organization === 'string' ? parsed.organization : null);
  return {
    userName: parsed.preferred_username ?? 'user',
    persona,
    orgName: legacyOrg ?? null,
    orgAliases: parsed['mta-orgs'] ?? [],
    teamName: parsed.team ?? null,
  };
}
