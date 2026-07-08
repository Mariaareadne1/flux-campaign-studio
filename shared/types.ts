/**
 * Shared TypeScript types imported by BOTH the client and the server.
 *
 * Keep this file type-only (no runtime values) so it can be imported from the
 * Vite client and the Node server without any build coupling. The richer job /
 * plan model lands in Phase 1; Phase 0 only needs the API request/response
 * shapes for the async-generation spike.
 */

/** A FLUX.2 model id as used in our model registry (see server/src/flux/models.ts). */
export type FluxModelId =
  | "flux-2-klein-4b"
  | "flux-2-klein-9b"
  | "flux-2-pro"
  | "flux-2-flex"
  | "flux-2-max";

/** Status values returned by the FLUX polling endpoint. */
export type FluxStatus = "Pending" | "Ready" | "Error" | "Failed";

/** Body for POST /api/generate — our backend proxies this to a FLUX endpoint. */
export interface GenerateRequest {
  prompt: string;
  model?: FluxModelId;
  width?: number;
  height?: number;
  /** URL or base64 image to edit (FLUX.2 unified editing via input_image). */
  inputImage?: string;
}

/** Response from POST /api/generate — the FLUX submit result. */
export interface GenerateResponse {
  id: string;
  pollingUrl: string;
}

/** Response from GET /api/status — normalized FLUX polling result. */
export interface StatusResponse {
  status: FluxStatus;
  /** Signed result URL (valid ~10 minutes) when status is Ready. */
  resultUrl?: string;
  /** Present when the job failed. */
  error?: string;
}

/** Shape of an error returned by any of our API routes. */
export interface ApiError {
  error: string;
  detail?: string;
}
