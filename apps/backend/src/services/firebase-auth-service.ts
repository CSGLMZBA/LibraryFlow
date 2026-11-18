import {cert, getApps, initializeApp, applicationDefault} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import type {VerifiedIdentity, VerifiedRole} from '../middleware/auth-guard.js';

export type PublicUser = {id: string; email: string; displayName: string; role: VerifiedRole; createdAt: string};
export type CloudSession = {user: PublicUser; token: string; authenticatedAt: string};
export class AuthCloudError extends Error {
  constructor(public readonly code: string, message: string, public readonly field?: string, public readonly httpStatus = 400) {
    super(message);
    this.name = 'AuthCloudError';
  }
}

function authAdmin() {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!projectId) throw new AuthCloudError('CONFIGURATION_ERROR', 'Firebase no está configurado.', undefined, 503);
    initializeApp({
      credential: clientEmail && privateKey ? cert({projectId, clientEmail, privateKey}) : applicationDefault(),
      projectId
    });
  }
  return getAuth();
}

async function identityToolkit(endpoint: 'signUp' | 'signInWithPassword', email: string, password: string): Promise<{idToken: string}> {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) throw new AuthCloudError('CONFIGURATION_ERROR', 'Falta FIREBASE_WEB_API_KEY.', undefined, 503);
  let response: Response;
  try {
    response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email, password, returnSecureToken: true})
    });
  } catch {
    throw new AuthCloudError('AUTH_PROVIDER_UNAVAILABLE', 'Proveedor de autenticación no disponible.', undefined, 503);
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = (data && typeof data === 'object' && 'error' in data && (data as {error?: {message?: string}}).error?.message) || '';
    if (typeof code === 'string' && code.startsWith('EMAIL_EXISTS')) throw new AuthCloudError('EMAIL_ALREADY_EXISTS', 'Este correo ya está registrado.', 'email', 409);
    if (endpoint === 'signInWithPassword') throw new AuthCloudError('INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.', undefined, 401);
    throw new AuthCloudError('AUTH_PROVIDER_ERROR', 'No fue posible crear la cuenta.', undefined, 502);
  }
  if (!data || typeof data !== 'object' || !('idToken' in data) || typeof (data as {idToken: unknown}).idToken !== 'string') {
    throw new AuthCloudError('AUTH_PROVIDER_ERROR', 'Respuesta inválida del proveedor.', undefined, 502);
  }
  return {idToken: (data as {idToken: string}).idToken};
}

function roleFromClaims(value: unknown): VerifiedRole | null {
  return value === 'reader' || value === 'publisher' || value === 'moderator' ? value : null;
}

async function toSession(token: string): Promise<CloudSession> {
  const admin = authAdmin();
  const decoded = await admin.verifyIdToken(token, true);
  const record = await admin.getUser(decoded.uid);
  const role = roleFromClaims(record.customClaims?.role);
  if (!role || !record.email) throw new AuthCloudError('FORBIDDEN', 'Usuario sin rol autorizado.', undefined, 403);
  return {
    token,
    authenticatedAt: new Date().toISOString(),
    user: {id: record.uid, email: record.email, displayName: record.displayName || record.email.split('@')[0],
      role, createdAt: record.metadata.creationTime || new Date().toISOString()}
  };
}

export async function registerCloud(email: string, password: string, role: 'reader' | 'publisher'): Promise<CloudSession> {
  const admin = authAdmin();
  let created: Awaited<ReturnType<typeof admin.createUser>>;
  try {
    // Prevent role escalation: no moderator registration is exposed here.
    created = await admin.createUser({email, password});
  } catch (error) {
    const code = (error as {code?: string}).code;
    if (code === 'auth/email-already-exists') throw new AuthCloudError('EMAIL_ALREADY_EXISTS', 'Este correo ya está registrado.', 'email', 409);
    throw new AuthCloudError('AUTH_PROVIDER_ERROR', 'No fue posible crear la cuenta.', undefined, 502);
  }
  let reservedName: string | null = null;
  try {
    const local = email.split('@')[0];
    const firestore = getFirestore();
    const randomStart = cryptoNumber(created.uid) % 9000;
    for (let n = 0; n < 9000; n++) {
      const suffix = 1000 + ((randomStart + n) % 9000);
      const candidate = `${local}${suffix}`;
      const claim = firestore.collection('auth-display-name-reservations').doc(candidate.toLowerCase());
      const accepted = await firestore.runTransaction(async transaction => {
        const doc = await transaction.get(claim);
        if (doc.exists) return false;
        transaction.create(claim, {uid: created.uid, createdAt: new Date().toISOString()});
        return true;
      });
      if (accepted) {reservedName = candidate; break;}
    }
    if (!reservedName) throw new AuthCloudError('NAME_UNAVAILABLE', 'No hay nombre de usuario disponible.', undefined, 409);
    await admin.updateUser(created.uid, {displayName: reservedName});
    await admin.setCustomUserClaims(created.uid, {role});
    const signed = await identityToolkit('signInWithPassword', email, password);
    return await toSession(signed.idToken);
  } catch (error) {
    if (reservedName) {
      await getFirestore().collection('auth-display-name-reservations').doc(reservedName.toLowerCase()).delete().catch(() => undefined);
    }
    await admin.deleteUser(created.uid).catch(() => undefined);
    throw error;
  }
}
function cryptoNumber(id: string): number {
  // Display-name suffix is a convenience only; never used as security credential.
  let n = 2166136261;
  for (let i=0;i<id.length;i++) n = Math.imul(n ^ id.charCodeAt(i), 16777619);
  return n >>> 0;
}
export async function loginCloud(email: string, password: string): Promise<CloudSession> {
  const result = await identityToolkit('signInWithPassword', email, password);
  return toSession(result.idToken);
}
export async function verifyFirebaseIdentity(token: string): Promise<VerifiedIdentity | null> {
  try {
    const decoded = await authAdmin().verifyIdToken(token, true);
    const record = await authAdmin().getUser(decoded.uid);
    const role = roleFromClaims(record.customClaims?.role);
    if (!role || record.disabled) return null;
    return {uid: decoded.uid, role};
  } catch (error) {
    if (error instanceof AuthCloudError && error.code === 'CONFIGURATION_ERROR') throw error;
    return null;
  }
}
export async function currentCloudSession(token: string): Promise<CloudSession> {
  try {return await toSession(token);} catch {throw new AuthCloudError('UNAUTHENTICATED', 'Sesión inválida.', undefined, 401);}
}
export async function logoutCloud(token: string): Promise<void> {
  const identity = await verifyFirebaseIdentity(token);
  if (!identity) throw new AuthCloudError('UNAUTHENTICATED', 'Sesión inválida.', undefined, 401);
  await authAdmin().revokeRefreshTokens(identity.uid);
}
