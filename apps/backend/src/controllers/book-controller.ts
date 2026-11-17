import type { Request, Response } from "express";
import type { BookFilterQuery } from "@library-flow/shared";
import { bookService } from "../services/book-service.js";

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

export async function createBook(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const ownerId = request.headers["x-user-id"] as string;
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
      request.headers["x-user-id"] as string,
      request.headers["x-user-role"] === "moderator",
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
      request.headers["x-user-id"] as string,
      request.headers["x-user-role"] === "moderator",
    );
    response.json({ success: true, data: book });
  } catch (error) {
    sendError(response, error);
  }
}
