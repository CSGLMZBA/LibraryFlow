import { Router, type RequestHandler } from "express";
import {
  getMyApplications,
  submitApplication,
  withdrawApplication,
} from "../controllers/publisher-application-controller.js";
import { readerGuard } from "../middleware/identity.js";

export function createPublisherApplicationRouter(guard: RequestHandler = readerGuard) {
  const router = Router();

  router.post("/", guard, submitApplication);
  router.get("/me", guard, getMyApplications);
  router.post("/:id/withdraw", guard, withdrawApplication);
  return router;
}

export const publisherApplicationRouter = createPublisherApplicationRouter();
