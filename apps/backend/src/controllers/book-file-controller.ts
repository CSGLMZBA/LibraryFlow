import type { Request, Response } from "express";
import {
  BookFileError,
  bookFileService,
  type BookFileRequester,
} from "../services/book-file-service.js";
import { RevisionConflictError } from "../services/book-service.js";
import { StorageUnavailableError } from "../services/storage-service.js";
import { DeletionScheduleError } from "../services/deletion-job-service.js";
import { PublicVisibilityUnavailableError } from "../services/public-content-visibility.js";

function requesterFrom(response: Response): BookFileRequester {
  const auth = response.locals.auth as BookFileRequester;
  return { uid: auth.uid, role: auth.role };
}

/** Maps book file errors to the SPEC-002 §1 envelope without leaking URLs or keys. */
export function sendBookFileError(response: Response, error: unknown): void {
  if (error instanceof PublicVisibilityUnavailableError) {
    console.error(`[public-content] Visibility verification unavailable: ${error.cause instanceof Error ? error.cause.name : typeof error.cause}`);
    response.status(503).json({success: false, error: {code: "VISIBILITY_UNAVAILABLE", message: error.message}});
    return;
  }
  if (error instanceof BookFileError) {
    response.status(error.status).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.field ? { field: error.field } : {}),
      },
    });
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

  if (error instanceof DeletionScheduleError) {
    response.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: error.message },
    });
    return;
  }

  if (error instanceof StorageUnavailableError) {
    console.error(`[book-files] ${error.message}`);
  } else {
    console.error(
      `[book-files] Unexpected error: ${error instanceof Error ? error.name : typeof error}`,
    );
  }
  response.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "The book file service is unavailable. Try again later.",
    },
  });
}

export async function createBookFileUploadUrl(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const data = await bookFileService.createUploadUrl(
      request.params.bookId as string,
      requesterFrom(response),
      request.body,
    );
    response.json({ success: true, data });
  } catch (error) {
    sendBookFileError(response, error);
  }
}

export async function completeBookFileUpload(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const data = await bookFileService.completeUpload(
      request.params.bookId as string,
      requesterFrom(response),
      request.body,
    );
    response.json({ success: true, data });
  } catch (error) {
    sendBookFileError(response, error);
  }
}

export async function createBookFileDownloadUrl(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const data = await bookFileService.createDownloadUrl(
      request.params.bookId as string,
      requesterFrom(response),
    );
    response.json({ success: true, data });
  } catch (error) {
    sendBookFileError(response, error);
  }
}
