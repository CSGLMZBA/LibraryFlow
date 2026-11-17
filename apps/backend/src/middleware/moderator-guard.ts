import type { NextFunction, Request, Response } from "express";
import { SEEDED_MODERATOR } from "../utils/seeded-accounts.js";

export function moderatorGuard(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (
    request.headers["x-user-role"] === "moderator" ||
    request.headers["x-user-id"] === SEEDED_MODERATOR.id
  ) {
    next();
    return;
  }

  response.status(403).json({
    success: false,
    error: {
      code: "FORBIDDEN",
      message: "Moderator role required.",
    },
  });
}
