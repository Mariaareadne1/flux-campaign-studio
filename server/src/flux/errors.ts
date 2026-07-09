import type { ApiError } from "../../../shared/types";

/**
 * A single error type for everything that can go wrong talking to FLUX:
 * a non-2xx HTTP response, a network failure, a bad status, or a blocked URL.
 * Carries an HTTP `status` so routes can relay it straight to the client.
 */
export class FluxError extends Error {
  readonly status: number;
  readonly detail?: string;

  constructor(message: string, status = 502, detail?: string) {
    super(message);
    this.name = "FluxError";
    this.status = status;
    this.detail = detail;
  }

  /** Shape this error into the JSON body our API routes return. */
  toApiError(): ApiError {
    return this.detail
      ? { error: this.message, detail: this.detail }
      : { error: this.message };
  }
}

/**
 * Turn an unknown thrown value into a FluxError. Already-FluxErrors pass through;
 * everything else becomes a 502 ("failed to reach FLUX").
 */
export function normalizeError(err: unknown): FluxError {
  if (err instanceof FluxError) return err;
  return new FluxError("Failed to reach FLUX.", 502, String(err));
}

/**
 * SSRF guard shared by the polling and image-download paths: we fetch URLs the
 * client hands us, so only ever follow BFL-owned https hosts.
 */
export function isBflUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === "https:" &&
      (u.hostname === "bfl.ai" || u.hostname.endsWith(".bfl.ai"))
    );
  } catch {
    return false;
  }
}

/** Throw a 400 FluxError unless `raw` is an allowed BFL URL. */
export function assertBflUrl(raw: string, label = "url"): void {
  if (!isBflUrl(raw)) {
    throw new FluxError(`'${label}' must be a bfl.ai URL.`, 400);
  }
}

/**
 * Whether an error is worth retrying, following the bfl-api skill's guidance:
 * retry rate limits, timeouts, and 5xx; do NOT retry auth/payment/validation
 * (4xx) — e.g. a bad key or a content-policy rejection won't fix itself.
 */
export function isRetryable(err: unknown): boolean {
  const status = err instanceof FluxError ? err.status : 502;
  if (status === 429) return true; // rate limited
  if (status >= 500) return true; // server / timeout / network
  return false; // 400/401/402/403/404 — non-retryable
}
