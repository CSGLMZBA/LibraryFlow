import type { InAppNotification } from "@library-flow/shared";
import { authService } from "./auth-service";
import { AuthError } from "../types/auth";

type AuthConsumer = Pick<typeof authService, "getCurrentSession" | "getAccessToken">;
const base = ((import.meta as ImportMeta & {env?: {VITE_API_BASE_URL?: string}}).env?.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export function createNotificationInboxService(auth: AuthConsumer = authService, apiBase = base, transport: typeof fetch = fetch) {
  async function request<T>(uid: string, path: string, method: "GET" | "POST"): Promise<T> {
    const session = await auth.getCurrentSession();
    const token = auth.getAccessToken();
    if (!session || session.user.id !== uid || !token) {
      throw new AuthError("AUTH_REQUIRED", "The account session changed. Sign in again to view notifications.");
    }
    let response: Response;
    try {
      response = await transport(`${apiBase.replace(/\/$/, "")}/api/v1/notifications${path}`, {
        method, headers: {Authorization: `Bearer ${token}`}, cache: "no-store",
      });
    } catch {
      throw new AuthError("NOTIFICATIONS_UNAVAILABLE", "Cannot reach notifications. Try again.");
    }
    const envelope = await response.json().catch(() => null) as {success?: boolean; data?: T; error?: {code?: string; message?: string}} | null;
    if (!response.ok || !envelope?.success || envelope.data === undefined) {
      throw new AuthError(envelope?.error?.code ?? "INVALID_RESPONSE", envelope?.error?.message ?? "Could not load notifications.");
    }
    return envelope.data;
  }
  return {
    list: (uid: string) => request<InAppNotification[]>(uid, "", "GET"),
    markRead: (uid: string, id: string) => request<{read: true}>(uid, `/${encodeURIComponent(id)}/read`, "POST"),
  };
}
export const notificationInboxService = createNotificationInboxService();
