/* API client — hard dependency on the Quarkus hub-backend, authenticated with
   Keycloak bearer tokens (realm `mta`, see src/api/auth.ts). No header-based
   dev identity: scopes and tenancy come from the token (roles → scopes via
   the backend's hub.role-mapping; organization/team claims). No fallback to
   generated data: when the backend is unreachable the app shows an error
   state with retry (HubProvider owns that surface). */

import { KEYCLOAK, login } from './auth';

const BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface CallOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  ifMatch?: string;
}

export async function api<T>(path: string, opts: CallOpts = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const tok = await token();
  if (tok) headers.Authorization = `Bearer ${tok}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.ifMatch) headers['If-Match'] = opts.ifMatch;

  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network.unreachable',
      'Cannot reach the hub backend — is it running? (dev: mvn quarkus:dev in deliverables/hub-backend)');
  }

  if (res.status === 401) {
    // session expired / token rejected → back to the sign-in screen
    login();
    throw new ApiError(401, 'auth.required', 'Sign-in required — redirecting to Keycloak…');
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? (tryParse(text) as Record<string, unknown>) : undefined;
  if (!res.ok) {
    const code = (data?.code as string) || `http.${res.status}`;
    const msg = (data?.message as string) || res.statusText || 'Request failed';
    throw new ApiError(res.status, code, msg);
  }
  return data as T;
}

/** Fresh access token (refreshes when close to expiry); null when signed out. */
async function token(): Promise<string | null> {
  if (!KEYCLOAK.authenticated) return null;
  try {
    await KEYCLOAK.updateToken(30);
  } catch {
    return null;
  }
  return KEYCLOAK.token ?? null;
}

function tryParse(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

/** Paged response envelope (Responses.pagedResponse). */
export interface Page<T> { items: T[]; totalCount: number; page: number; size: number }

export async function listAll<T>(path: string, opts: CallOpts = {}): Promise<T[]> {
  const sep = path.includes('?') ? '&' : '?';
  const page = await api<Page<T>>(`${path}${sep}size=200`, opts);
  return page.items ?? [];
}
