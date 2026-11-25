import {useCallback, useEffect, useState} from 'react';
import {accountLifecycleService, type RecoveryReviewItem} from '../services/account-lifecycle-service';

/** Backend enforces moderator access even if this panel is mounted elsewhere. */
export function AccountRecoveryRequests() {
  const [items, setItems] = useState<RecoveryReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {setItems(await accountLifecycleService.pendingRecoveries());}
    catch (failure) {setError(failure instanceof Error ? failure.message : 'Recovery requests could not be loaded.');}
    finally {setLoading(false);}
  }, []);
  useEffect(() => {
    void load();
    const updateConnection = () => setOffline(!navigator.onLine);
    window.addEventListener('online', updateConnection); window.addEventListener('offline', updateConnection);
    return () => {window.removeEventListener('online', updateConnection); window.removeEventListener('offline', updateConnection);};
  }, [load]);
  async function approve(item: RecoveryReviewItem) {
    if (!window.confirm('Approve this account restoration? The user will need to sign in again.')) return;
    setBusy(item.id); setError(null); setNotice(null);
    try {
      await accountLifecycleService.restoreAccount(item.targetUid, item.accountRevision);
      setNotice('Restoration approved. The user must sign in again.');
      await load();
    } catch (failure) {setError(failure instanceof Error ? failure.message : 'Approval failed. Reload before retrying.');}
    finally {setBusy(null);}
  }
  return <section aria-labelledby="account-recovery-heading" className="mt-6 rounded-lg border border-slate-300 p-4">
    <h2 id="account-recovery-heading" className="text-lg font-semibold">Account recovery requests</h2>
    <p className="mt-1 text-sm">Users remain restricted until a moderator approves. Up to 100 pending requests are shown.</p>
    {offline && <p role="status" className="mt-2">Offline. Reconnect to load or approve requests.</p>}
    {notice && <p role="status" className="mt-2">{notice}</p>}
    {error && <p role="alert" className="mt-2">{error}</p>}
    <button type="button" onClick={() => void load()} disabled={loading || offline || busy !== null}
      className="my-3 rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60">Reload requests</button>
    {loading ? <p role="status">Loading recovery requests...</p> : !error && items.length === 0 ? <p>No pending recovery requests.</p> :
      <ul className="space-y-3">{items.map(item => <li key={item.id} className="rounded border p-3">
        <p className="break-all">Account: {item.targetUid}</p>
        <p className="text-sm">Deletion deadline: {new Date(item.permanentDeletionAt).toLocaleString()}</p>
        {!item.canRestore && <p className="text-sm">Cleanup is incomplete, the deadline has passed, or the deletion worker has started. Approval is blocked.</p>}
        <button type="button" onClick={() => void approve(item)} disabled={!item.canRestore || offline || busy !== null}
          className="mt-2 rounded bg-indigo-600 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60">
          {busy === item.id ? 'Approving...' : 'Approve restoration'}
        </button>
      </li>)}</ul>}
  </section>;
}
