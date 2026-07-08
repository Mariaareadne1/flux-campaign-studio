import { Router } from "express";
import type { GenerateRequest, GenerateResponse } from "../../../shared/types";
import { DEFAULT_MODEL, isFluxModelId } from "../flux/models";
import { submitGeneration } from "../flux/client";
import { normalizeError } from "../flux/errors";

/**
 * POST /api/generate
 * Thin proxy to a FLUX.2 endpoint. Forwards prompt (+ optional size / input
 * image), returns { id, pollingUrl }. The client then polls GET /api/status.
 */
export const generateRouter = Router();

generateRouter.post("/", async (req, res) => {
  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ error: "Server is missing BFL_API_KEY. Add it to server .env." });
  }

  const body = (req.body ?? {}) as GenerateRequest;
  if (!body.prompt || typeof body.prompt !== "string") {
    return res.status(400).json({ error: "Missing required field 'prompt'." });
  }

  // The model id is interpolated into the request URL, so validate it against
  // the registry before use — never let a client push arbitrary path segments.
  const model = body.model ?? DEFAULT_MODEL;
  if (!isFluxModelId(model)) {
    return res.status(400).json({ error: `Unknown model '${model}'.` });
  }

  try {
    const result = await submitGeneration(apiKey, {
      model,
      prompt: body.prompt,
      width: body.width,
      height: body.height,
      inputImage: body.inputImage,
    });
    const out: GenerateResponse = result;
    return res.json(out);
  } catch (err) {
    const e = normalizeError(err);
    return res.status(e.status).json(e.toApiError());
  }
});
