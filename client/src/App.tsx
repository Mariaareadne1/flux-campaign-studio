import { useState } from "react";
import type { FluxStatus } from "../../shared/types";
import { generateAndWait } from "./api/client";

// Phase 0 spike: one button proves submit -> poll -> proxy-download works
// end to end against the real FLUX API. The real UI arrives in Phase 1.
const DEMO_PROMPT =
  "A minimalist product photograph of a matte ceramic coffee mug on a bright " +
  "studio backdrop, soft natural light, shallow depth of field, high detail.";

type Phase = "idle" | "running" | "done" | "error";

export default function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState<FluxStatus | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPhase("running");
    setStatus(null);
    setImageUrl(null);
    setError(null);
    try {
      const url = await generateAndWait(
        { prompt: DEMO_PROMPT, model: "flux-2-pro", width: 1024, height: 1024 },
        setStatus,
      );
      setImageUrl(url);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold text-neutral-900">
          FLUX Campaign Studio
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Phase 0 spike — generate one image to prove the async pipeline.
        </p>
      </header>

      <button
        onClick={run}
        disabled={phase === "running"}
        className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {phase === "running" ? "Generating…" : "Generate demo image"}
      </button>

      {phase === "running" && (
        <p className="text-sm text-neutral-600">
          Status: <span className="font-mono">{status ?? "submitting"}</span>
        </p>
      )}

      {phase === "error" && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {imageUrl && (
        <img
          src={imageUrl}
          alt="Generated result"
          className="w-full rounded-lg border border-neutral-200"
        />
      )}
    </div>
  );
}
