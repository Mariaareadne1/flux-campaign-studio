import { completedImageSteps, useAppState } from "../state/store";

export function ExportBar() {
  const { job } = useAppState();
  const images = completedImageSteps(job);
  const done = job?.status === "done";

  // Download wiring lands in Task 5.
  function onDownloadAll() {}

  return (
    <footer className="flex items-center justify-between border-t border-neutral-200 bg-white px-4 py-2.5">
      <span className="text-xs text-neutral-500">
        {images.length > 0
          ? `${images.length} asset${images.length === 1 ? "" : "s"} generated`
          : "No assets yet"}
      </span>
      <button
        onClick={onDownloadAll}
        disabled={!done || images.length === 0}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Download all
      </button>
    </footer>
  );
}
