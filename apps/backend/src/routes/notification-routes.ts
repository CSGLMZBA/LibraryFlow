import { Router } from "express";
import { createAuthGuard, type VerifySessionToken } from "../middleware/auth-guard.js";
import { verifyFirebaseIdentity } from "../services/firebase-auth-service.js";
import { notificationInbox, type NotificationInbox } from "../services/notification-inbox.js";

export function createNotificationRouter(
  verify: VerifySessionToken = verifyFirebaseIdentity,
  inbox: NotificationInbox = notificationInbox,
) {
  const router = Router();
  router.use((_req, res, next) => {res.setHeader("Cache-Control", "no-store"); next();});
  router.use(createAuthGuard(verify));
  router.get("/", async (_req, res) => {
    try {
      res.json({success: true, data: await inbox.list(res.locals.auth.uid)});
    } catch (error) {
      console.error(`[notifications] Inbox unavailable: ${error instanceof Error ? error.name : typeof error}`);
      res.status(503).json({success: false, error: {code: "NOTIFICATIONS_UNAVAILABLE", message: "Notifications are unavailable. Try again."}});
    }
  });
  router.post("/:id/read", async (req, res) => {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    if (!id || id.length > 200 || id.includes("/")) {
      res.status(400).json({success: false, error: {code: "VALIDATION_ERROR", message: "Invalid notification ID."}});
      return;
    }
    try {
      const updated = await inbox.markRead(res.locals.auth.uid, id);
      if (!updated) {
        res.status(404).json({success: false, error: {code: "NOT_FOUND", message: "Notification not found."}});
        return;
      }
      res.json({success: true, data: {read: true}});
    } catch (error) {
      console.error(`[notifications] Mark read failed: ${error instanceof Error ? error.name : typeof error}`);
      res.status(503).json({success: false, error: {code: "NOTIFICATIONS_UNAVAILABLE", message: "Notifications are unavailable. Try again."}});
    }
  });
  return router;
}

export const notificationRouter = createNotificationRouter();
