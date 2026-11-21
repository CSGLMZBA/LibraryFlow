import { Router } from "express";
import {
  getMyApplications,
  submitApplication,
  withdrawApplication,
} from "../controllers/publisher-application-controller.js";
import { requireAuth } from "../middleware/identity.js";

export const publisherApplicationRouter = Router();

publisherApplicationRouter.post("/", requireAuth, submitApplication);
publisherApplicationRouter.get("/me", requireAuth, getMyApplications);
publisherApplicationRouter.post(
  "/:id/withdraw",
  requireAuth,
  withdrawApplication,
);
