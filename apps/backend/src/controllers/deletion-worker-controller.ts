import type { Request, Response } from "express";
import { deletionJobService } from "../services/deletion-job-service.js";

/** POST /internal/deletion-jobs/run: processes due deletion jobs (S2-T08). */
export async function runDeletionJobs(_request: Request, response: Response): Promise<void> {
  try {
    const data = await deletionJobService.runDueJobs();
    response.json({ success: true, data });
  } catch (error) {
    console.error(`[deletion-worker] Run failed: ${error instanceof Error ? error.name : typeof error}`);
    response.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "The deletion worker run failed." },
    });
  }
}
