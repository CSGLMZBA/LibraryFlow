import { Router } from "express";
import { moderatorGuard } from "../middleware/moderator-guard.js";
import {
  approveBook,
  listPendingBooks,
  rejectBook,
  removeComment,
} from "../controllers/moderation-controller.js";
import {
  approveApplication,
  listPendingApplications,
  rejectApplication,
  revokePublisher,
} from "../controllers/publisher-application-controller.js";

export const moderationRouter = Router();

moderationRouter.get("/books/pending", moderatorGuard, listPendingBooks);
moderationRouter.post("/books/:bookId/approve", moderatorGuard, approveBook);
moderationRouter.post("/books/:bookId/reject", moderatorGuard, rejectBook);
moderationRouter.delete("/comments/:commentId", moderatorGuard, removeComment);
moderationRouter.get(
  "/publisher-applications",
  moderatorGuard,
  listPendingApplications,
);
moderationRouter.post(
  "/publisher-applications/:id/approve",
  moderatorGuard,
  approveApplication,
);
moderationRouter.post(
  "/publisher-applications/:id/reject",
  moderatorGuard,
  rejectApplication,
);
moderationRouter.post(
  "/publishers/:uid/revoke",
  moderatorGuard,
  revokePublisher,
);
