import {AuthError, type AuthPort, type AuthSession, type PublicRegisterRole, type UserRole} from '../types/auth';

/** Cloud adapter: delegates credentials and authorization to LibraryFlow REST/Firebase.
 * The token is deliberately held in memory, never in localStorage or a URL.
 * Page reload requires login again until the team integrates Firebase SDK token persistence.
 */
export function createCloudAuthService(apiBaseUrl: string): AuthPort {
  let current: AuthSession | null = null;
  let token: string | null = null;
  const base = apiBaseUrl.replace(/\/$/, '');
  async function request<T>(path: string, method: 'GET'|'POST', body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${base}/api/v1/auth/${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? {Authorization: `Bearer ${token}`} : {}),
        },
        ...(body === undefined ? {} : {body:JSON.stringify(body)})
      });
    } catch {throw new AuthError('AUTH_UNAVAILABLE', 'No hay conexión con el servidor de autenticación.');}
    const result: unknown = await response.json().catch(() => null);
    if (!result || typeof result !== 'object') throw new AuthError('INVALID_RESPONSE', 'Respuesta inválida del servidor.');
    const payload = result as {success?: boolean; data?: T; error?: {code?: string; message?: string; field?: string}};
    if (!response.ok || !payload.success || payload.data === undefined) {
      throw new AuthError(payload.error?.code ?? 'AUTH_ERROR', payload.error?.message ?? 'Operación no disponible.', payload.error?.field);
    }
    return payload.data;
  }
  function setSession(value: AuthSession & {token?: string}): AuthSession {
    if (!value.token || !value.user?.id) throw new AuthError('INVALID_RESPONSE', 'Falta el token de sesión.');
    token = value.token;
    const {token: _secret, ...safeSession} = value;
    current = safeSession;
    return safeSession;
  }
  return {
    async register(email: string, password: string, requestedRole: PublicRegisterRole): Promise<AuthSession> {
      return setSession(await request<AuthSession & {token: string}>('register','POST',{email,password,requestedRole}));
    },
    async login(email: string, password: string): Promise<AuthSession> {
      return setSession(await request<AuthSession & {token: string}>('login','POST',{email,password}));
    },
    async logout(): Promise<void> {
      try {if (token) await request<{loggedOut: boolean}>('logout','POST');}
      finally {token = null; current = null;}
    },
    async getCurrentSession(): Promise<AuthSession | null> {
      if (!token) return null;
      try {const verified = await request<AuthSession & {token?: string}>('session','GET'); current = {user:verified.user, authenticatedAt:verified.authenticatedAt};return current;}
      catch {token=null;current=null;return null;}
    },
    async hasRole(role: UserRole): Promise<boolean> {
      const session = await this.getCurrentSession();
      return session?.user.role === role;
    }
  };
}
