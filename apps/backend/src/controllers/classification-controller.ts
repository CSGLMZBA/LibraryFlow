import type { Request, Response } from "express";
import { classificationService } from "../services/classification-service.js";

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

export function listClassifications(
  _request: Request,
  response: Response,
): void {
  try {
    const data = classificationService.listClassifications();
    response.json({ success: true, data });
  } catch (error) {
    sendError(response, error);
  }
}

export function createClassification(
  request: Request,
  response: Response,
): void {
  try {
    const data = classificationService.createClassification(request.body);
    response.status(201).json({ success: true, data });
  } catch (error) {
    sendError(response, error);
  }
}

export function updateClassification(
  request: Request,
  response: Response,
): void {
  try {
    const data = classificationService.updateClassification(
      request.params.id as string,
      request.body.type,
      request.body,
    );
    response.json({ success: true, data });
  } catch (error) {
    sendError(response, error);
  }
}
