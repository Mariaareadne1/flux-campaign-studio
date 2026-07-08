import { Router } from "express";
import type {
  FluxModelId,
  GenerateRequest,
  GenerateResponse,
} from "../../../shared/types";

// Base URL for the FLUX API. Regional variants (api.eu.bfl.ai / api.us.bfl.ai)
// also exist; this stays a single constant that Task 3 lifts into the registry.
const FLUX_BASE_URL = "https://api.bfl.ai/v1";
const DEFAULT_MODEL: FluxModelId = "flux-2-pro";

// The model id is interpolated into the request URL, so it MUST be validated
// against this allowlist — never let a client push arbitrary path segments.
const ALLOWED_MODELS: readonly FluxModelId[] = [
  "flux-2-klein-4b",
  "flux-2-klein-9b",
  "flux-2-pro",
  "flux-2-flex",
  "flux-2-max",
];

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

  const model = body.model ?? DEFAULT_MODEL;
  if (!ALLOWED_MODELS.includes(model)) {
    return res.status(400).json({ error: `Unknown model '${model}'.` });
  }

  // FLUX.2 request body: prompt (+ width/height for text-to-image, + input_image
  // for unified editing). Reference images by number in the prompt ("image 1").
  const fluxBody: Record<string, unknown> = { prompt: body.prompt };
  if (body.width) fluxBody.width = body.width;
  if (body.height) fluxBody.height = body.height;
  if (body.inputImage) fluxBody.input_image = body.inputImage;

  try {
    const resp = await fetch(`${FLUX_BASE_URL}/${model}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-key": apiKey },
      body: JSON.stringify(fluxBody),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return res
        .status(resp.status)
        .json({ error: `FLUX submit failed (${resp.status}).`, detail });
    }

    const data = (await resp.json()) as { id: string; polling_url: string };
    const out: GenerateResponse = { id: data.id, pollingUrl: data.polling_url };
    return res.json(out);
  } catch (err) {
    return res
      .status(502)
      .json({ error: "Failed to reach FLUX.", detail: String(err) });
  }
});
