import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type { CampaignType, Job, PlanStep } from "../../../shared/types";
import {
  downloadImage,
  pollUntilReady,
  submitGeneration,
} from "../flux/client";
import { FluxError, isRetryable, normalizeError } from "../flux/errors";
import { readAsDataUrl, saveImageBytes } from "../storage";
import { planCampaign } from "./planner";

/** How many times to retry a failed/rejected step (in addition to the first try). */
const MAX_RETRIES = 2;
/** A real image is far larger than this; a tiny payload signals a bad result. */
const MIN_RESULT_BYTES = 1024;
/** Exponential backoff bounds between retries. */
const RETRY_BASE_MS = 800;
const RETRY_MAX_MS = 8_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Delay before a retry: honor a rate-limit Retry-After, else exponential backoff. */
function retryDelayMs(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs && retryAfterMs > 0) return retryAfterMs;
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (attempt - 1));
}

/**
 * Phase 1 executor: runs a HARDCODED 4-step campaign chain against the real
 * FLUX API. Each step edits an image via input_image, and every result is
 * downloaded and persisted immediately (FLUX URLs expire in ~10 min).
 *
 * The plan is built as data so the UI can render it live. Phase 2 replaces the
 * hardcoded plan with an agent planner and adds evaluation + retry here.
 *
 * Runs are held in memory and mutated in place as they progress; the run route
 * exposes them via polling (GET /api/run/:id), which Phase 2 swaps for SSE.
 */

const runs = new Map<string, Job>();

/**
 * Emits a snapshot of a job (keyed by runId) after every state change, so the
 * SSE route can push live progress. Max listeners is unbounded because many
 * clients could stream different runs concurrently.
 */
const runEvents = new EventEmitter();
runEvents.setMaxListeners(0);

function notify(job: Job): void {
  runEvents.emit(job.id, job);
}

/** Subscribe to a run's updates; returns an unsubscribe function. */
export function subscribeToRun(
  runId: string,
  listener: (job: Job) => void,
): () => void {
  runEvents.on(runId, listener);
  return () => runEvents.off(runId, listener);
}

/**
 * Create a job from a goal + product image (the agent planner builds the plan),
 * kick off execution (fire-and-forget), and return the initial job.
 */
export function startCampaign(
  apiKey: string,
  uploadedImageId: string,
  goal: string,
  campaignType?: CampaignType,
): Job {
  const plan = planCampaign(goal, uploadedImageId, campaignType);
  const job: Job = { id: randomUUID(), status: "running", plan };
  runs.set(job.id, job);
  void runJob(apiKey, job);
  return job;
}

export function getJob(runId: string): Job | undefined {
  return runs.get(runId);
}

/** Run each step sequentially, feeding outputs forward as input_image. */
async function runJob(apiKey: string, job: Job): Promise<void> {
  for (const step of job.plan.steps) {
    if (step.kind === "export") {
      step.status = "done";
      notify(job);
      continue;
    }

    try {
      await runStep(apiKey, step, job);
    } catch (err) {
      const message = normalizeError(err).message;
      step.status = "failed";
      step.error = message;
      step.note = undefined;
      job.status = "failed";
      job.error = `Step "${step.label}" failed: ${message}`;
      notify(job);
      return; // stop the chain on unrecoverable failure
    }
  }

  job.status = "done";
  notify(job);
}

/**
 * Run a single step with evaluation + bounded retry. On a retryable failure or
 * a rejected result, it retries with an adjusted prompt (up to MAX_RETRIES).
 * Non-retryable failures (bad key, content policy, validation) fail fast.
 * State is mutated in place so the run route reflects progress live.
 */
async function runStep(apiKey: string, step: PlanStep, job: Job): Promise<void> {
  const basePrompt = step.prompt;
  let lastReason = "";

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    step.status = "running";
    step.attempt = attempt;
    step.note =
      attempt > 1 ? `retry ${attempt - 1}/${MAX_RETRIES}: ${lastReason}` : undefined;
    notify(job);

    const prompt =
      attempt === 1 ? basePrompt : adjustPromptForRetry(basePrompt, attempt);

    try {
      const inputImage = resolveInputDataUrl(step, job);
      const submitted = await submitGeneration(apiKey, {
        model: step.model,
        prompt,
        width: step.width,
        height: step.height,
        inputImage,
      });
      const result = await pollUntilReady(apiKey, submitted.pollingUrl);
      if (!result.resultUrl) {
        throw new FluxError("FLUX reported Ready but returned no image.", 502);
      }

      // Download + persist immediately so the result survives URL expiry.
      const { bytes, contentType } = await downloadImage(result.resultUrl);

      const verdict = evaluateResult(bytes);
      if (!verdict.ok) {
        // A rejected result is retryable (adjust the prompt and try again).
        lastReason = verdict.reason;
        if (attempt <= MAX_RETRIES) {
          await sleep(retryDelayMs(attempt));
          continue;
        }
        throw new FluxError(`Result rejected: ${verdict.reason}`, 502);
      }

      const saved = saveImageBytes(bytes, contentType);
      step.resultUrl = saved.url;
      step.status = "done";
      step.note = undefined;
      notify(job);
      return;
    } catch (err) {
      const fe = normalizeError(err);
      lastReason = fe.message;
      // Retry only if attempts remain AND the error is worth retrying.
      if (attempt <= MAX_RETRIES && isRetryable(fe)) {
        await sleep(retryDelayMs(attempt, fe.retryAfterMs));
        continue;
      }
      throw fe;
    }
  }
}

/**
 * Evaluate a generated result. Simple to start: the image must be present and
 * plausibly sized. This is the hook where a stronger check (aspect-ratio
 * validation, or a model-based critique of the image) can plug in later.
 */
function evaluateResult(bytes: Buffer): { ok: true } | { ok: false; reason: string } {
  if (!bytes || bytes.length < MIN_RESULT_BYTES) {
    return { ok: false, reason: "result image was empty or too small" };
  }
  return { ok: true };
}

/** Nudge the prompt toward a cleaner result on retry. */
function adjustPromptForRetry(basePrompt: string, attempt: number): string {
  const nudge =
    attempt === 2
      ? " Ensure the product is clearly visible, sharply focused, and well lit."
      : " Render a clean, high-quality, correctly composed image with the product prominent.";
  return basePrompt + nudge;
}

/**
 * Resolve a step's input image to a base64 data URL. `inputImageRef` is either
 * the id of a prior step (use its persisted result) or an uploaded image id.
 */
function resolveInputDataUrl(step: PlanStep, job: Job): string {
  const ref = step.inputImageRef;
  if (!ref) throw new Error(`Step "${step.label}" has no input image.`);

  const sourceStep = job.plan.steps.find((s) => s.id === ref);
  if (sourceStep) {
    if (!sourceStep.resultUrl) {
      throw new Error(`Input step "${sourceStep.label}" produced no result.`);
    }
    return readAsDataUrl(idFromUrl(sourceStep.resultUrl));
  }

  // Not a step id — treat it as an uploaded image id.
  return readAsDataUrl(ref);
}

/** "/api/uploads/<id>" -> "<id>" */
function idFromUrl(url: string): string {
  return url.split("/").pop() ?? url;
}
