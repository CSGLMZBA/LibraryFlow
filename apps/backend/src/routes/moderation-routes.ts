import { Router } from "express";
import { moderatorGuard } from "../middleware/moderator-guard.js";
import {
  approveBook,
  listPendingBooks,
  rejectBook,
  removeComment,
} from "../controllers/moderation-controller.js";

export const moderationRouter = Router();

moderationRouter.get("/books/pending", moderatorGuard, listPendingBooks);
moderationRouter.post("/books/:bookId/approve", moderatorGuard, approveBook);
moderationRouter.post("/books/:bookId/reject", moderatorGuard, rejectBook);
moderationRouter.delete("/comments/:commentId", moderatorGuard, removeComment);
