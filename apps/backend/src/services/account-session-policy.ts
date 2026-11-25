import { createHash } from 'node:crypto';
import type { AuthStateStore } from '../repositories/auth-state-store.js';
import { FirestoreAuthStateStore } from '../repositories/auth-state-store.js';
import { AuthCloudError } from './auth-errors.js';

export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const DELETION_GRACE_MS = 30 * 24 * 60 * 60 * 1000;
export type Ban = {actorUid: string; targetUid: string; reason: string; startsAt: string; endsAt?: string; permanent?: boolean};
export type BanInput = {reason: string; endsAt?: string; permanent?: boolean};
export type AccountState = {
  uid: string; revision: number; updatedAt: string;
  deletionRequestedAt?: string; permanentDeletionAt?: string; deletionJobId?: string;
  tokensValidAfter?: number; publicRedactionPending?: boolean; ban?: Ban;
};
export type RecoveryRequest = {
  id: string; targetUid: string; deletionJobId: string; status: 'pending' | 'approved';
  createdAt: string; permanentDeletionAt: string; revision: number;
  reviewedAt?: string; reviewerUid?: string;
};
export type RecoveryReviewItem = RecoveryRequest & {accountRevision: number; canRestore: boolean};
export type SessionProof = {uid: string; authTime: number; issuedAt: number; tokenDigest: string};
export type SessionState = SessionProof & {revision: number; lastActivityAt: number; revokedAt?: number};
export type DeletionResult = {deletionRequestedAt: string; permanentDeletionAt: string; revision: number; emailStatus: 'queued'};
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const accountPath = (uid: string) => `accounts/${encodeURIComponent(uid)}`;
const recoveryId = (uid: string, jobId: string) => digest(`account-recovery:${uid}:${jobId}`);
const sessionPath = (p: SessionProof) => `authSessions/${digest(`${p.uid}:${p.authTime}`)}`;
function isActiveBan(ban: Ban | undefined, now: number): boolean {
  if (!ban) return false;
  const startsAt = Date.parse(ban.startsAt);
  const endsAt = Date.parse(ban.endsAt ?? '');
  return !Number.isFinite(startsAt) || (!ban.permanent && !Number.isFinite(endsAt)) ||
    (startsAt <= now && (ban.permanent === true || endsAt > now));
}

export class AccountSessionPolicy {
  constructor(private readonly store: AuthStateStore, private readonly now: () => number = Date.now) {}
  async isPublicContentVisible(uid: string): Promise<boolean> {
    return this.store.transaction(async tx => {
      const account = await tx.get<AccountState>(accountPath(uid));
      return !account?.deletionRequestedAt && !isActiveBan(account?.ban, this.now());
    });
  }
  private active(account: AccountState | null): void {
    if (account?.deletionRequestedAt) throw new AuthCloudError('ACCOUNT_RESTRICTED', 'Account is pending deletion during the 30-day grace period.', undefined, 403, true);
    const ban = account?.ban;
    if (isActiveBan(ban, this.now())) {
      const reason = typeof ban?.reason === 'string' ? ban.reason.trim() : '';
      const validEnd = ban?.endsAt && Number.isFinite(Date.parse(ban.endsAt));
      const duration = ban?.permanent === true ? 'The ban is permanent.' :
        validEnd ? `The ban ends at ${ban.endsAt}.` : '';
      const message = reason && duration
        ? `Your account is banned: ${reason}. ${duration}`
        : 'This account is restricted.';
      throw new AuthCloudError('ACCOUNT_RESTRICTED', message, undefined, 403);
    }
  }
  async authorize(proof: SessionProof, options: {bootstrap?: boolean; touch?: boolean} = {}): Promise<void> {
    const now = this.now();
    await this.store.transaction(async tx => {
      const account = await tx.get<AccountState>(accountPath(proof.uid));
      const current = await tx.get<SessionState>(sessionPath(proof));
      this.active(account);
      if (account?.tokensValidAfter !== undefined && proof.authTime * 1000 <= account.tokensValidAfter) {
        throw new AuthCloudError('AUTH_INVALID', 'Sign in again to start a new session.', undefined, 401);
      }
      if (!current) {
        if (!options.bootstrap || proof.authTime * 1000 > now + 60_000 || now - proof.authTime * 1000 >= SESSION_IDLE_MS) {
          throw new AuthCloudError('AUTH_INVALID', 'The session has expired. Sign in again.', undefined, 401);
        }
        tx.create(sessionPath(proof), {...proof, revision: 1, lastActivityAt: now});
        if (!account) tx.create(accountPath(proof.uid), {uid: proof.uid, revision: 1, updatedAt: new Date(now).toISOString()});
        return;
      }
      if (current.uid !== proof.uid || current.revokedAt !== undefined || !Number.isFinite(current.lastActivityAt) ||
        now - current.lastActivityAt >= SESSION_IDLE_MS || proof.issuedAt < current.issuedAt ||
        (proof.issuedAt === current.issuedAt && proof.tokenDigest !== current.tokenDigest)) {
        throw new AuthCloudError('AUTH_INVALID', 'The session has expired or was replaced. Sign in again.', undefined, 401);
      }
      // SDK refresh may return an identical JWT within the same second. That is a no-op.
      if (options.touch || current.tokenDigest !== proof.tokenDigest) {
        tx.set(sessionPath(proof), {...current, ...proof, revision: current.revision + 1,
          lastActivityAt: options.touch ? now : current.lastActivityAt});
      }
    });
  }
  async revoke(uid: string): Promise<void> {
    const now = this.now();
    await this.store.transaction(async tx => {
      const account = await tx.get<AccountState>(accountPath(uid));
      tx.set(accountPath(uid), {...account, uid, tokensValidAfter: now, revision: (account?.revision ?? 0) + 1, updatedAt: new Date(now).toISOString()});
    });
  }
  async recordUnauthorizedBanAttempt(uid: string, actor: {uid: string; role: string}, action: 'ban' | 'lift'): Promise<void> {
    if (actor.role === 'moderator') throw new AuthCloudError('INVALID_STATE', 'Moderator actions are not unauthorized attempts.', undefined, 409);
    const now = this.now();
    await this.store.transaction(async tx => {
      const actorAccount = await tx.get<AccountState>(accountPath(actor.uid));
      this.active(actorAccount);
      tx.create(`accountAudit/${crypto.randomUUID()}`, {actorUid: actor.uid, targetUid: uid,
        action: 'unauthorized_ban_attempt', attemptedAction: action,
        reason: 'A non-moderator attempted a moderation action.', timestamp: new Date(now).toISOString()});
    });
  }
  async ban(uid: string, actor: {uid: string; role: string}, input: BanInput): Promise<{ban: Ban; revision: number}> {
    if (actor.role !== 'moderator') throw new AuthCloudError('FORBIDDEN', 'Moderator access is required.', undefined, 403);
    if (uid === actor.uid) throw new AuthCloudError('VALIDATION_ERROR', 'A moderator cannot ban their own account.', 'uid');
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    if (!reason || reason.length > 500) throw new AuthCloudError('VALIDATION_ERROR', 'Reason must contain 1 to 500 characters.', 'reason');
    const now = this.now();
    const end = typeof input.endsAt === 'string' ? Date.parse(input.endsAt) : NaN;
    const invalidDuration = input.permanent === true
      ? input.endsAt !== undefined
      : (input.permanent !== undefined && input.permanent !== false) || !Number.isFinite(end) || end <= now;
    if (invalidDuration) {
      throw new AuthCloudError('VALIDATION_ERROR', 'Specify a permanent ban or a future end time.', 'endsAt');
    }
    return this.store.transaction(async tx => {
      const actorAccount = await tx.get<AccountState>(accountPath(actor.uid));
      const account = await tx.get<AccountState>(accountPath(uid));
      this.active(actorAccount);
      if (!account) throw new AuthCloudError('NOT_FOUND', 'Account not found.', undefined, 404);
      if (account.deletionRequestedAt) throw new AuthCloudError('INVALID_STATE', 'Account is pending deletion.', undefined, 409);
      if (account.ban && (isActiveBan(account.ban, now) || Date.parse(account.ban.startsAt) > now)) {
        throw new AuthCloudError('INVALID_STATE', 'Account already has an active ban.', undefined, 409);
      }
      const at = new Date(now).toISOString();
      const ban: Ban = {actorUid: actor.uid, targetUid: uid, reason, startsAt: at,
        ...(input.permanent === true ? {permanent: true} : {endsAt: new Date(end).toISOString()})};
      const revision = account.revision + 1;
      const eventId = digest(`account_banned:${uid}:${revision}`);
      tx.set(accountPath(uid), {...account, ban, revision, updatedAt: at});
      tx.create(`accountAudit/${eventId}`, {actorUid: actor.uid, targetUid: uid, reason, action: 'account_banned', timestamp: at, ban});
      tx.create(`notifications/${eventId}`, {id: eventId, userId: uid, type: 'ban_changed',
        message: `Your account was banned: ${reason}. ${ban.permanent ? 'The ban is permanent.' : `The ban ends at ${ban.endsAt}.`}`, read: false, createdAt: at});
      return {ban, revision};
    });
  }
  async liftBan(uid: string, actor: {uid: string; role: string}, reasonInput: string): Promise<{revision: number}> {
    if (actor.role !== 'moderator') throw new AuthCloudError('FORBIDDEN', 'Moderator access is required.', undefined, 403);
    const reason = typeof reasonInput === 'string' ? reasonInput.trim() : '';
    if (!reason || reason.length > 500) throw new AuthCloudError('VALIDATION_ERROR', 'Reason must contain 1 to 500 characters.', 'reason');
    return this.store.transaction(async tx => {
      const actorAccount = await tx.get<AccountState>(accountPath(actor.uid));
      const account = await tx.get<AccountState>(accountPath(uid));
      this.active(actorAccount);
      if (!account) throw new AuthCloudError('NOT_FOUND', 'Account not found.', undefined, 404);
      if (!account.ban) throw new AuthCloudError('INVALID_STATE', 'Account has no ban to lift.', undefined, 409);
      const at = new Date(this.now()).toISOString();
      const revision = account.revision + 1;
      const eventId = digest(`account_ban_lifted:${uid}:${revision}`);
      const {ban: _ban, ...updated} = account;
      tx.set(accountPath(uid), {...updated, revision, updatedAt: at});
      tx.create(`accountAudit/${eventId}`, {actorUid: actor.uid, targetUid: uid, reason, action: 'account_ban_lifted', timestamp: at});
      tx.create(`notifications/${eventId}`, {id: eventId, userId: uid, type: 'ban_changed',
        message: `Your ban was lifted: ${reason}.`, read: false, createdAt: at});
      return {revision};
    });
  }
  async requestDeletion(uid: string, email: string): Promise<DeletionResult> {
    const now = this.now();
    return this.store.transaction(async tx => {
      const previous = await tx.get<AccountState>(accountPath(uid));
      if (previous?.deletionRequestedAt && previous.permanentDeletionAt) {
        return {deletionRequestedAt: previous.deletionRequestedAt, permanentDeletionAt: previous.permanentDeletionAt, revision: previous.revision, emailStatus: 'queued'};
      }
      this.active(previous);
      const revision = (previous?.revision ?? 0) + 1;
      const at = new Date(now).toISOString();
      const dueAt = new Date(now + DELETION_GRACE_MS).toISOString();
      const jobId = digest(`account-data:${uid}:${revision}`);
      const next: AccountState = {...previous, uid, revision, updatedAt: at, deletionRequestedAt: at,
        permanentDeletionAt: dueAt, deletionJobId: jobId, tokensValidAfter: now, publicRedactionPending: true};
      tx.set(accountPath(uid), next);
      tx.create(`deletionJobs/${jobId}`, {id: jobId, kind: 'account-data', targetId: uid, dueAt, status: 'pending', attempts: 0});
      tx.create(`accountAudit/${jobId}`, {actorUid: uid, targetUid: uid, reason: 'User requested account deletion.', action: 'deletion_requested', timestamp: at});
      // Delivery is an explicit platform integration. A queued message is never reported as sent.
      tx.create(`accountEmailOutbox/${jobId}`, {id: jobId, recipient: email, uid, kind: 'deletion_confirmation', createdAt: at, permanentDeletionAt: dueAt, status: 'pending'});
      return {deletionRequestedAt: at, permanentDeletionAt: dueAt, revision, emailStatus: 'queued'};
    });
  }
  async markRedacted(uid: string): Promise<number> {
    return this.store.transaction(async tx => {
      const account = await tx.get<AccountState>(accountPath(uid));
      if (!account?.deletionRequestedAt) throw new AuthCloudError('INVALID_STATE', 'No deletion request is active.', undefined, 409);
      if (!account.publicRedactionPending) return account.revision;
      const revision = account.revision + 1;
      tx.set(accountPath(uid), {...account, publicRedactionPending: false, revision, updatedAt: new Date(this.now()).toISOString()});
      return revision;
    });
  }
  async requestRecovery(uid: string): Promise<RecoveryRequest> {
    const now = this.now();
    return this.store.transaction(async tx => {
      const account = await tx.get<AccountState>(accountPath(uid));
      const job = account?.deletionJobId ? await tx.get<{status: string}>(`deletionJobs/${account.deletionJobId}`) : null;
      if (!account?.deletionRequestedAt || !account.permanentDeletionAt || !account.deletionJobId ||
          !Number.isFinite(Date.parse(account.permanentDeletionAt)) || now >= Date.parse(account.permanentDeletionAt) || !job || job.status !== 'pending') {
        throw new AuthCloudError('INVALID_STATE', 'No deletion cancellation can be requested for this account.', undefined, 409);
      }
      const id = recoveryId(uid, account.deletionJobId);
      const existing = await tx.get<RecoveryRequest>(`accountRecoveryRequests/${id}`);
      if (existing) return existing;
      const at = new Date(now).toISOString();
      const request: RecoveryRequest = {id, targetUid: uid, deletionJobId: account.deletionJobId,
        status: 'pending', revision: 1, createdAt: at, permanentDeletionAt: account.permanentDeletionAt};
      tx.create(`accountRecoveryRequests/${id}`, request);
      tx.create(`accountAudit/recovery-${id}`, {actorUid: uid, targetUid: uid, action: 'deletion_cancellation_requested',
        reason: 'User requested moderator review of account deletion cancellation.', timestamp: at});
      // Deliberately do not clear account flags, cancel the job or grant a session here.
      return request;
    });
  }
  async pendingRecoveryRequests(actor: {uid: string; role: string}): Promise<RecoveryReviewItem[]> {
    return this.store.transaction(async tx => {
      if (actor.role !== 'moderator') throw new AuthCloudError('FORBIDDEN', 'Moderator access is required.', undefined, 403);
      this.active(await tx.get<AccountState>(accountPath(actor.uid)));
      const requests = await tx.query<RecoveryRequest>('accountRecoveryRequests', 'status', 'pending');
      const items: RecoveryReviewItem[] = [];
      for (const request of requests) {
        const account = await tx.get<AccountState>(accountPath(request.targetUid));
        const job = account?.deletionJobId ? await tx.get<{status: string}>(`deletionJobs/${account.deletionJobId}`) : null;
        items.push({...request, accountRevision: account?.revision ?? 0, canRestore: Boolean(account?.deletionRequestedAt &&
          account.deletionJobId === request.deletionJobId && account.publicRedactionPending === false &&
          Number.isFinite(Date.parse(account.permanentDeletionAt ?? '')) && this.now() < Date.parse(account.permanentDeletionAt!) && job?.status === 'pending')});
      }
      return items.sort((a,b) => a.createdAt.localeCompare(b.createdAt));
    });
  }
  async restore(uid: string, actor: {uid: string; role: string}, revision?: number): Promise<{restored: true; revision: number}> {
    if (actor.role !== 'moderator') throw new AuthCloudError('FORBIDDEN', 'Only a moderator may approve restoration.', undefined, 403);
    const now = this.now();
    return this.store.transaction(async tx => {
      const actorAccount = await tx.get<AccountState>(accountPath(actor.uid));
      const account = await tx.get<AccountState>(accountPath(uid));
      const job = account?.deletionJobId ? await tx.get<{status: string}>(`deletionJobs/${account.deletionJobId}`) : null;
      const requestId = account?.deletionJobId ? recoveryId(uid, account.deletionJobId) : '';
      const request = requestId ? await tx.get<RecoveryRequest>(`accountRecoveryRequests/${requestId}`) : null;
      this.active(actorAccount);
      if (!account?.deletionRequestedAt || !account.permanentDeletionAt) throw new AuthCloudError('INVALID_STATE', 'No deletion request is active.', undefined, 409);
      if (!Number.isFinite(Date.parse(account.permanentDeletionAt)) || now >= Date.parse(account.permanentDeletionAt) || !job || job.status !== 'pending') {
        throw new AuthCloudError('INVALID_STATE', 'The restoration window has closed or cleanup has started.', undefined, 409);
      }
      if (!request || request.status !== 'pending' || request.targetUid !== uid || request.deletionJobId !== account.deletionJobId) {
        throw new AuthCloudError('INVALID_STATE', 'A pending user recovery request is required.', undefined, 409);
      }
      if (account.publicRedactionPending) throw new AuthCloudError('INVALID_STATE', 'Public-data cleanup must complete before restoration.', undefined, 409);
      if (revision !== undefined && revision !== account.revision) throw new AuthCloudError('REVISION_CONFLICT', 'The account changed. Reload before retrying.', undefined, 409);
      const {deletionRequestedAt: _requested, permanentDeletionAt: _due, deletionJobId: _job, ...restored} = account;
      const at = new Date(now).toISOString();
      const nextRevision = account.revision + 1;
      tx.set(accountPath(uid), {...restored, revision: nextRevision, tokensValidAfter: now, updatedAt: at});
      tx.set(`accountRecoveryRequests/${requestId}`, {...request, status: 'approved', revision: request.revision + 1, reviewedAt: at, reviewerUid: actor.uid});
      if (account.deletionJobId) tx.set(`deletionJobs/${account.deletionJobId}`, {...job, id: account.deletionJobId,
        kind: 'account-data', targetId: uid, dueAt: account.permanentDeletionAt, attempts: 0, status: 'completed', completedAt: at, cancelledAt: at});
      const eventId = digest(`account_restored:${uid}:${nextRevision}`);
      tx.create(`accountAudit/${eventId}`, {actorUid: actor.uid, targetUid: uid, reason: 'Account restored within the grace period.', action: 'account_restored', timestamp: at});
      tx.create(`notifications/${eventId}`, {id: eventId, userId: uid, type: 'account_restored', message: 'Your account has been restored. Sign in again.', read: false, createdAt: at});
      return {restored: true, revision: nextRevision};
    });
  }
}
export const accountSessionPolicy = new AccountSessionPolicy(new FirestoreAuthStateStore());
export function tokenProof(uid: string, authTime: number, issuedAt: number, token: string): SessionProof {
  if (!Number.isInteger(authTime) || !Number.isInteger(issuedAt) || authTime <= 0 || issuedAt < authTime) {
    throw new AuthCloudError('AUTH_INVALID', 'Invalid session claims.', undefined, 401);
  }
  return {uid, authTime, issuedAt, tokenDigest: digest(token)};
}
