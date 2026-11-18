import type { NextFunction, Request, Response } from "express";
import { createAuthGuard } from "./auth-guard.js";
import { verifyFirebaseIdentity } from "../services/firebase-auth-service.js";

export const requireAuth = createAuthGuard(verifyFirebaseIdentity);
export const publisherGuard = createAuthGuard(
  verifyFirebaseIdentity,
  "publisher",
);

export async function optionalAuth(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (token) {
    try {
      const identity = await verifyFirebaseIdentity(token);
      if (identity) {
        response.locals.auth = identity;
      }
    } catch {
      // Invalid optional credentials continue as anonymous.
    }
  }

  next();
}
