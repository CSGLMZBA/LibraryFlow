import type { Response } from "express";
import { BookStoreError } from "../repositories/book-repository.js";
import { CommentStoreError } from "../repositories/comment-repository.js";
import { NotificationStoreError } from "../repositories/notification-repository.js";

/** Reports durable-storage failures as 503 without exposing provider details. Returns true when handled. */
export function sendStoreUnavailable(response: Response, error: unknown): boolean {
  if (!(error instanceof BookStoreError || error instanceof CommentStoreError || error instanceof NotificationStoreError)) {
    return false;
  }
  response.status(503).json({
    success: false,
    error: { code: "STORAGE_UNAVAILABLE", message: error.message },
  });
  return true;
}
