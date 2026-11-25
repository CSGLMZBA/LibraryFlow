import { Router } from "express";
import {
  createBook,
  getBookDetails,
  listApprovedBooks,
  updateBook,
} from "../controllers/book-controller.js";
import {
  completeBookFileUpload,
  createBookFileDownloadUrl,
  createBookFileUploadUrl,
} from "../controllers/book-file-controller.js";
import {
  addComment,
  listComments,
} from "../controllers/comment-controller.js";
import {
  optionalAuth,
  publisherGuard,
  requireAuth,
} from "../middleware/identity.js";

export const bookRouter = Router();

bookRouter.get("/", listApprovedBooks);
bookRouter.post("/", publisherGuard, createBook);
bookRouter.get("/:bookId", optionalAuth, getBookDetails);
bookRouter.patch("/:bookId", requireAuth, updateBook);
bookRouter.post("/:bookId/file/upload-url", publisherGuard, createBookFileUploadUrl);
bookRouter.post("/:bookId/file/complete", publisherGuard, completeBookFileUpload);
bookRouter.get("/:bookId/file/download-url", requireAuth, createBookFileDownloadUrl);
bookRouter.get("/:bookId/comments", listComments);
bookRouter.post("/:bookId/comments", requireAuth, addComment);
