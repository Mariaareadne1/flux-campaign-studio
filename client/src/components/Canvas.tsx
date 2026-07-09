import { useState } from "react";
import { completedImageSteps, useAppState } from "../state/store";

export function Canvas() {
  const { job, upload } = useAppState();
  const images = completedImageSteps(job);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Show the selected image, else the most recent completed one.
  const selected =
    images.find((s) => s.id === selectedId) ?? images[images.length - 1];

  const runningStep = job?.plan.steps.find((s) => s.status === "running");

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-white">
      <div className="flex flex-1 items-center justify-center overflow-auto p-8">
        {selected?.resultUrl ? (
          <figure
            key={selected.id}
            className="animate-fade-in flex max-h-full flex-col items-center gap-3"
          >
            <img
              src={selected.resultUrl}
              alt={selected.label}
              className="max-h-[60vh] rounded-lg border border-neutral-200 object-contain shadow-sm"
            />
            <figcaption className="text-xs text-neutral-500">
              {selected.label}
            </figcaption>
          </figure>
        ) : runningStep ? (
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-800" />
            <p className="text-sm text-neutral-600">{runningStep.label}…</p>
            <p className="mt-1 text-xs text-neutral-400">
              generating with {runningStep.model}
            </p>
          </div>
        ) : upload ? (
          <figure className="flex flex-col items-center gap-3 opacity-80">
            <img
              src={upload.url}
              alt="Uploaded product"
              className="max-h-[50vh] rounded-lg border border-dashed border-neutral-300 object-contain"
            />
            <figcaption className="text-xs text-neutral-400">
              Product photo — run a campaign to generate assets
            </figcaption>
          </figure>
        ) : (
          <div className="text-center text-sm text-neutral-400">
            <p>Upload a product photo and run a campaign</p>
            <p className="mt-1 text-xs">Generated assets render here, live.</p>
          </div>
        )}
      </div>

      {images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-t border-neutral-200 p-3">
          {images.map((step) => {
            const isActive = (selected?.id ?? null) === step.id;
            return (
              <button
                key={step.id}
                onClick={() => setSelectedId(step.id)}
                title={step.label}
                className={`animate-fade-in h-16 w-16 shrink-0 overflow-hidden rounded-md border ${
                  isActive ? "border-neutral-900" : "border-neutral-200"
                }`}
              >
                <img
                  src={step.resultUrl}
                  alt={step.label}
                  className="h-full w-full object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}
