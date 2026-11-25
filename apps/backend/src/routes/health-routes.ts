import type { HealthResponse } from "@library-flow/shared";
import type { Request, Response } from "express";

/** Body of GET /health (SPEC-002 §8). Unauthenticated; no secrets or state. */
export const HEALTH_RESPONSE: HealthResponse = {
  status: "ok",
  service: "library-flow-api",
};

/**
 * GET /health. Registered before any auth middleware. The process answers only
 * after `app.listen` succeeds, so HTTP 200 means it is ready to serve.
 */
export function healthHandler(_request: Request, response: Response): void {
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(HEALTH_RESPONSE);
}
