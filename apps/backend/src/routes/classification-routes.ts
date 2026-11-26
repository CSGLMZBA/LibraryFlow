import { Router, type RequestHandler } from "express";
import {
  createClassification,
  listClassifications,
  updateClassification,
} from "../controllers/classification-controller.js";
import { moderatorGuard } from "../middleware/moderator-guard.js";

/** Reading is public; creating or renaming classifications is moderator-only (SPEC-001). */
export function createClassificationRouter(guard: RequestHandler = moderatorGuard) {
  const router = Router();
  router.get("/", listClassifications);
  router.post("/", guard, createClassification);
  router.patch("/:id", guard, updateClassification);
  return router;
}

export const classificationRouter = createClassificationRouter();
