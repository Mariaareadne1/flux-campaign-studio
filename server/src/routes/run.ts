import { Router } from "express";
import type { Job, RunRequest } from "../../../shared/types";
import { getJob, startCampaign } from "../agent/executor";

/**
 * Campaign run routes.
 *   POST /api/run       -> start a hardcoded campaign for an uploaded image
 *   GET  /api/run/:id   -> current job state (client polls this ~1x/sec)
 *
 * Phase 2 replaces the GET poll with a Server-Sent Events stream.
 */
export const runRouter = Router();

runRouter.post("/", (req, res) => {
  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ error: "Server is missing BFL_API_KEY. Add it to server .env." });
  }

  const body = (req.body ?? {}) as RunRequest;
  if (!body.inputImageRef || typeof body.inputImageRef !== "string") {
    return res.status(400).json({ error: "Missing 'inputImageRef'." });
  }

  const job: Job = startCampaign(apiKey, body.inputImageRef, body.goal ?? "");
  return res.json(job);
});

runRouter.get("/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Run not found." });
  return res.json(job);
});
