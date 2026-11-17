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
    if (users.some(user=>user.email===email)) throw new AuthError('EMAIL_ALREADY_EXISTS','Este correo ya está registrado.','email');
    const base=email.split('@')[0];
    let displayName='';
    for(let i=0;i<10000;i++) {
      const suffix=String(crypto.getRandomValues(new Uint32Array(1))[0] % 9000 + 1000);
      const candidate=`${base}${suffix}`;
      if(!users.some(u=>u.displayName.toLowerCase()===candidate.toLowerCase())) { displayName=candidate; break; }
    }
    if (!displayName) throw new AuthError('NAME_UNAVAILABLE','No fue posible generar un nombre de usuario único.');
    const salt=crypto.getRandomValues(new Uint8Array(16));
    const user: StoredAuthUser={id:crypto.randomUUID(),email,displayName,role,createdAt:new Date().toISOString(),salt:[...salt],passwordHash:await derive(password,salt)};
    try {await putUserIfAbsent(user);} catch(error) {
      if (await getUser(email)) throw new AuthError('EMAIL_ALREADY_EXISTS','Este correo ya está registrado.','email');
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
    const error=new AuthError('INVALID_CREDENTIALS','Correo o contraseña incorrectos.');
    if(!stored) throw error;
    if (!Array.isArray(stored.salt) || stored.salt.length!==16 || !Array.isArray(stored.passwordHash) || stored.passwordHash.length!==32) {
      throw new AuthError('CORRUPT_USER', 'El registro de usuario está dañado; no se puede iniciar sesión.');
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
    if(!isSession(session)) {await clearSession();throw new AuthError('CORRUPT_SESSION','La sesión local no es válida.');}
    const stored=await getUser(session.user.email);
    if (!stored || stored.id!==session.user.id || stored.role!==session.user.role || !['reader','publisher','moderator'].includes(stored.role)) {await clearSession();return null;}
    return {user:publicUser(stored),authenticatedAt:session.authenticatedAt};
  },
  async hasRole(role:UserRole):Promise<boolean> {return (await this.getCurrentSession())?.user.role===role;}
};
/** Cloud adapter must be configured by the platform team with Firebase verification and REST API.
 * Local IndexedDB identity is NEVER a server-side authorization credential. */
export function requireLocalRole(session:AuthSession|null,role:UserRole):void {
  if(!session) throw new AuthError('UNAUTHENTICATED','Debes iniciar sesión.');
  if(session.user.role!==role) throw new AuthError('FORBIDDEN','No tienes autorización para esta función.');
}
