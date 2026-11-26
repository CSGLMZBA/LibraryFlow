/**
 * Internal operations routes (SPEC-002 §5.1, S2-T08). Not for browsers.
 * Called by the scheduled GitHub Action with DELETION_WORKER_SECRET.
 */
import { Router } from "express";
import { runDeletionJobs } from "../controllers/deletion-worker-controller.js";
import { expireDueApplications } from "../controllers/publisher-application-controller.js";
import { requireWorkerSecret } from "../middleware/worker-secret.js";

export const internalRouter = Router();

internalRouter.post("/deletion-jobs/run", requireWorkerSecret, runDeletionJobs);
internalRouter.post("/publisher-applications/expire", requireWorkerSecret, expireDueApplications);
