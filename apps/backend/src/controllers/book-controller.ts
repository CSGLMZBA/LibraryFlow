import type { Request, Response } from "express";
import type { BookFilterQuery } from "@library-flow/shared";
import {
  bookService,
  RevisionConflictError,
} from "../services/book-service.js";
import { PublicVisibilityUnavailableError } from "../services/public-content-visibility.js";
import { DuplicateBookError } from "../repositories/book-repository.js";
import { sendStoreUnavailable } from "./store-errors.js";

function sendError(response: Response, error: unknown): void {
  if (sendStoreUnavailable(response, error)) return;
  if (error instanceof DuplicateBookError) {
    response.status(409).json({
      success: false,
      error: { code: "DUPLICATE_RESOURCE", message: error.message, field: "title" },
    });
    return;
  }
  if (error instanceof PublicVisibilityUnavailableError) {
    console.error(`[public-content] Visibility verification unavailable: ${error.cause instanceof Error ? error.cause.name : typeof error.cause}`);
    response.status(503).json({success: false, error: {code: "VISIBILITY_UNAVAILABLE", message: error.message}});
    return;
  }
  if (error instanceof RevisionConflictError) {
    response.status(409).json({
      success: false,
      error: {
        code: "REVISION_CONFLICT",
        message: "The record changed. Reload it before retrying.",
      },
      data: {
        resourceId: error.resourceId,
        serverRevision: error.serverRevision,
        serverValue: error.serverValue,
      },
    });
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

export async function listApprovedBooks(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const books = await bookService.getApprovedCatalog(
      request.query as BookFilterQuery,
    );
    response.json({ success: true, data: books });
  } catch (error) {
    sendError(response, error);
  }
}

export async function listMyBooks(
  _request: Request,
  response: Response,
): Promise<void> {
  try {
    const books = await bookService.listOwnedBooks(response.locals.auth.uid as string);
    response.json({ success: true, data: books });
  } catch (error) {
    sendError(response, error);
  }
}

export async function createBook(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const ownerId = response.locals.auth.uid as string;
    const book = await bookService.createBook(request.body, ownerId);
    response.status(201).json({ success: true, data: book });
  } catch (error) {
    sendError(response, error);
  }
}

export async function getBookDetails(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const book = await bookService.getBookDetails(
      request.params.bookId as string,
      response.locals.auth?.uid as string | undefined,
      response.locals.auth?.role === "moderator",
    );
    response.json({ success: true, data: book });
  } catch (error) {
    sendError(response, error);
  }
}

export async function updateBook(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const book = await bookService.updateBookMetadata(
      request.params.bookId as string,
      request.body,
      response.locals.auth.uid as string,
      response.locals.auth.role === "moderator",
    );
    response.json({ success: true, data: book });
  } catch (error) {
    sendError(response, error);
  }
}

export async function deleteBook(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const book = await bookService.deleteBook(
      request.params.bookId as string,
      response.locals.auth.uid as string,
    );
    response.json({ success: true, data: book });
  } catch (error) {
    sendError(response, error);
  }
}
