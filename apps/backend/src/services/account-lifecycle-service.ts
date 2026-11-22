import { getFirestore } from 'firebase-admin/firestore';
import { accountSessionPolicy, tokenProof } from './account-session-policy.js';
import { authAdmin, identityToolkit, verifiedFirebaseAccount } from './firebase-auth-service.js';
import { AuthCloudError } from './auth-errors.js';
import { commentRepository } from '../repositories/comment-repository.js';
import { bookRepository } from '../repositories/book-repository.js';

/** Idempotent redaction hook; account restriction is already durable before it runs. */
export async function redactPublicAccountData(uid: string): Promise<void> {
  await commentRepository.redactAuthor(uid);
  await bookRepository.redactOwner(uid);
  const db = getFirestore();
  for (const [collection, field, updates] of [
    ['comments', 'authorId', {authorDisplayName: 'Deleted user', content: '', isDeleted: true}],
    ['books', 'ownerId', {author: 'Deleted user', status: 'pending'}],
  ] as const) {
    // Page through records, avoiding a single unbounded batch or memory allocation.
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    for (;;) {
      let query = db.collection(collection).where(field, '==', uid).orderBy('__name__').limit(200);
      if (cursor) query = query.startAfter(cursor);
      const page = await query.get();
      if (page.empty) break;
      const batch = db.batch();
      for (const doc of page.docs) batch.update(doc.ref, updates);
      await batch.commit();
      cursor = page.docs[page.docs.length - 1];
    }
  }
  await db.collection('profiles').doc(encodeURIComponent(uid)).delete();
  await authAdmin().updateUser(uid, {displayName: null, photoURL: null});
}

export async function requestAccountDeletion(token: string) {
  const account = await verifiedFirebaseAccount(token);
  if (!account.email) throw new AuthCloudError('AUTH_INVALID', 'Invalid account.', undefined, 401);
  const decoded = await authAdmin().verifyIdToken(token, true);
  try { await accountSessionPolicy.authorize(tokenProof(account.uid, decoded.auth_time, decoded.iat, token)); }
  catch (error) {
    // A restricted deletion request may retry interrupted redaction; bans remain rejected by requestDeletion.
    if (!(error instanceof AuthCloudError) || error.code !== 'ACCOUNT_RESTRICTED') throw error;
  }
  const result = await accountSessionPolicy.requestDeletion(account.uid, account.email);
  await redactPublicAccountData(account.uid);
  const revision = await accountSessionPolicy.markRedacted(account.uid);
  await authAdmin().revokeRefreshTokens(account.uid);
  return {...result, revision};
}

export async function requestDeletionCancellation(email: string, password: string) {
  // Verify credentials without opening a normal application session for a restricted account.
  const signed = await identityToolkit('signInWithPassword', email, password);
  const account = await verifiedFirebaseAccount(signed.idToken);
  return accountSessionPolicy.requestRecovery(account.uid);
}

export async function restoreAccount(uid: string, actor: {uid: string; role: string}, revision: number) {
  if (actor.role !== 'moderator') throw new AuthCloudError('FORBIDDEN', 'Moderator access is required.', undefined, 403);
  await authAdmin().getUser(uid); // Permanently removed Firebase users cannot be reconstructed by flags.
  const result = await accountSessionPolicy.restore(uid, actor, revision);
  await authAdmin().revokeRefreshTokens(uid);
  return result;
}

export async function pendingAccountRecoveryRequests(actor: {uid: string; role: string}) {
  return accountSessionPolicy.pendingRecoveryRequests(actor);
}
