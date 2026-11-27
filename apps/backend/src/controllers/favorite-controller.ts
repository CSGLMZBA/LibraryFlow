import type { Request, Response } from "express";
import { favoriteService } from "../services/favorite-service.js";

function sendError(response: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Invalid request.";
  const notFound = /not found|not available/i.test(message);
  response.status(notFound ? 404 : 400).json({
    success: false,
    error: {
      code: notFound ? "NOT_FOUND" : "VALIDATION_ERROR",
      message,
    },
  });
}

export async function addFavorite(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const readerUid = response.locals.auth?.uid as string;
    const bookId = request.params.bookId as string;
    const favorite = await favoriteService.addFavorite(readerUid, bookId);
    response.status(200).json({ success: true, data: favorite });
  } catch (error) {
    sendError(response, error);
  }
}

export async function removeFavorite(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const readerUid = response.locals.auth?.uid as string;
    const bookId = request.params.bookId as string;
    await favoriteService.removeFavorite(readerUid, bookId);
    response.status(200).json({ success: true, data: { removed: true } });
  } catch (error) {
    sendError(response, error);
  }
}

export async function listFavorites(
  _request: Request,
  response: Response,
): Promise<void> {
  try {
    const readerUid = response.locals.auth?.uid as string;
    const favorites = await favoriteService.getFavorites(readerUid);
    response.status(200).json({ success: true, data: favorites });
  } catch (error) {
    sendError(response, error);
  }
}
