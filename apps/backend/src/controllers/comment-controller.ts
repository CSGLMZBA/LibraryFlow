import type { Request, Response } from "express";
import { commentService } from "../services/comment-service.js";

function sendError(response: Response, error: unknown): void {
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
    const authorId = request.headers["x-user-id"] as string;
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
