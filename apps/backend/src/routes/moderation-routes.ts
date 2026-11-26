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
} from "../controllers/publisher-application-controller.js";
import { deleteBook } from "../controllers/book-controller.js";

export function createModerationRouter(guard: RequestHandler = moderatorGuard) {
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
    publisherRoleChangeUnavailable,
  );
  moderationRouter.post(
    "/publisher-applications/:id/reject",
    guard,
    rejectApplication,
  );
  moderationRouter.post(
    "/publishers/:uid/revoke",
    guard,
    publisherRoleChangeUnavailable,
  );
  return moderationRouter;
}

export const moderationRouter = createModerationRouter();
