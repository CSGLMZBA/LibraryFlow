import { useEffect, useRef, useState } from "react";
import type { InAppNotification } from "@library-flow/shared";
import { notificationInboxService } from "../services/notification-inbox-service";

export function NotificationInbox({ userId }: { userId: string }) {
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const generation = useRef(0);
  const busy = useRef(false);

  async function refresh() {
    if (busy.current) return;
    busy.current = true;
    const started = generation.current;
    setLoading(true);
    setError(null);
    try {
      const notifications = await notificationInboxService.list(userId);
      if (started === generation.current) setItems(notifications);
    } catch (cause) {
      if (started === generation.current) {
        setItems([]);
        setError(cause instanceof Error ? cause.message : "Could not load notifications.");
      }
    } finally {
      if (started === generation.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }
  useEffect(() => {
    ++generation.current;
    setItems([]);
    setUpdating(false);
    void refresh();
    return () => { ++generation.current; busy.current = false; };
  }, [userId]);

  async function markRead(id: string) {
    if (busy.current) return;
    busy.current = true;
    const started = generation.current;
    setUpdating(true);
    setError(null);
    try {
      await notificationInboxService.markRead(userId, id);
      if (started === generation.current) setItems(previous => previous.map(item => item.id === id ? {...item, read: true} : item));
    } catch (cause) {
      if (started === generation.current) setError(cause instanceof Error ? cause.message : "Could not update the notification.");
    } finally {
      if (started === generation.current) {
        busy.current = false;
        setUpdating(false);
      }
    }
  }

  return <section aria-labelledby="notifications-title" className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex items-center justify-between gap-3">
      <h2 id="notifications-title" className="font-semibold">Notifications</h2>
      <button type="button" onClick={() => void refresh()} disabled={loading || updating} className="text-sm text-indigo-700 underline">Refresh</button>
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {loading ? <p role="status" className="mt-2 text-sm">Loading notifications...</p> :
      !error && items.length === 0 ? <p className="mt-2 text-sm text-slate-600">No notifications.</p> :
      <ul className="mt-2 space-y-2">{items.map(item => <li key={item.id} className="rounded border border-slate-200 p-3 text-sm">
        <p>{item.message}</p><p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
        {!item.read && <button type="button" onClick={() => void markRead(item.id)} disabled={updating} className="mt-2 text-indigo-700 underline">Mark as read</button>}
      </li>)}</ul>}
  </section>;
}
