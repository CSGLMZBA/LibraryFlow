/**
 * Authentication for internal worker routes (SPEC-002 §5.1, S2-T08).
 * Accepts only `Authorization: Bearer <DELETION_WORKER_SECRET>`, compared in
 * constant time. Never used for browser requests.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const MIN_WORKER_SECRET_LENGTH = 32;

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

/** True only when `authorization` is exactly `Bearer <secret>` for a long enough secret. */
export function isWorkerAuthorized(
  authorization: string | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || secret.length < MIN_WORKER_SECRET_LENGTH || !authorization?.startsWith("Bearer ")) {
    return false;
  }
  return timingSafeEqual(digest(authorization.slice("Bearer ".length)), digest(secret));
}

/** Rejects the request unless it carries the worker secret. */
export function requireWorkerSecret(request: Request, response: Response, next: NextFunction): void {
  const secret = process.env.DELETION_WORKER_SECRET?.trim();
  if (!secret || secret.length < MIN_WORKER_SECRET_LENGTH) {
    response.status(503).json({
      success: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "The deletion worker is not configured." },
    });
    return;
  }
  if (!isWorkerAuthorized(request.headers.authorization, secret)) {
    response.status(401).json({
      success: false,
      error: { code: "AUTH_REQUIRED", message: "Worker authentication is required." },
    });
    return;
  }
  next();
}
