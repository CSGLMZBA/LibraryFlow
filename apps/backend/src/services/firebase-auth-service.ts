import {cert, getApps, initializeApp, applicationDefault} from 'firebase-admin/app';
import {getAuth, type Auth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import { AuthCloudError } from './auth-errors.js';
export { AuthCloudError } from './auth-errors.js';
import { accountSessionPolicy, tokenProof } from './account-session-policy.js';
import type {VerifiedIdentity, VerifiedRole} from '../middleware/auth-guard.js';

export type PublicUser = {id: string; email: string; displayName: string; role: VerifiedRole; createdAt: string};
export type CloudSession = {user: PublicUser; token: string; authenticatedAt: string};

export function authAdmin() {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!projectId) throw new AuthCloudError('CONFIGURATION_ERROR', 'Firebase is not configured.', undefined, 503);
    initializeApp({
      credential: clientEmail && privateKey ? cert({projectId, clientEmail, privateKey}) : applicationDefault(),
      projectId
    });
  }
  return getAuth();
}

export async function identityToolkit(endpoint: 'signUp' | 'signInWithPassword', email: string, password: string): Promise<{idToken: string}> {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) throw new AuthCloudError('CONFIGURATION_ERROR', 'FIREBASE_WEB_API_KEY is missing.', undefined, 503);
  let response: Response;
  try {
    response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email, password, returnSecureToken: true})
    });
  } catch {
    throw new AuthCloudError('AUTH_PROVIDER_UNAVAILABLE', 'Authentication provider unavailable.', undefined, 503);
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = (data && typeof data === 'object' && 'error' in data && (data as {error?: {message?: string}}).error?.message) || '';
    if (typeof code === 'string' && code.startsWith('EMAIL_EXISTS')) throw new AuthCloudError('EMAIL_ALREADY_EXISTS', 'This email is already registered.', 'email', 409);
    if (endpoint === 'signInWithPassword') throw new AuthCloudError('INVALID_CREDENTIALS', 'Incorrect email or password.', undefined, 401);
    throw new AuthCloudError('AUTH_PROVIDER_ERROR', 'Could not create the account.', undefined, 502);
  }
  if (!data || typeof data !== 'object' || !('idToken' in data) || typeof (data as {idToken: unknown}).idToken !== 'string') {
    throw new AuthCloudError('AUTH_PROVIDER_ERROR', 'Invalid authentication provider response.', undefined, 502);
  }
  return {idToken: (data as {idToken: string}).idToken};
}

function roleFromClaims(value: unknown): VerifiedRole | null {
  return value === 'reader' || value === 'publisher' || value === 'moderator' ? value : null;
}

async function toSession(token: string, bootstrap = true, touch = false): Promise<CloudSession> {
  if (!token) throw new AuthCloudError('AUTH_REQUIRED', 'Sign-in is required.', undefined, 401);
  const record = await verifiedFirebaseAccount(token);
  const decoded = await authAdmin().verifyIdToken(token, true);
  await accountSessionPolicy.authorize(tokenProof(record.uid, decoded.auth_time, decoded.iat, token), {bootstrap, touch});
  const role = roleFromClaims(record.customClaims?.role);
  if (!role || !record.email) throw new AuthCloudError('FORBIDDEN', 'The account has no authorized role.', undefined, 403);
  return {
    token,
    authenticatedAt: new Date().toISOString(),
    user: {id: record.uid, email: record.email, displayName: record.displayName || record.email.split('@')[0],
      role, createdAt: record.metadata.creationTime || new Date().toISOString()}
  };
}

export async function registerCloud(email: string, password: string, _requestedRole: 'reader' | 'publisher'): Promise<CloudSession> {
  const admin = authAdmin();
  let created: Awaited<ReturnType<typeof admin.createUser>>;
  try {
    // Prevent role escalation: no moderator registration is exposed here.
    created = await admin.createUser({email, password});
  } catch (error) {
    const code = (error as {code?: string}).code;
    if (code === 'auth/email-already-exists') throw new AuthCloudError('EMAIL_ALREADY_EXISTS', 'This email is already registered.', 'email', 409);
    throw new AuthCloudError('AUTH_PROVIDER_ERROR', 'Could not create the account.', undefined, 502);
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
    if (!reservedName) throw new AuthCloudError('NAME_UNAVAILABLE', 'No username is available.', undefined, 409);
    await admin.updateUser(created.uid, {displayName: reservedName});
    // Public registration must never grant publisher privileges.
    // Publisher claims are assigned only after moderator approval.
    await admin.setCustomUserClaims(created.uid, {role: 'reader'});
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
  return toSession(result.idToken, true, true);
}
export async function verifyFirebaseIdentity(token: string): Promise<VerifiedIdentity | null> {
  try {
    const record = await verifiedFirebaseAccount(token);
    const decoded = await authAdmin().verifyIdToken(token, true);
    await accountSessionPolicy.authorize(tokenProof(record.uid, decoded.auth_time, decoded.iat, token), {touch: true});
    const role = roleFromClaims(record.customClaims?.role);
    if (!role) return null;
    return {uid: record.uid, role};
  } catch (error) {
    if (error instanceof AuthCloudError && error.code === 'AUTH_INVALID') return null;
    throw error;
  }
}

/** Reused by login, restore, refresh and every protected identity check. */
export async function verifiedFirebaseAccount(token: string, admin: Pick<Auth, 'verifyIdToken' | 'getUser'> = authAdmin()) {
  try {
    const decoded = await admin.verifyIdToken(token, true);
    const record = await admin.getUser(decoded.uid);
    if (record.disabled) throw new AuthCloudError('AUTH_INVALID', 'The account is disabled.', undefined, 401);
    return record;
  } catch (error) {
    if (error instanceof AuthCloudError) throw error;
    const code = (error as {code?: string})?.code;
    if (['auth/id-token-expired', 'auth/id-token-revoked', 'auth/argument-error',
      'auth/invalid-id-token', 'auth/user-disabled', 'auth/user-not-found'].includes(code ?? '')) {
      throw new AuthCloudError('AUTH_INVALID', 'Invalid or expired session.', undefined, 401);
    }
    throw new AuthCloudError('AUTH_UNAVAILABLE', 'The authentication service is unavailable.', undefined, 503);
  }
}
export async function currentCloudSession(token: string, bootstrap = true, touch = false): Promise<CloudSession> {
  return toSession(token, bootstrap, touch);
}
export async function logoutCloud(token: string, admin?: Pick<Auth, 'verifyIdToken' | 'getUser' | 'revokeRefreshTokens'>): Promise<void> {
  const provider = admin ?? authAdmin();
  const account = await verifiedFirebaseAccount(token, provider);
  if (!roleFromClaims(account.customClaims?.role)) throw new AuthCloudError('AUTH_INVALID', 'Invalid session.', undefined, 401);
  if (!admin) await accountSessionPolicy.revoke(account.uid);
  await provider.revokeRefreshTokens(account.uid);
}
