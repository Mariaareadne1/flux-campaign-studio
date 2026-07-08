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
  /**
   * Endpoint path segment appended to FLUX_BASE_URL. There are also `-preview`
   * variants (e.g. "flux-2-pro-preview") that get the newest improvements — we
   * pin the stable ones here; change this string to opt into preview.
   */
  endpoint: string;
  tier: FluxTier;
  /** Approximate price in USD per 1 megapixel generated. */
  pricePerMP: number;
}

/**
 * The model registry (see BUILD_SPEC Section 6). Endpoints are config values so
 * a forker can switch to preview variants or a different tier in one place.
 */
export const FLUX_MODELS: Record<FluxModelId, FluxModel> = {
  "flux-2-klein-4b": {
    id: "flux-2-klein-4b",
    label: "FLUX.2 [klein] 4B",
    endpoint: "flux-2-klein-4b",
    tier: "draft",
    pricePerMP: 0.014,
  },
  "flux-2-klein-9b": {
    id: "flux-2-klein-9b",
    label: "FLUX.2 [klein] 9B",
    endpoint: "flux-2-klein-9b",
    tier: "balanced",
    pricePerMP: 0.015,
  },
  "flux-2-pro": {
    id: "flux-2-pro",
    label: "FLUX.2 [pro]",
    endpoint: "flux-2-pro",
    tier: "production",
    pricePerMP: 0.03,
  },
  "flux-2-flex": {
    id: "flux-2-flex",
    label: "FLUX.2 [flex]",
    endpoint: "flux-2-flex",
    tier: "typography",
    pricePerMP: 0.06,
  },
  "flux-2-max": {
    id: "flux-2-max",
    label: "FLUX.2 [max]",
    endpoint: "flux-2-max",
    tier: "max",
    pricePerMP: 0.07,
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
 * Rough cost estimate (USD) for one image at the given pixel dimensions.
 * Pricing is per megapixel, so cost scales with width * height.
 */
export function estimateCost(
  id: FluxModelId,
  width: number,
  height: number,
): number {
  const megapixels = (width * height) / 1_000_000;
  return FLUX_MODELS[id].pricePerMP * megapixels;
}
