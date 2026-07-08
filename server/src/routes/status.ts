import { Router } from "express";
import type { StatusResponse } from "../../../shared/types";
import { pollOnce } from "../flux/client";
import { normalizeError } from "../flux/errors";

/**
 * GET /api/status?pollingUrl=...
 * Thin proxy that polls a FLUX polling URL once. Returns the normalized status
 * and, when Ready, the signed result URL (valid ~10 minutes — fetch it via
 * /api/image). The client repeats this call every ~0.5s until terminal.
 */
export const statusRouter = Router();

statusRouter.get("/", async (req, res) => {
  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ error: "Server is missing BFL_API_KEY. Add it to server .env." });
  }

  const pollingUrl = req.query.pollingUrl;
  if (typeof pollingUrl !== "string" || !pollingUrl) {
    return res.status(400).json({ error: "Missing 'pollingUrl' query param." });
  }

  try {
    const result = await pollOnce(apiKey, pollingUrl);
    const out: StatusResponse = result;
    return res.json(out);
  } catch (err) {
    const e = normalizeError(err);
    return res.status(e.status).json(e.toApiError());
  }
});
