import {AuthError, type AuthPort, type AuthSession, type PublicRegisterRole, type UserRole} from '../types/auth';
import type { CloudIdentityClient } from './firebase-client';

const invalidSessionCodes = new Set([
  'AUTH_REQUIRED', 'AUTH_INVALID', 'UNAUTHENTICATED', 'ACCOUNT_RESTRICTED', 'FORBIDDEN',
  'auth/user-token-expired', 'auth/invalid-user-token', 'auth/user-disabled', 'auth/user-not-found',
]);

/** SDK restores/renews credentials; backend verification remains authoritative for roles. */
export function createCloudAuthService(
  apiBaseUrl: string,
  loadClient: () => Promise<CloudIdentityClient> = async () => (await import('./firebase-client')).getFirebaseClient(),
): AuthPort {
  const base = apiBaseUrl.replace(/\/$/, '');
  let generation = 0;
  let loggedOut = false;
  let authenticating = false;
  let loggingOut = false;
  let accessToken: string | null = null;
  let verifiedUid: string | null = null;
  let clientPromise: Promise<CloudIdentityClient> | undefined;
  function getClient(): Promise<CloudIdentityClient> {
    return clientPromise ??= loadClient().then(client => {
      client.onTokenChanged?.(value => {
        if (!value) { accessToken = null; return; }
        if (!loggedOut && verifiedUid === value.uid) accessToken = value.token;
        else { accessToken = null; }
      });
      return client;
    }).catch(error => { clientPromise = undefined; throw error; });
  }

  async function request<T>(path: string, method: 'GET'|'POST', token: string | null, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${base}/api/v1/auth/${path}`, {
        method,
        headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})},
        ...(body === undefined ? {} : {body: JSON.stringify(body)}),
      });
    } catch { throw new AuthError('AUTH_UNAVAILABLE', 'Cannot connect to the authentication server.'); }
    const result: unknown = await response.json().catch(() => null);
    if (!result || typeof result !== 'object') throw new AuthError('INVALID_RESPONSE', 'Invalid server response.');
    const payload = result as {success?: boolean; data?: T; error?: {code?: string; message?: string; field?: string; recoveryAvailable?: boolean}};
    if (!response.ok || !payload.success || payload.data === undefined) {
      throw new AuthError(payload.error?.code ?? 'AUTH_ERROR', payload.error?.message ?? 'Operation unavailable.', payload.error?.field, payload.error?.recoveryAvailable === true);
    }
    return payload.data;
  }

  function safeSession(value: AuthSession): AuthSession {
    if (!value.user?.id || !['reader', 'publisher', 'moderator'].includes(value.user.role) || !value.authenticatedAt) {
      throw new AuthError('INVALID_RESPONSE', 'The server returned an invalid session.');
    }
    // Do not leak the REST response token through the public session object.
    return {user: value.user, authenticatedAt: value.authenticatedAt};
  }

  async function readSession(forceRefresh = false): Promise<{session: AuthSession; token: string} | null> {
    if (loggedOut) return null;
    const started = generation;
    const client = await getClient();
    try {
      const token = await client.getToken(forceRefresh);
      if (!token) { accessToken = null; verifiedUid = null; return null; }
      if (loggedOut || started !== generation) return null;
      const session = safeSession(await request<AuthSession>(forceRefresh ? 'refresh' : 'session', forceRefresh ? 'POST' : 'GET', token));
      if (loggedOut || started !== generation) return null;
      verifiedUid = session.user.id;
      accessToken = token;
      return {session, token};
    } catch (error) {
      if (started !== generation || loggedOut) return null;
      const code = (error as {code?: string})?.code;
      if (code && invalidSessionCodes.has(code)) {
        generation++;
        loggedOut = true;
        accessToken = null; verifiedUid = null;
        await client.signOut();
        return null;
      }
      // A network/provider failure is not proof of logout. Keep persistence for retry.
      throw error;
    }
  }

  async function authenticate(email: string, password: string, requestedRole?: PublicRegisterRole): Promise<AuthSession> {
    if (authenticating || loggingOut) throw new AuthError('AUTH_BUSY', 'Wait for the current authentication operation.');
    authenticating = true;
    const started = ++generation;
    loggedOut = false;
    try {
      const client = await getClient();
      try {
        if (started !== generation || loggedOut) throw new AuthError('AUTH_INVALID', 'The session was cancelled.');
        // Keep server-side validation, account provisioning and reader-only claims.
        const provisioned = safeSession(await request<AuthSession>(requestedRole === undefined ? 'login' : 'register', 'POST', null,
          {email, password, ...(requestedRole === undefined ? {} : {requestedRole})}));
        await client.signIn(email.trim().toLowerCase(), password);
        if (started !== generation || loggedOut) {
          await client.signOut();
          throw new AuthError('AUTH_INVALID', 'The session was cancelled.');
        }
        const verified = await readSession();
        if (!verified || verified.session.user.id !== provisioned.user.id) throw new AuthError('AUTH_INVALID', 'The session could not be verified.');
        return verified.session;
      } catch (error) {
        if (started === generation) {
          loggedOut = true;
          await client.signOut();
        }
        throw error;
      }
    } finally { authenticating = false; }
  }

  return {
    register: (email, password, requestedRole) => authenticate(email, password, requestedRole),
    login: (email, password) => authenticate(email, password),
    async logout(): Promise<void> {
      if (loggingOut) throw new AuthError('AUTH_BUSY', 'Sign-out is already in progress.');
      loggingOut = true;
      // Invalidate pending reads before the first asynchronous operation.
      generation++;
      loggedOut = true;
      accessToken = null; verifiedUid = null;
      try {
        const client = await getClient();
        try {
          const token = await client.getToken();
          if (token) await request<{loggedOut: boolean}>('logout', 'POST', token);
        } finally { await client.signOut(); }
      } finally { loggingOut = false; }
    },
    async getCurrentSession() { return (await readSession())?.session ?? null; },
    async refreshSession() { return (await readSession(true))?.session ?? null; },
    getAccessToken() { return loggedOut ? null : accessToken; },
    async hasRole(role: UserRole) { return (await readSession())?.session.user.role === role; },
  };
}
