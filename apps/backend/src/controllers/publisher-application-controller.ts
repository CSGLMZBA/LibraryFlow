import type { Request, Response } from "express";
import { publisherApplicationService } from "../services/publisher-application-service.js";
import { ApplicationRevisionConflictError } from "../repositories/publisher-application-repository.js";

function sendError(response: Response, error: unknown): void {
  if (error instanceof ApplicationRevisionConflictError) {
    response.status(409).json({
      success: false,
      error: { code: "REVISION_CONFLICT", message: error.message },
      data: {
        resourceId: error.application.id,
        serverRevision: error.application.revision,
        serverValue: error.application,
      },
    });
    return;
  }
  const message = error instanceof Error ? error.message : "Invalid request.";
  const errorResponse = {
    success: false as const,
    error: { code: "INVALID_REQUEST", message },
  };

  if (message === "DUPLICATE_ACTIVE_APPLICATION") {
    response.status(409).json({
      success: false,
      error: {
        code: "DUPLICATE_RESOURCE",
        message:
          "An active publisher application is already pending or approved.",
      },
    });
    return;
  }

  if (message === "APPLICATION_NOT_FOUND") {
    response.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Publisher application not found." },
    });
    return;
  }

  if (message === "FORBIDDEN") {
    response.status(403).json({
      success: false,
      error: { code: "FORBIDDEN", message: "You cannot modify this application." },
    });
    return;
  }

  if (message === "INVALID_STATE") {
    response.status(409).json({
      success: false,
      error: {
        code: "INVALID_STATE",
        message: "The publisher application is not pending.",
      },
    });
    return;
  }

  response.status(400).json(errorResponse);
}

function revisionFromBody(body: unknown): number {
  if (!body || typeof body !== "object" || !("revision" in body) ||
      typeof body.revision !== "number" || !Number.isSafeInteger(body.revision) || body.revision < 1) {
    throw new Error("A positive integer revision is required.");
  }
  return body.revision;
}

export async function submitApplication(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const data = await publisherApplicationService.submitApplication(
      response.locals.auth.uid as string,
      request.body,
    );
    response.status(201).json({ success: true, data });
  } catch (error) {
    sendError(response, error);
  }
}

export async function getMyApplications(
  _request: Request,
  response: Response,
): Promise<void> {
  try {
    const data = await publisherApplicationService.getMyApplications(
      response.locals.auth.uid as string,
    );
    response.json({ success: true, data });
  } catch (error) {
    sendError(response, error);
  }
}

export async function withdrawApplication(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const data = await publisherApplicationService.withdrawApplication(
      request.params.id as string,
      response.locals.auth.uid as string,
      revisionFromBody(request.body),
    );
    response.json({ success: true, data });
  } catch (error) {
    sendError(response, error);
  }
}

export async function listPendingApplications(
  _request: Request,
  response: Response,
): Promise<void> {
  try {
    const data = await publisherApplicationService.getPendingApplications();
    response.json({ success: true, data });
  } catch (error) {
    sendError(response, error);
  }
}

export async function approveApplication(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const data = await publisherApplicationService.approveApplication(
      request.params.id as string,
      response.locals.auth.uid as string,
    );
    response.json({ success: true, data });
  } catch (error) {
    sendError(response, error);
  }
}

export async function rejectApplication(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const revision = revisionFromBody(request.body);
    if (typeof request.body.decisionReason !== "string") {
      throw new Error("A decision reason is required.");
    }
    const data = await publisherApplicationService.rejectApplication(
      request.params.id as string,
      response.locals.auth.uid as string,
      request.body.decisionReason,
      revision,
    );
    response.json({ success: true, data });
  } catch (error) {
    sendError(response, error);
  }
}

export async function revokePublisher(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const publisherUid = request.params.uid as string;
    await publisherApplicationService.revokePublisher(
      publisherUid,
      response.locals.auth.uid as string,
      request.body.decisionReason,
    );
    response.json({
      success: true,
      data: { uid: publisherUid, role: "reader" },
    });
  } catch (error) {
    sendError(response, error);
  }
}
