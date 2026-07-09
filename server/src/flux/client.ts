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

// Per-request network timeouts so a hung connection can never stall a run.
const SUBMIT_TIMEOUT_MS = 30_000;
const POLL_TIMEOUT_MS = 30_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;

/** fetch with a hard timeout, normalizing network/timeout failures to FluxError. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new FluxError("Request to FLUX timed out.", 504);
    }
    throw new FluxError("Failed to reach FLUX.", 502, String(err));
  }
}

/** Build a FluxError from a non-2xx response, capturing Retry-After on 429s. */
function httpError(resp: Response, prefix: string, detail?: string): FluxError {
  const err = new FluxError(`${prefix} (${resp.status}).`, resp.status, detail);
  if (resp.status === 429) {
    const retryAfter = Number(resp.headers.get("retry-after"));
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      err.retryAfterMs = retryAfter * 1000;
    }
  }
  return err;
}

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

  const resp = await fetchWithTimeout(
    endpointFor(params.model),
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-key": apiKey },
      body: JSON.stringify(body),
    },
    SUBMIT_TIMEOUT_MS,
  );

  if (!resp.ok) {
    throw httpError(resp, "FLUX submit failed", await safeText(resp));
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

  const resp = await fetchWithTimeout(
    pollingUrl,
    { headers: { "x-key": apiKey, accept: "application/json" } },
    POLL_TIMEOUT_MS,
  );

  if (!resp.ok) {
    throw httpError(resp, "FLUX poll failed", await safeText(resp));
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

  const resp = await fetchWithTimeout(url, {}, DOWNLOAD_TIMEOUT_MS);

  if (!resp.ok) {
    // 403/404/410 on a result URL almost always means it expired (10-min TTL).
    const expired = [403, 404, 410].includes(resp.status);
    const message = expired
      ? `Result URL expired or unavailable (${resp.status}) — results must be downloaded within ~10 minutes.`
      : `Image download failed (${resp.status}).`;
    throw new FluxError(message, resp.status);
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
