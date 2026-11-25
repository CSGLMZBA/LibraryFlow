import type { Request, Response } from "express";
import { publisherApplicationService } from "../services/publisher-application-service.js";

function sendError(response: Response, error: unknown): void {
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
    const data = await publisherApplicationService.rejectApplication(
      request.params.id as string,
      response.locals.auth.uid as string,
      request.body.decisionReason,
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
