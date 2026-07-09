import type { FluxModelId } from "../../shared/types";

/**
 * One place to tune the app. A forker changes models, retry behavior, default
 * sizes, and timeouts here without hunting through the codebase.
 */
export const CONFIG = {
  /**
   * Per-role model selection (cost-aware orchestration). Cheap/fast tiers for
   * drafts and mechanical reframes; the premium tier only for the hero.
   */
  models: {
    concept: "flux-2-klein-4b",
    hero: "flux-2-max",
    lifestyle: "flux-2-pro",
    reframe: "flux-2-klein-9b",
    social: "flux-2-flex", // best typography rendering
  } satisfies Record<string, FluxModelId>,

  /** Default output dimensions. Keep width/height multiples of 16 (BFL rule). */
  sizes: {
    base: { width: 1024, height: 1024 }, // concept / hero / lifestyle
    square: { width: 1024, height: 1024 }, // 1:1
    banner: { width: 1280, height: 720 }, // 16:9
    story: { width: 720, height: 1280 }, // 9:16
  },

  /** Executor retry + backoff between attempts. */
  retry: {
    maxRetries: 2,
    baseMs: 800,
    maxMs: 8_000,
  },

  /** Polling cadence and per-request network timeouts (ms). */
  timeouts: {
    pollIntervalMs: 500,
    pollTotalMs: 120_000,
    submitMs: 30_000,
    statusMs: 30_000,
    downloadMs: 60_000,
  },
} as const;
