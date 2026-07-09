import { randomUUID } from "node:crypto";
import type {
  CampaignPlan,
  CampaignType,
  PlanStep,
} from "../../../shared/types";
import { CONFIG } from "../config";
import { estimateCostUsd } from "../flux/models";
import {
  conceptPrompt,
  heroPrompt,
  lifestylePrompt,
  reframePrompt,
  socialPrompt,
  type PromptContext,
} from "./prompts";

/**
 * The campaign planner. Given a natural-language goal + an uploaded product
 * image, it produces an ordered CampaignPlan — how many steps, what each does,
 * which model to use, and the prompt to send.
 *
 * The logic is deliberately transparent and rule-based (no hidden LLM call): the
 * plan is just data the UI renders, and every decision here is inspectable. A
 * fork can make it smarter without changing the executor or the UI contract.
 *
 * Models, sizes, retry, and timeouts all live in ../config.ts (CONFIG).
 */

/** An output format the campaign can target. Dimensions are multiples of 16. */
interface FormatSpec {
  key: string;
  label: string;
  width: number;
  height: number;
}

const FORMATS = {
  banner: { key: "16x9", label: "16:9 banner", ...CONFIG.sizes.banner },
  square: { key: "1x1", label: "1:1 square", ...CONFIG.sizes.square },
  story: { key: "9x16", label: "9:16 story", ...CONFIG.sizes.story },
} satisfies Record<string, FormatSpec>;

/** Detect which output formats the goal asks for (defaults to banner + square). */
function detectFormats(goal: string): FormatSpec[] {
  const g = goal.toLowerCase();
  const picks: FormatSpec[] = [];
  if (/\b(story|stories|reel|reels|9:16|vertical|tiktok)\b/.test(g)) {
    picks.push(FORMATS.story);
  }
  if (/\b(square|1:1|instagram post|feed post|feed)\b/.test(g)) {
    picks.push(FORMATS.square);
  }
  if (/\b(banner|16:9|landscape|wide|youtube|header|hero banner)\b/.test(g)) {
    picks.push(FORMATS.banner);
  }
  if (picks.length === 0) picks.push(FORMATS.banner, FORMATS.square);

  // De-dupe by key, preserving order.
  const seen = new Set<string>();
  return picks.filter((f) => (seen.has(f.key) ? false : seen.add(f.key)));
}

/** A short style descriptor pulled from the goal, folded into prompts. */
function deriveStyle(goal: string): string {
  const g = goal.toLowerCase();
  const hints: string[] = [];
  if (/\b(luxury|premium|high-end|elegant)\b/.test(g)) hints.push("premium, elegant");
  if (/\b(minimal|clean|simple)\b/.test(g)) hints.push("minimal, clean");
  if (/\b(bold|vibrant|energetic|playful)\b/.test(g)) hints.push("bold, vibrant");
  if (/\b(warm|cozy|natural|organic)\b/.test(g)) hints.push("warm, natural");
  return hints.length > 0 ? hints.join(", ") : "clean, premium, minimal";
}

/** Pull an explicit #RRGGBB brand color out of the goal, if present. */
function extractBrandColor(goal: string): string | undefined {
  const match = /#[0-9a-fA-F]{6}\b/.exec(goal);
  return match ? match[0] : undefined;
}

/** Detect campaign type from the goal when the caller doesn't specify one. */
function detectType(goal: string): CampaignType {
  return /\b(social|instagram|tiktok|social pack|social media|reels?|stories)\b/i.test(
    goal,
  )
    ? "social"
    : "launch";
}

/** Pull a short headline out of the goal (quoted text), else a safe default. */
function extractHeadline(goal: string): string {
  const match = /["'“”‘’](.{1,40}?)["'“”‘’]/.exec(goal);
  return match ? match[1].trim() : "NEW";
}

const CONTEXT = (goal: string): PromptContext => ({
  style: deriveStyle(goal),
  brandColor: extractBrandColor(goal),
});

const exportStep = (): PlanStep => ({
  id: "export",
  label: "Collect assets",
  kind: "export",
  model: "flux-2-pro",
  status: "pending",
  prompt: "Collect all generated campaign assets for export.",
});

function finalize(
  goal: string,
  uploadedImageId: string,
  steps: PlanStep[],
): CampaignPlan {
  attachCostEstimates(steps);
  return { id: randomUUID(), goal, inputImageRef: uploadedImageId, steps };
}

/**
 * The planner entry point. Routes to a workflow by campaign type (explicit, or
 * detected from the goal). Adding a new campaign type = one new plan builder.
 */
export function planCampaign(
  goal: string,
  uploadedImageId: string,
  campaignType?: CampaignType,
): CampaignPlan {
  const type = campaignType ?? detectType(goal);
  return type === "social"
    ? planSocialPack(goal, uploadedImageId)
    : planLaunch(goal, uploadedImageId);
}

/** Launch campaign: concept -> hero -> lifestyle -> one reframe per format. */
function planLaunch(goal: string, uploadedImageId: string): CampaignPlan {
  const ctx = CONTEXT(goal);
  const steps: PlanStep[] = [
    {
      id: "concept",
      label: "Concept draft",
      kind: "generate",
      model: CONFIG.models.concept,
      status: "pending",
      inputImageRef: uploadedImageId,
      width: CONFIG.sizes.base.width,
      height: CONFIG.sizes.base.height,
      prompt: conceptPrompt(ctx),
    },
    {
      id: "hero",
      label: "Hero shot",
      kind: "generate",
      model: CONFIG.models.hero,
      status: "pending",
      inputImageRef: uploadedImageId,
      width: CONFIG.sizes.base.width,
      height: CONFIG.sizes.base.height,
      prompt: heroPrompt(ctx),
    },
    {
      id: "lifestyle",
      label: "Lifestyle scene",
      kind: "edit",
      model: CONFIG.models.lifestyle,
      status: "pending",
      inputImageRef: "hero",
      width: CONFIG.sizes.base.width,
      height: CONFIG.sizes.base.height,
      prompt: lifestylePrompt(ctx),
    },
  ];

  for (const format of detectFormats(goal)) {
    steps.push({
      id: `reframe-${format.key}`,
      label: format.label,
      kind: "reframe",
      model: CONFIG.models.reframe,
      status: "pending",
      inputImageRef: "lifestyle",
      width: format.width,
      height: format.height,
      prompt: reframePrompt(format.label),
    });
  }

  steps.push(exportStep());
  return finalize(goal, uploadedImageId, steps);
}

/**
 * Social pack: a clean hero, then a square post, story, and banner — each with
 * on-image typography rendered by flux-2-flex (its typography strength).
 */
function planSocialPack(goal: string, uploadedImageId: string): CampaignPlan {
  const ctx = CONTEXT(goal);
  const headline = extractHeadline(goal);
  const steps: PlanStep[] = [
    {
      id: "hero",
      label: "Hero shot",
      kind: "generate",
      model: CONFIG.models.hero,
      status: "pending",
      inputImageRef: uploadedImageId,
      width: CONFIG.sizes.base.width,
      height: CONFIG.sizes.base.height,
      prompt: heroPrompt(ctx),
    },
  ];

  const SOCIAL_FORMATS = [FORMATS.square, FORMATS.story, FORMATS.banner];
  for (const format of SOCIAL_FORMATS) {
    steps.push({
      id: `social-${format.key}`,
      label: `${format.label} + text`,
      kind: "edit",
      model: CONFIG.models.social,
      status: "pending",
      inputImageRef: "hero",
      width: format.width,
      height: format.height,
      prompt: socialPrompt(ctx, format.label, headline),
    });
  }

  steps.push(exportStep());
  return finalize(goal, uploadedImageId, steps);
}

/**
 * Annotate each image-producing step with a rough cost estimate. Our steps all
 * edit an input image (I2I), so the input's megapixels matter: we use the source
 * step's dimensions when chained, or ~1 MP for the uploaded product photo.
 */
function attachCostEstimates(steps: PlanStep[]): void {
  const byId = new Map(steps.map((s) => [s.id, s]));
  for (const step of steps) {
    if (step.kind === "export" || !step.width || !step.height) continue;
    const source = step.inputImageRef ? byId.get(step.inputImageRef) : undefined;
    const inputMp =
      source?.width && source?.height
        ? (source.width * source.height) / 1_000_000
        : 1.0; // uploaded product image — assume ~1 MP
    step.estCostUsd = estimateCostUsd(
      step.model,
      step.width,
      step.height,
      inputMp,
    );
  }
}
