import type { Request, Response } from "express";
import { moderationService } from "../services/moderation-service.js";
import { sendStoreUnavailable } from "./store-errors.js";

function sendError(response: Response, error: unknown): void {
  if (sendStoreUnavailable(response, error)) return;
  const message = error instanceof Error ? error.message : "Invalid request.";
  response.status(400).json({
    success: false,
    error: { code: "INVALID_REQUEST", message },
  });
}

export async function listPendingBooks(
  _request: Request,
  response: Response,
): Promise<void> {
  try {
    const books = await moderationService.getPendingBooks();
    response.json({ success: true, data: books });
  } catch (error) {
    sendError(response, error);
  }
}

export async function approveBook(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const data = await moderationService.approveBook(
      request.params.bookId as string,
      response.locals.auth.uid as string,
    );
    response.json({ success: true, data });
  } catch (error) {
    sendError(response, error);
  }
}

export async function rejectBook(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const data = await moderationService.rejectBook(
      request.params.bookId as string,
      request.body.reason,
      response.locals.auth.uid as string,
    );
    response.json({ success: true, data });
  } catch (error) {
    sendError(response, error);
  }
}

export async function removeComment(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const data = await moderationService.removeComment(
      request.params.commentId as string,
      request.body.reason,
      response.locals.auth.uid as string,
    );
    response.json({ success: true, data });
  } catch (error) {
    sendError(response, error);
  }
}
