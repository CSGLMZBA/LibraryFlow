import { Router, type RequestHandler } from "express";
import { moderatorGuard } from "../middleware/moderator-guard.js";
import {
  approveBook,
  listPendingBooks,
  rejectBook,
  removeComment,
} from "../controllers/moderation-controller.js";
import {
  listPendingApplications,
  rejectApplication,
  approveApplication,
  revokePublisher,
} from "../controllers/publisher-application-controller.js";
import { deleteBook } from "../controllers/book-controller.js";

export function createModerationRouter(
  guard: RequestHandler = moderatorGuard,
  roleChangesEnabled = process.env.ENABLE_CLOUD_PUBLISHER_APPLICATIONS === "true",
) {
  const moderationRouter = Router();

  const publisherRoleChangeUnavailable: RequestHandler = (_request, response) => {
    response.status(503).json({
      success: false,
      error: {
        code: "FEATURE_UNAVAILABLE",
        message: "Publisher role changes are temporarily unavailable.",
      },
    });
  };
  const approveHandler = roleChangesEnabled ? approveApplication : publisherRoleChangeUnavailable;
  const revokeHandler = roleChangesEnabled ? revokePublisher : publisherRoleChangeUnavailable;

  moderationRouter.get("/books/pending", guard, listPendingBooks);
  moderationRouter.post("/books/:bookId/approve", guard, approveBook);
  moderationRouter.post("/books/:bookId/reject", guard, rejectBook);
  moderationRouter.delete("/books/:bookId", guard, deleteBook);
  moderationRouter.delete("/comments/:commentId", guard, removeComment);
  moderationRouter.get(
    "/publisher-applications",
    guard,
    listPendingApplications,
  );
  moderationRouter.post(
    "/publisher-applications/:id/approve",
    guard,
    approveHandler,
  );
  moderationRouter.post(
    "/publisher-applications/:id/reject",
    guard,
    rejectApplication,
  );
  moderationRouter.post(
    "/publishers/:uid/revoke",
    guard,
    revokeHandler,
  );
  return moderationRouter;
}

export const moderationRouter = createModerationRouter();
