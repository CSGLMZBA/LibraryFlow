import { useEffect, useState } from "react";
import type { InAppNotification } from "@library-flow/shared";
import { notificationInboxService } from "../services/notification-inbox-service";

export function NotificationInbox() {
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setItems(await notificationInboxService.list());
    } catch (cause) {
      setItems([]);
      setError(cause instanceof Error ? cause.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {void refresh();}, []);

  async function markRead(id: string) {
    setError(null);
    try {
      await notificationInboxService.markRead(id);
      setItems(previous => previous.map(item => item.id === id ? {...item, read: true} : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the notification.");
    }
  }

  return <section aria-labelledby="notifications-title" className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex items-center justify-between gap-3">
      <h2 id="notifications-title" className="font-semibold">Notifications</h2>
      <button type="button" onClick={() => void refresh()} disabled={loading} className="text-sm text-indigo-700 underline">Refresh</button>
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {loading ? <p role="status" className="mt-2 text-sm">Loading notifications...</p> :
      !error && items.length === 0 ? <p className="mt-2 text-sm text-slate-600">No notifications.</p> :
      <ul className="mt-2 space-y-2">{items.map(item => <li key={item.id} className="rounded border border-slate-200 p-3 text-sm">
        <p>{item.message}</p><p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
        {!item.read && <button type="button" onClick={() => void markRead(item.id)} className="mt-2 text-indigo-700 underline">Mark as read</button>}
      </li>)}</ul>}
  </section>;
}
