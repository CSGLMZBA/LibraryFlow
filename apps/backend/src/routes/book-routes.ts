import { Router } from "express";
import {
  createBook,
  getBookDetails,
  listApprovedBooks,
  updateBook,
} from "../controllers/book-controller.js";
import {
  addComment,
  listComments,
} from "../controllers/comment-controller.js";

export const bookRouter = Router();

bookRouter.get("/", listApprovedBooks);
bookRouter.post("/", createBook);
bookRouter.get("/:bookId", getBookDetails);
bookRouter.patch("/:bookId", updateBook);
bookRouter.get("/:bookId/comments", listComments);
bookRouter.post("/:bookId/comments", addComment);
