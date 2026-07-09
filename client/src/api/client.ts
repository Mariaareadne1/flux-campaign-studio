import type {
  ApiError,
  FluxStatus,
  GenerateRequest,
  GenerateResponse,
  Job,
  RunRequest,
  StatusResponse,
  UploadResponse,
} from "../../../shared/types";

// The client talks ONLY to our own backend. In dev, Vite proxies /api to the
// Express server (see vite.config.ts); the browser never touches FLUX directly.

async function jsonOrThrow<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    let message = `Request failed (${resp.status}).`;
    try {
      const body = (await resp.json()) as ApiError;
      if (body?.error) message = body.error;
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new Error(message);
  }
  return (await resp.json()) as T;
}

/** Submit a generation and get back its polling URL. */
export async function generate(
  req: GenerateRequest,
): Promise<GenerateResponse> {
  const resp = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  return jsonOrThrow<GenerateResponse>(resp);
}

/** Poll a FLUX polling URL once (via our proxy). */
export async function getStatus(pollingUrl: string): Promise<StatusResponse> {
  const resp = await fetch(
    `/api/status?pollingUrl=${encodeURIComponent(pollingUrl)}`,
  );
  return jsonOrThrow<StatusResponse>(resp);
}

/** Build the proxy URL that serves a FLUX result image (defeats CORS + expiry). */
export function imageProxyUrl(resultUrl: string): string {
  return `/api/image?url=${encodeURIComponent(resultUrl)}`;
}

/** Read a browser File into a base64 data URL (for upload). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

/** Upload a product image (as a data URL) and get back its stored id + URL. */
export async function uploadImage(dataUrl: string): Promise<UploadResponse> {
  const resp = await fetch("/api/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ dataUrl }),
  });
  return jsonOrThrow<UploadResponse>(resp);
}

/** Start a campaign run for an uploaded image; returns the initial Job. */
export async function startRun(req: RunRequest): Promise<Job> {
  const resp = await fetch("/api/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  return jsonOrThrow<Job>(resp);
}

/** Fetch the current state of a run. */
export async function getRun(runId: string): Promise<Job> {
  const resp = await fetch(`/api/run/${encodeURIComponent(runId)}`);
  return jsonOrThrow<Job>(resp);
}

const RUN_POLL_INTERVAL_MS = 800;
const MAX_RUN_POLLS = 900; // ~12 minutes

/**
 * Poll a run every ~0.8s, reporting each snapshot, until it's no longer
 * running. This drives the live PlanPanel/Canvas updates in Phase 1; Phase 2
 * replaces it with a Server-Sent Events stream.
 */
export async function pollRun(
  runId: string,
  onUpdate: (job: Job) => void,
): Promise<Job> {
  for (let i = 0; i < MAX_RUN_POLLS; i++) {
    const job = await getRun(runId);
    onUpdate(job);
    if (job.status !== "running") return job;
    await new Promise((r) => setTimeout(r, RUN_POLL_INTERVAL_MS));
  }
  throw new Error("Run timed out.");
}

const POLL_INTERVAL_MS = 700;
const MAX_POLLS = 180; // ~2 minutes at 700ms

/**
 * Submit → poll every ~0.7s until Ready → return the proxied image URL.
 * Reports each status transition through the optional callback.
 */
export async function generateAndWait(
  req: GenerateRequest,
  onStatus?: (status: FluxStatus) => void,
): Promise<string> {
  const { pollingUrl } = await generate(req);

  for (let i = 0; i < MAX_POLLS; i++) {
    const s = await getStatus(pollingUrl);
    onStatus?.(s.status);

    if (s.status === "Ready") {
      if (!s.resultUrl) throw new Error("FLUX reported Ready but sent no image.");
      return imageProxyUrl(s.resultUrl);
    }
    if (s.status !== "Pending") {
      throw new Error(s.error || `FLUX job ended with status '${s.status}'.`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error("Timed out waiting for the FLUX result.");
}
