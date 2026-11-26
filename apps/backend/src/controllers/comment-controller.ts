import type { Request, Response } from "express";
import { commentService } from "../services/comment-service.js";
import { PublicVisibilityUnavailableError } from "../services/public-content-visibility.js";
import { sendStoreUnavailable } from "./store-errors.js";

function sendError(response: Response, error: unknown): void {
  if (sendStoreUnavailable(response, error)) return;
  if (error instanceof PublicVisibilityUnavailableError) {
    console.error(`[public-content] Visibility verification unavailable: ${error.cause instanceof Error ? error.cause.name : typeof error.cause}`);
    response.status(503).json({success: false, error: {code: "VISIBILITY_UNAVAILABLE", message: error.message}});
    return;
  }
  const message = error instanceof Error ? error.message : "Invalid request.";
  response.status(400).json({
    success: false,
    error: {
      code: "INVALID_REQUEST",
      message,
    },
  });
}

export async function listComments(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const comments = await commentService.getCommentsForBook(
      request.params.bookId as string,
    );
    response.json({ success: true, data: comments });
  } catch (error) {
    sendError(response, error);
  }
}

export async function addComment(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const authorId = response.locals.auth.uid as string;
    // TODO: Read display name from the verified identity once it is available.
    const authorDisplayName = request.headers[
      "x-user-display-name"
    ] as string;
    const comment = await commentService.addComment(
      request.params.bookId as string,
      request.body.content,
      authorId,
      authorDisplayName,
    );
    response.status(201).json({ success: true, data: comment });
  } catch (error) {
    sendError(response, error);
  }
}
