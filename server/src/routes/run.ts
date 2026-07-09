import { Router } from "express";
import type { Job, RunRequest } from "../../../shared/types";
import { getJob, startCampaign, subscribeToRun } from "../agent/executor";

/**
 * Campaign run routes.
 *   POST /api/run            -> start a campaign for an uploaded image
 *   GET  /api/run/:id        -> current job state (one-shot snapshot)
 *   GET  /api/run/:id/stream -> Server-Sent Events: live progress until terminal
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

  try {
    const job: Job = startCampaign(
      apiKey,
      body.inputImageRef,
      body.goal ?? "",
      body.campaignType,
    );
    return res.json(job);
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Failed to start campaign.", detail: String(err) });
  }
});

runRouter.get("/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Run not found." });
  return res.json(job);
});

runRouter.get("/:id/stream", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Run not found." });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  let closed = false;
  let unsubscribe: () => void = () => {};

  const finish = () => {
    if (closed) return;
    closed = true;
    unsubscribe();
    clearInterval(heartbeat);
    res.end();
  };

  const write = (snapshot: Job) => {
    if (closed) return;
    res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
    if (snapshot.status !== "running") finish(); // terminal — close the stream
  };

  // Subscribe before sending the snapshot so no update slips through the gap.
  unsubscribe = subscribeToRun(job.id, write);
  const heartbeat = setInterval(() => {
    if (!closed) res.write(": ping\n\n");
  }, 15_000);
  req.on("close", finish);

  write(job); // initial snapshot (also ends immediately if already terminal)
});
