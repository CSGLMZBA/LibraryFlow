import { authService } from './auth-service';
import { AuthError } from '../types/auth';

type DeletionResult = {deletionRequestedAt: string; permanentDeletionAt: string; revision: number; emailStatus: 'queued'};
export type RecoveryRequest = {id: string; targetUid: string; deletionJobId: string; status: 'pending' | 'approved'; createdAt: string; permanentDeletionAt: string; revision: number};
export type RecoveryReviewItem = RecoveryRequest & {accountRevision: number; canRestore: boolean};
type RestoredResult = {restored: true; revision: number};
type AuthConsumer = Pick<typeof authService, 'getCurrentSession' | 'getAccessToken'>;
const base = ((import.meta as ImportMeta & {env?: {VITE_API_BASE_URL?: string}}).env?.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
export function createAccountLifecycleService(auth: AuthConsumer = authService, apiBase = base, transport: typeof fetch = fetch) {
  async function request<T>(path: string, method: 'GET'|'POST', body: object | undefined, authenticated: boolean): Promise<T> {
    if (authenticated) await auth.getCurrentSession();
    const token = authenticated ? auth.getAccessToken() : null;
    if (authenticated && !token) throw new AuthError('AUTH_REQUIRED', 'A cloud session is required for account changes.');
    let response: Response;
    try {
      response = await transport(`${apiBase.replace(/\/$/, '')}/api/v1${path}`, {method,
        headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})},
        ...(body ? {body: JSON.stringify(body)} : {})});
    } catch {throw new AuthError('AUTH_UNAVAILABLE', 'The account service is unavailable. Retry the operation.');}
    const data = await response.json().catch(() => null) as {success?: boolean; data?: T; error?: {code?: string; message?: string}} | null;
    if (!response.ok || !data?.success || data.data === undefined) {
      throw new AuthError(data?.error?.code ?? 'INVALID_RESPONSE', data?.error?.message ?? 'The account request could not be completed.');
    }
    return data.data;
  }
  return {
    requestDeletion(confirm: boolean) { return request<DeletionResult>('/account/deletion-request', 'POST', {confirm}, true); },
    // This creates a request. It never restores the account or issues a login token.
    requestCancellation(email: string, password: string) { return request<RecoveryRequest>('/account/deletion-cancel', 'POST', {email, password}, false); },
    pendingRecoveries() { return request<RecoveryReviewItem[]>('/moderation/account-recovery-requests', 'GET', undefined, true); },
    restoreAccount(uid: string, revision: number) { return request<RestoredResult>(`/moderation/accounts/${encodeURIComponent(uid)}/restore`, 'POST', {revision}, true); },
  };
}
export const accountLifecycleService = createAccountLifecycleService();
