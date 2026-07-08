import type { FluxModelId, FluxStatus } from "../../../shared/types";
import { endpointFor } from "./models";
import { assertBflUrl, FluxError } from "./errors";

/**
 * Low-level FLUX client.
 *
 * FLUX generation is asynchronous:
 *   1. POST prompt to a model endpoint  -> { id, polling_url }
 *   2. GET the polling_url every ~0.5s  -> { status, result? }
 *   3. when status === "Ready", the image is at result.sample (a signed URL
 *      valid ~10 minutes) — download it immediately.
 *
 * All FLUX auth uses the `x-key` header.
 */

const POLL_INTERVAL_MS = 500;
const DEFAULT_TIMEOUT_MS = 120_000;

export interface SubmitParams {
  model: FluxModelId;
  prompt: string;
  width?: number;
  height?: number;
  /** URL or base64 image for FLUX.2 unified editing (input_image). */
  inputImage?: string;
}

export interface SubmitResult {
  id: string;
  pollingUrl: string;
}

export interface PollResult {
  status: FluxStatus;
  /** Signed result URL when status === "Ready". */
  resultUrl?: string;
  error?: string;
}

/** Step 1 — submit a generation/edit request, returning its polling URL. */
export async function submitGeneration(
  apiKey: string,
  params: SubmitParams,
): Promise<SubmitResult> {
  const body: Record<string, unknown> = { prompt: params.prompt };
  if (params.width) body.width = params.width;
  if (params.height) body.height = params.height;
  if (params.inputImage) body.input_image = params.inputImage;

  let resp: Response;
  try {
    resp = await fetch(endpointFor(params.model), {
      method: "POST",
      headers: { "content-type": "application/json", "x-key": apiKey },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new FluxError("Failed to reach FLUX.", 502, String(err));
  }

  if (!resp.ok) {
    const detail = await safeText(resp);
    throw new FluxError(`FLUX submit failed (${resp.status}).`, resp.status, detail);
  }

  const data = (await resp.json()) as { id?: string; polling_url?: string };
  if (!data.id || !data.polling_url) {
    throw new FluxError("FLUX submit returned no polling URL.", 502, JSON.stringify(data));
  }
  return { id: data.id, pollingUrl: data.polling_url };
}

/** Step 2 (single tick) — poll a URL once and normalize the response. */
export async function pollOnce(
  apiKey: string,
  pollingUrl: string,
): Promise<PollResult> {
  assertBflUrl(pollingUrl, "pollingUrl");

  let resp: Response;
  try {
    resp = await fetch(pollingUrl, {
      headers: { "x-key": apiKey, accept: "application/json" },
    });
  } catch (err) {
    throw new FluxError("Failed to reach FLUX.", 502, String(err));
  }

  if (!resp.ok) {
    const detail = await safeText(resp);
    throw new FluxError(`FLUX poll failed (${resp.status}).`, resp.status, detail);
  }

  const data = (await resp.json()) as {
    status: FluxStatus;
    result?: { sample?: string } | null;
    error?: string;
  };

  return {
    status: data.status,
    resultUrl: data.result?.sample,
    error: data.error ?? undefined,
  };
}

/**
 * Step 2 (loop) — poll until the job reaches a terminal state. Statuses other
 * than "Pending"/"Ready" are treated as terminal failures. Used server-side by
 * the agent executor (Phase 2); the client drives its own loop via /api/status.
 */
export async function pollUntilReady(
  apiKey: string,
  pollingUrl: string,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<PollResult> {
  const intervalMs = opts.intervalMs ?? POLL_INTERVAL_MS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const result = await pollOnce(apiKey, pollingUrl);

    if (result.status === "Ready") return result;
    if (result.status !== "Pending") {
      throw new FluxError(
        `FLUX job ended with status '${result.status}'.`,
        502,
        result.error,
      );
    }
    if (Date.now() > deadline) {
      throw new FluxError("Timed out waiting for FLUX result.", 504);
    }
    await sleep(intervalMs);
  }
}

/** Step 3 — download a signed result URL and return its bytes + content type. */
export async function downloadImage(
  url: string,
): Promise<{ contentType: string; bytes: Buffer }> {
  assertBflUrl(url, "url");

  let resp: Response;
  try {
    resp = await fetch(url);
  } catch (err) {
    throw new FluxError("Failed to download image.", 502, String(err));
  }

  if (!resp.ok) {
    throw new FluxError(`Image download failed (${resp.status}).`, resp.status);
  }

  const contentType =
    resp.headers.get("content-type") ?? "application/octet-stream";
  const bytes = Buffer.from(await resp.arrayBuffer());
  return { contentType, bytes };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeText(resp: Response): Promise<string | undefined> {
  try {
    return await resp.text();
  } catch {
    return undefined;
  }
}
