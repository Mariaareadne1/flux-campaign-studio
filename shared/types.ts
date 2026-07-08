/**
 * Shared TypeScript types imported by BOTH the client and the server.
 *
 * Keep this file type-only (no runtime values) so it can be imported from the
 * Vite client and the Node server without any build coupling.
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

// ---------------------------------------------------------------------------
// Low-level API request/response shapes (client <-> our backend)
// ---------------------------------------------------------------------------

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

/** Response from POST /api/upload — the stored product image. */
export interface UploadResponse {
  /** Opaque id of the stored file (also its filename under server/uploads/). */
  id: string;
  /** URL our backend serves it from, e.g. "/api/uploads/<id>". */
  url: string;
}

// ---------------------------------------------------------------------------
// Campaign domain model (the plan the UI renders and the executor runs)
// ---------------------------------------------------------------------------

/** What a step does. */
export type StepKind = "generate" | "edit" | "reframe" | "export";

/** Lifecycle of a single step. */
export type StepStatus = "pending" | "running" | "done" | "failed";

/** One step in a campaign plan. This is the unit the PlanPanel renders live. */
export interface PlanStep {
  id: string;
  /** Human-readable label shown on the StepCard, e.g. "Hero shot". */
  label: string;
  kind: StepKind;
  model: FluxModelId;
  status: StepStatus;
  /** The prompt sent to FLUX for this step. */
  prompt: string;
  /** Which image this step edits: an uploaded id, or a prior step's result. */
  inputImageRef?: string;
  /** Persisted result URL (our /api/uploads/... — does not expire). */
  resultUrl?: string;
  /** Target dimensions (used for reframe/aspect-ratio steps). */
  width?: number;
  height?: number;
  /** Error message when status is "failed". */
  error?: string;
}

/** An ordered set of steps produced for a goal. In Phase 1 this is hardcoded. */
export interface CampaignPlan {
  id: string;
  goal: string;
  /** The uploaded product image id/url the plan starts from. */
  inputImageRef?: string;
  steps: PlanStep[];
}

/** Overall run status. */
export type JobStatus = "idle" | "running" | "done" | "failed";

/** A single campaign run: its plan plus overall status. Job.id === runId. */
export interface Job {
  id: string;
  status: JobStatus;
  plan: CampaignPlan;
  error?: string;
}

/** Body for POST /api/run — start a campaign run for an uploaded image. */
export interface RunRequest {
  inputImageRef: string;
  goal?: string;
}
