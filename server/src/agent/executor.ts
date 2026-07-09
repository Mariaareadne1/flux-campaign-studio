import { randomUUID } from "node:crypto";
import type { CampaignPlan, Job, PlanStep } from "../../../shared/types";
import {
  downloadImage,
  pollUntilReady,
  submitGeneration,
} from "../flux/client";
import { readAsDataUrl, saveImageBytes } from "../storage";

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

/** Build the fixed generate -> edit -> reframe(x2) -> export chain. */
export function buildHardcodedPlan(
  uploadedImageId: string,
  goal: string,
): CampaignPlan {
  const steps: PlanStep[] = [
    {
      id: "hero",
      label: "Hero shot",
      kind: "generate",
      model: "flux-2-pro",
      status: "pending",
      inputImageRef: uploadedImageId,
      width: 1024,
      height: 1024,
      prompt:
        "Studio product photograph of the product from image 1, centered on a " +
        "seamless off-white background (#f5f5f4), soft even lighting, a subtle " +
        "contact shadow, crisp focus and high detail — a clean e-commerce hero shot.",
    },
    {
      id: "lifestyle",
      label: "Lifestyle scene",
      kind: "edit",
      model: "flux-2-pro",
      status: "pending",
      inputImageRef: "hero",
      width: 1024,
      height: 1024,
      prompt:
        "Place the product from image 1 into a warm, minimal lifestyle scene on " +
        "a light wooden surface beside a window, soft natural morning light, " +
        "shallow depth of field, a few tasteful props, photorealistic.",
    },
    {
      id: "reframe-16x9",
      label: "16:9 banner",
      kind: "reframe",
      model: "flux-2-pro",
      status: "pending",
      inputImageRef: "lifestyle",
      width: 1440,
      height: 810,
      prompt:
        "Reframe the scene from image 1 to a 16:9 horizontal banner, extending " +
        "the background naturally on both sides while keeping the product " +
        "centered and unchanged.",
    },
    {
      id: "reframe-1x1",
      label: "1:1 square",
      kind: "reframe",
      model: "flux-2-pro",
      status: "pending",
      inputImageRef: "lifestyle",
      width: 1080,
      height: 1080,
      prompt:
        "Reframe the scene from image 1 to a balanced 1:1 square format, keeping " +
        "the product centered and the composition clean.",
    },
    {
      id: "export",
      label: "Collect assets",
      kind: "export",
      model: "flux-2-pro",
      status: "pending",
      prompt: "Collect all generated campaign assets for export.",
    },
  ];

  return { id: randomUUID(), goal, inputImageRef: uploadedImageId, steps };
}

/** Create a job, kick off execution (fire-and-forget), and return it. */
export function startCampaign(
  apiKey: string,
  uploadedImageId: string,
  goal: string,
): Job {
  const plan = buildHardcodedPlan(uploadedImageId, goal);
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
      continue;
    }

    step.status = "running";
    try {
      const inputImage = resolveInputDataUrl(step, job);
      const submitted = await submitGeneration(apiKey, {
        model: step.model,
        prompt: step.prompt,
        width: step.width,
        height: step.height,
        inputImage,
      });
      const result = await pollUntilReady(apiKey, submitted.pollingUrl);
      if (!result.resultUrl) {
        throw new Error("FLUX reported Ready but returned no image.");
      }

      // Download + persist immediately so the result survives URL expiry.
      const { bytes, contentType } = await downloadImage(result.resultUrl);
      const saved = saveImageBytes(bytes, contentType);
      step.resultUrl = saved.url;
      step.status = "done";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      step.status = "failed";
      step.error = message;
      job.status = "failed";
      job.error = `Step "${step.label}" failed: ${message}`;
      return; // stop the chain (Phase 2 adds bounded retry instead)
    }
  }

  job.status = "done";
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
