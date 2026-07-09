/**
 * Prompt templates per step kind, following the flux-best-practices skill:
 *
 *  - Structure: Subject → Setting → Lighting → Camera/Technical → Style.
 *  - Natural-language prose, not keyword salad.
 *  - NO negative prompts — describe what you want, and for edits state what to
 *    PRESERVE (I2I best practice) so the product's identity is kept.
 *  - Reference the source image by number: "the product from image 1".
 *  - Hex colors are paired with a plain-language name (#RRGGBB (name)).
 *
 * These are pure functions of a PromptContext; the planner derives the context
 * from the goal and picks which template each step uses.
 */

export interface PromptContext {
  /** Short style descriptor derived from the goal, e.g. "premium, minimal". */
  style: string;
  /** Optional brand color as "#RRGGBB" (already validated by the planner). */
  brandColor?: string;
}

/** Keep the product's identity fixed across an edit. */
const PRESERVE_PRODUCT =
  "Keep the product itself — its exact shape, proportions, materials, colors, " +
  "and any labels or logos — identical to image 1; do not redesign it.";

function brandAccent(ctx: PromptContext): string {
  return ctx.brandColor
    ? ` Introduce a subtle brand accent in ${ctx.brandColor} (brand color) in the styling.`
    : "";
}

/** Fast, cheap concept draft (klein). Kept short — it's a quick preview. */
export function conceptPrompt(ctx: PromptContext): string {
  return (
    `A quick concept preview of the product from image 1, centered on a plain ` +
    `light studio background (#f5f5f4 (soft warm white)), simple soft lighting, ` +
    `realistic. Style: ${ctx.style}. ${PRESERVE_PRODUCT}`
  );
}

/** The definitive hero shot (max). Rich, with lighting + camera specifics. */
export function heroPrompt(ctx: PromptContext): string {
  return (
    `A professional studio product photograph of the product from image 1, ` +
    `presented as a clean e-commerce hero shot. Center the product on a ` +
    `seamless off-white background (#f5f5f4 (soft warm white)) with a soft ` +
    `contact shadow beneath it. Soft, even key light from the upper left with a ` +
    `gentle fill, true-to-life colors, crisp edge-to-edge focus and fine detail. ` +
    `Shot on a Hasselblad with a 100mm macro lens at f/8. Style: ${ctx.style}.` +
    `${brandAccent(ctx)} ${PRESERVE_PRODUCT}`
  );
}

/** Place the product into a lifestyle scene (pro). */
export function lifestylePrompt(ctx: PromptContext): string {
  return (
    `Place the product from image 1 into a warm, minimal lifestyle scene: ` +
    `resting on a light oak wooden surface beside a bright window, soft natural ` +
    `morning light from the left, a few tasteful complementary props slightly ` +
    `out of focus behind it. Shallow depth of field, 85mm lens at f/2.0, ` +
    `photorealistic editorial product photography. Style: ${ctx.style}.` +
    `${brandAccent(ctx)} Only change the surrounding scene and lighting — ` +
    `${PRESERVE_PRODUCT}`
  );
}

/**
 * Social graphic with on-image typography (flux-2-flex). Follows the
 * typography rules: quote the exact text, front-load it, name the font style,
 * state placement + contrast, and keep the headline short (1–4 words).
 */
export function socialPrompt(
  ctx: PromptContext,
  formatLabel: string,
  headline: string,
): string {
  const accent = ctx.brandColor
    ? ` Use ${ctx.brandColor} (brand color) as an accent behind the text.`
    : "";
  return (
    `A bold headline "${headline}" in clean geometric sans-serif, set in the ` +
    `upper third of a ${formatLabel} social media graphic — large, high ` +
    `contrast, and clearly legible. Feature the product from image 1 ` +
    `prominently in the lower portion, with tasteful negative space around the ` +
    `text. Style: ${ctx.style}.${accent} ${PRESERVE_PRODUCT}`
  );
}

/** Reframe/outpaint an approved scene to a new aspect ratio. */
export function reframePrompt(formatLabel: string): string {
  return (
    `Reframe the scene from image 1 to a ${formatLabel} composition. Naturally ` +
    `extend the existing background and setting to fill the new aspect ratio, ` +
    `keeping the product in the same position and size and completely unchanged. ` +
    `Maintain the original lighting direction, color grading, and photographic ` +
    `style so the result looks like the same shot, just recomposed.`
  );
}
