import type { FluxModelId } from "../../../shared/types";

/**
 * Base URL for the FLUX API. BFL also exposes regional endpoints
 * (https://api.eu.bfl.ai/v1, https://api.us.bfl.ai/v1) — swap this one constant
 * to pin a region.
 */
export const FLUX_BASE_URL = "https://api.bfl.ai/v1";

/** The model used when a request doesn't specify one. */
export const DEFAULT_MODEL: FluxModelId = "flux-2-pro";

export type FluxTier =
  | "draft"
  | "balanced"
  | "production"
  | "typography"
  | "max";

export interface FluxModel {
  id: FluxModelId;
  label: string;
  /** Compact label for the UI, e.g. "klein 4B". */
  shortLabel: string;
  /**
   * Endpoint path segment appended to FLUX_BASE_URL. There are also `-preview`
   * variants (e.g. "flux-2-pro-preview") that get the newest improvements — we
   * pin the stable ones here; change this string to opt into preview.
   */
  endpoint: string;
  tier: FluxTier;
  /**
   * FLUX.2 uses tiered megapixel pricing (in US cents):
   *   cost = firstMpCents + max(0, outputMP - 1) * addlMpCents + inputMP * addlMpCents
   * The input term is what makes editing (I2I) cost more than text-to-image.
   * Values from the bfl-api / flux-best-practices skills (authoritative over the
   * single per-MP number BUILD_SPEC Section 6 lists — see the discrepancy note).
   */
  firstMpCents: number;
  addlMpCents: number;
}

/**
 * The model registry. Endpoints are config values so a forker can switch to
 * preview variants or a different tier in one place.
 */
export const FLUX_MODELS: Record<FluxModelId, FluxModel> = {
  "flux-2-klein-4b": {
    id: "flux-2-klein-4b",
    label: "FLUX.2 [klein] 4B",
    shortLabel: "klein 4B",
    endpoint: "flux-2-klein-4b",
    tier: "draft",
    firstMpCents: 1.4,
    addlMpCents: 0.1,
  },
  "flux-2-klein-9b": {
    id: "flux-2-klein-9b",
    label: "FLUX.2 [klein] 9B",
    shortLabel: "klein 9B",
    endpoint: "flux-2-klein-9b",
    tier: "balanced",
    firstMpCents: 1.5,
    addlMpCents: 0.2,
  },
  "flux-2-pro": {
    id: "flux-2-pro",
    label: "FLUX.2 [pro]",
    shortLabel: "pro",
    endpoint: "flux-2-pro",
    tier: "production",
    firstMpCents: 3,
    addlMpCents: 1.5,
  },
  "flux-2-flex": {
    id: "flux-2-flex",
    label: "FLUX.2 [flex]",
    shortLabel: "flex",
    endpoint: "flux-2-flex",
    tier: "typography",
    firstMpCents: 5,
    addlMpCents: 5,
  },
  "flux-2-max": {
    id: "flux-2-max",
    label: "FLUX.2 [max]",
    shortLabel: "max",
    endpoint: "flux-2-max",
    tier: "max",
    firstMpCents: 7,
    addlMpCents: 3,
  },
};

/** True if `id` is a known model — use before interpolating it into a URL. */
export function isFluxModelId(id: string): id is FluxModelId {
  return Object.prototype.hasOwnProperty.call(FLUX_MODELS, id);
}

/** Full submit URL for a model id. */
export function endpointFor(id: FluxModelId): string {
  return `${FLUX_BASE_URL}/${FLUX_MODELS[id].endpoint}`;
}

/**
 * Rough cost estimate (USD) for one generation. Pass `inputMp` = 0 for pure
 * text-to-image, or the input image's megapixels for editing (I2I) — the input
 * term is billed at the additional-MP rate.
 */
export function estimateCostUsd(
  id: FluxModelId,
  width: number,
  height: number,
  inputMp = 0,
): number {
  const model = FLUX_MODELS[id];
  const outputMp = (width * height) / 1_000_000;
  const cents =
    model.firstMpCents +
    Math.max(0, outputMp - 1) * model.addlMpCents +
    inputMp * model.addlMpCents;
  return cents / 100;
}
