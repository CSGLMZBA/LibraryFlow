import { AuthError, type AuthPort, type AuthSession, type AuthUser, type PublicRegisterRole, type UserRole } from '../types/auth';
import { normalizeEmail, validateLogin, validateRegistration } from '../schemas/auth-schema';
import { clearSession, getAllUsers, getUser, putUserIfAbsent, readSession, saveSession, type StoredAuthUser } from '../repositories/auth-indexeddb';

async function derive(password: string, salt: Uint8Array): Promise<number[]> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), {name:'PBKDF2'}, false, ['deriveBits']);
  const bytes = await crypto.subtle.deriveBits({name:'PBKDF2', salt: new Uint8Array(salt), iterations: 210000, hash:'SHA-256'}, key, 256);
  return [...new Uint8Array(bytes)];
}
function equalBytes(a: number[], b: number[]): boolean {
  if(a.length!==b.length) return false;
  let mismatch=0; for(let i=0;i<a.length;i++) mismatch|=a[i]^b[i]; return mismatch===0;
}
function publicUser(stored: StoredAuthUser): AuthUser {
  const { id,email,displayName,role,createdAt }=stored; return {id,email,displayName,role,createdAt};
}
function isSession(value: unknown): value is AuthSession {
  if (!value || typeof value!=='object') return false;
  const v=value as Partial<AuthSession>;
  if (!v.user || typeof v.user!=='object') return false;
  return typeof v.user.id==='string' && typeof v.user.email==='string' &&
    (v.user.role==='reader'||v.user.role==='publisher'||v.user.role==='moderator') && typeof v.authenticatedAt==='string';
}
export const localAuthService: AuthPort = {
  async register(rawEmail: string, password: string, role: PublicRegisterRole): Promise<AuthSession> {
    const email=normalizeEmail(rawEmail);
    validateRegistration(email,password,role);
    const users=await getAllUsers();
    if (users.some(user=>user.email===email)) throw new AuthError('EMAIL_ALREADY_EXISTS','Este correo ya est├í registrado.','email');
    const base=email.split('@')[0];
    let displayName='';
    for(let i=0;i<10000;i++) {
      const suffix=String(crypto.getRandomValues(new Uint32Array(1))[0] % 9000 + 1000);
      const candidate=`${base}${suffix}`;
      if(!users.some(u=>u.displayName.toLowerCase()===candidate.toLowerCase())) { displayName=candidate; break; }
    }
    if (!displayName) throw new AuthError('NAME_UNAVAILABLE','No fue posible generar un nombre de usuario ├║nico.');
    const salt=crypto.getRandomValues(new Uint8Array(16));
    const user: StoredAuthUser={id:crypto.randomUUID(),email,displayName,role,createdAt:new Date().toISOString(),salt:[...salt],passwordHash:await derive(password,salt)};
    try {await putUserIfAbsent(user);} catch(error) {
      if (await getUser(email)) throw new AuthError('EMAIL_ALREADY_EXISTS','Este correo ya est├í registrado.','email');
      throw error;
    }
    const session: AuthSession={user:publicUser(user),authenticatedAt:new Date().toISOString()};
    await saveSession(session);
    return session;
  },
  async login(rawEmail:string,password:string):Promise<AuthSession> {
    const email=normalizeEmail(rawEmail);
    validateLogin(email,password);
    const stored=await getUser(email);
    const error=new AuthError('INVALID_CREDENTIALS','Correo o contrase├▒a incorrectos.');
    if(!stored) throw error;
    if (!Array.isArray(stored.salt) || stored.salt.length!==16 || !Array.isArray(stored.passwordHash) || stored.passwordHash.length!==32) {
      throw new AuthError('CORRUPT_USER', 'El registro de usuario est├í da├▒ado; no se puede iniciar sesi├│n.');
    }
    const computed=await derive(password,new Uint8Array(stored.salt));
    if(!equalBytes(computed,stored.passwordHash)) throw error;
    const session:AuthSession={user:publicUser(stored),authenticatedAt:new Date().toISOString()};
    await saveSession(session);
    return session;
  },
  async logout():Promise<void> {await clearSession();},
  async getCurrentSession():Promise<AuthSession|null> {
    const session=await readSession();
    if (!session) return null;
    if(!isSession(session)) {await clearSession();throw new AuthError('CORRUPT_SESSION','La sesi├│n local no es v├ílida.');}
    const stored=await getUser(session.user.email);
    if (!stored || stored.id!==session.user.id || stored.role!==session.user.role || !['reader','publisher','moderator'].includes(stored.role)) {await clearSession();return null;}
    return {user:publicUser(stored),authenticatedAt:session.authenticatedAt};
  },
  async hasRole(role:UserRole):Promise<boolean> {return (await this.getCurrentSession())?.user.role===role;}
};
/** Cloud adapter must be configured by the platform team with Firebase verification and REST API.
 * Local IndexedDB identity is NEVER a server-side authorization credential. */
export function requireLocalRole(session:AuthSession|null,role:UserRole):void {
  if(!session) throw new AuthError('UNAUTHENTICATED','Debes iniciar sesi├│n.');
  if(session.user.role!==role) throw new AuthError('FORBIDDEN','No tienes autorizaci├│n para esta funci├│n.');
}

/** Sprint 1 Moderator fixture. Explicit setup, only bundled in Vite development. */
export async function seedLocalModeratorForTests(password: string): Promise<AuthUser> {
  if ((import.meta as ImportMeta & {env?: {DEV?: boolean}}).env?.DEV !== true) throw new AuthError('FORBIDDEN', 'Solo disponible en modo desarrollo.');
  const email = 'moderator@libraryflow.local';
  // Reuse the already-approved credential rules without granting registration privileges.
  validateRegistration(email, password, 'reader');
  const existing = await getUser(email);
  if (existing) {
    if (existing.role !== 'moderator') throw new AuthError('SEED_CONFLICT', 'Correo de prueba ocupado.');
    return publicUser(existing);
  }
  const users = await getAllUsers();
  let displayName = '';
  for (let suffix = 1000; suffix <= 9999; suffix++) {
    const proposed = `moderator${suffix}`;
    if (!users.some(user => user.displayName.toLowerCase() === proposed.toLowerCase())) {
      displayName = proposed;
      break;
    }
  }
  if (!displayName) throw new AuthError('NAME_UNAVAILABLE', 'No hay nombre de prueba disponible.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const user: StoredAuthUser = {
    id:crypto.randomUUID(), email, displayName, role:'moderator',
    createdAt:new Date().toISOString(), salt:[...salt], passwordHash:await derive(password,salt)
  };
  try {await putUserIfAbsent(user);} catch {
    const stored = await getUser(email);
    if (stored?.role === 'moderator') return publicUser(stored);
    throw new AuthError('SEED_CONFLICT', 'No se pudo preparar el moderador.');
  }
  return publicUser(user);
}

// UI compatibility facade: the existing screens can keep their result shape
// while the underlying credential store remains the IndexedDB/PBKDF2 service.
import type { AuthResult, RegisterRole, AuthValidationErrors } from '../types/auth';

function uiAuthError(error: unknown): AuthResult<never> {
  if (error instanceof AuthError) {
    const field = error.field === 'requestedRole' ? 'role' : error.field;
    const supported: (keyof AuthValidationErrors)[] = ['email', 'password', 'role', 'general'];
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(supported.includes(field as keyof AuthValidationErrors)
          ? { field: field as keyof AuthValidationErrors }
          : { field: 'general' as const }),
      },
    };
  }
  return {
    success: false,
    error: { code: 'AUTH_UNAVAILABLE', message: 'Authentication is temporarily unavailable.', field: 'general' },
  };
}

export const authService = {
  async register(email: string, password: string, requestedRole: RegisterRole): Promise<AuthResult<AuthUser>> {
    try {
      const session = await localAuthService.register(email, password, requestedRole);
      // AuthPage invites the user to log in after registration.
      await localAuthService.logout();
      return { success: true, data: session.user, message: 'Registration successful. You can now log in.' };
    } catch (error) {
      return uiAuthError(error);
    }
  },
  async login(email: string, password: string): Promise<AuthResult<AuthSession>> {
    try {
      return { success: true, data: await localAuthService.login(email, password) };
    } catch (error) {
      return uiAuthError(error);
    }
  },
  logout: () => localAuthService.logout(),
  getCurrentSession: () => localAuthService.getCurrentSession(),
  hasRole: (role: UserRole) => localAuthService.hasRole(role),
};