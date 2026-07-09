import { useRef, type ChangeEvent } from "react";
import { fileToDataUrl, uploadImage } from "../api/client";
import { useAppDispatch, useAppState } from "../state/store";

export function GoalInput() {
  const { goal, upload, busy, job } = useAppState();
  const dispatch = useAppDispatch();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    dispatch({ type: "SET_ERROR", error: null });
    dispatch({ type: "SET_BUSY", busy: true });
    try {
      const dataUrl = await fileToDataUrl(file);
      const uploaded = await uploadImage(dataUrl);
      dispatch({ type: "SET_UPLOAD", upload: uploaded });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      dispatch({ type: "SET_BUSY", busy: false });
    }
  }

  // Run wiring lands in Task 4.
  function onRun() {}

  const running = job?.status === "running";
  const canRun = !!upload && goal.trim().length > 0 && !busy && !running;

  return (
    <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy || running}
          className="whitespace-nowrap rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
        >
          {upload ? "Change photo" : "Upload product photo"}
        </button>
        {upload && (
          <img
            src={upload.url}
            alt="Product thumbnail"
            className="h-8 w-8 rounded border border-neutral-200 object-cover"
          />
        )}
      </div>

      <input
        type="text"
        value={goal}
        onChange={(e) => dispatch({ type: "SET_GOAL", goal: e.target.value })}
        placeholder="Describe your campaign goal, e.g. “turn this into a launch campaign”"
        className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-500"
      />

      <button
        onClick={onRun}
        disabled={!canRun}
        className="whitespace-nowrap rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {running ? "Running…" : "Run campaign"}
      </button>
    </header>
  );
}
