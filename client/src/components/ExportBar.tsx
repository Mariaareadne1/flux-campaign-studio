import { useState } from "react";
import type { PlanStep } from "../../../shared/types";
import { completedImageSteps, useAppState } from "../state/store";

/** e.g. "hero" + 1024x1024 -> "campaign-hero-1024x1024.png" */
function filenameFor(step: PlanStep): string {
  const ext = step.resultUrl?.split(".").pop() ?? "png";
  const size = step.width && step.height ? `-${step.width}x${step.height}` : "";
  return `campaign-${step.id}${size}.${ext}`;
}

/**
 * Fetch a persisted asset and save it as a file. Results live on our own
 * backend (/api/uploads/...), so we download them directly — the /api/image
 * proxy is only needed for raw (expiring, CORS-less) FLUX URLs.
 */
async function downloadAsset(url: string, filename: string): Promise<void> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to download ${filename}.`);
  const blob = await resp.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export function ExportBar() {
  const { job } = useAppState();
  const images = completedImageSteps(job);
  const done = job?.status === "done";
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDownloadAll() {
    setError(null);
    setDownloading(true);
    try {
      for (const step of images) {
        if (!step.resultUrl) continue;
        await downloadAsset(step.resultUrl, filenameFor(step));
        // Small gap so browsers don't drop back-to-back downloads.
        await new Promise((r) => setTimeout(r, 250));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <footer className="flex items-center justify-between border-t border-neutral-200 bg-white px-4 py-2.5">
      <span className="text-xs text-neutral-500">
        {error ? (
          <span className="text-red-600">{error}</span>
        ) : images.length > 0 ? (
          `${images.length} asset${images.length === 1 ? "" : "s"} generated`
        ) : (
          "No assets yet"
        )}
      </span>
      <button
        onClick={onDownloadAll}
        disabled={!done || images.length === 0 || downloading}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {downloading ? "Downloading…" : "Download all"}
      </button>
    </footer>
  );
}
