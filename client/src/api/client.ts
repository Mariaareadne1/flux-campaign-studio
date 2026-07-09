import type {
  ApiError,
  FluxStatus,
  GenerateRequest,
  GenerateResponse,
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
