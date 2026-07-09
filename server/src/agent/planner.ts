import { randomUUID } from "node:crypto";
import type {
  CampaignPlan,
  FluxModelId,
  PlanStep,
  StepKind,
} from "../../../shared/types";
import { estimateCostUsd } from "../flux/models";

/**
 * The campaign planner. Given a natural-language goal + an uploaded product
 * image, it produces an ordered CampaignPlan — how many steps, what each does,
 * which model to use, and the prompt to send.
 *
 * The logic is deliberately transparent and rule-based (no hidden LLM call): the
 * plan is just data the UI renders, and every decision here is inspectable. A
 * fork can make it smarter without changing the executor or the UI contract.
 *
 * NOTE: prompt text is constructed inline for now; Task 3 moves it into
 * prompts.ts following the flux-best-practices skill.
 */

/** An output format the campaign can target. Dimensions are multiples of 16. */
interface FormatSpec {
  key: string;
  label: string;
  width: number;
  height: number;
}

const FORMATS = {
  banner: { key: "16x9", label: "16:9 banner", width: 1280, height: 720 },
  square: { key: "1x1", label: "1:1 square", width: 1024, height: 1024 },
  story: { key: "9x16", label: "9:16 story", width: 720, height: 1280 },
} satisfies Record<string, FormatSpec>;

/**
 * Per-step model policy (cost-aware — see Task 2). Rationale:
 *  - hero → [max]: the one image that must be perfect.
 *  - lifestyle → [pro]: a fresh scene composition; balanced quality/speed.
 *  - reframe → [klein-9b]: mechanical reformat of an already-approved image, so
 *    the cheap/fast tier is appropriate.
 *  - concept → [klein-4b]: a quick, throwaway composition preview.
 */
function selectModel(kind: StepKind, role: "concept" | "hero" | "other"): FluxModelId {
  if (kind === "reframe") return "flux-2-klein-9b";
  if (role === "concept") return "flux-2-klein-4b";
  if (role === "hero") return "flux-2-max";
  return "flux-2-pro"; // lifestyle / edits
}

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

// --- Inline prompt construction (replaced by prompts.ts in Task 3) -----------

function heroPrompt(style: string): string {
  return (
    `Studio product photograph of the product from image 1, centered on a ` +
    `seamless off-white background (#f5f5f4), soft even lighting with a subtle ` +
    `contact shadow, crisp focus and high detail. Style: ${style}. A clean ` +
    `e-commerce hero shot.`
  );
}

function conceptPrompt(style: string): string {
  return (
    `Quick concept preview: the product from image 1 on a plain light ` +
    `background, simple studio lighting. Style: ${style}.`
  );
}

function lifestylePrompt(style: string): string {
  return (
    `Place the product from image 1 into a warm, minimal lifestyle scene on a ` +
    `light wooden surface beside a window, soft natural morning light, shallow ` +
    `depth of field, a few tasteful props, photorealistic. Style: ${style}.`
  );
}

function reframePrompt(format: FormatSpec): string {
  return (
    `Reframe the scene from image 1 to a ${format.label} composition, extending ` +
    `the background naturally to fill the new aspect ratio while keeping the ` +
    `product centered and unchanged.`
  );
}

// -----------------------------------------------------------------------------

/**
 * Build a launch-campaign plan: concept draft -> hero -> lifestyle -> one
 * reframe per detected format -> export.
 */
export function planCampaign(
  goal: string,
  uploadedImageId: string,
): CampaignPlan {
  const style = deriveStyle(goal);
  const formats = detectFormats(goal);
  const steps: PlanStep[] = [];

  steps.push({
    id: "concept",
    label: "Concept draft",
    kind: "generate",
    model: selectModel("generate", "concept"),
    status: "pending",
    inputImageRef: uploadedImageId,
    width: 1024,
    height: 1024,
    prompt: conceptPrompt(style),
  });

  steps.push({
    id: "hero",
    label: "Hero shot",
    kind: "generate",
    model: selectModel("generate", "hero"),
    status: "pending",
    inputImageRef: uploadedImageId,
    width: 1024,
    height: 1024,
    prompt: heroPrompt(style),
  });

  steps.push({
    id: "lifestyle",
    label: "Lifestyle scene",
    kind: "edit",
    model: selectModel("edit", "other"),
    status: "pending",
    inputImageRef: "hero",
    width: 1024,
    height: 1024,
    prompt: lifestylePrompt(style),
  });

  for (const format of formats) {
    steps.push({
      id: `reframe-${format.key}`,
      label: format.label,
      kind: "reframe",
      model: selectModel("reframe", "other"),
      status: "pending",
      inputImageRef: "lifestyle",
      width: format.width,
      height: format.height,
      prompt: reframePrompt(format),
    });
  }

  steps.push({
    id: "export",
    label: "Collect assets",
    kind: "export",
    model: "flux-2-pro",
    status: "pending",
    prompt: "Collect all generated campaign assets for export.",
  });

  attachCostEstimates(steps);

  return { id: randomUUID(), goal, inputImageRef: uploadedImageId, steps };
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
