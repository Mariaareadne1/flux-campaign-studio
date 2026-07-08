import type { PlanStep, StepKind, StepStatus } from "../../../shared/types";

const KIND_LABEL: Record<StepKind, string> = {
  generate: "Generate",
  edit: "Edit",
  reframe: "Reframe",
  export: "Export",
};

const STATUS_STYLES: Record<StepStatus, { dot: string; text: string }> = {
  pending: { dot: "bg-neutral-300", text: "text-neutral-400" },
  running: { dot: "bg-blue-500 animate-pulse", text: "text-blue-600" },
  done: { dot: "bg-emerald-500", text: "text-emerald-600" },
  failed: { dot: "bg-red-500", text: "text-red-600" },
};

export function StepCard({ step, active }: { step: PlanStep; active: boolean }) {
  const status = STATUS_STYLES[step.status];
  return (
    <div
      className={`rounded-lg border bg-white p-3 transition ${
        active ? "border-neutral-900 shadow-sm" : "border-neutral-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${status.dot}`} />
          <span className="text-sm font-medium text-neutral-900">
            {step.label}
          </span>
        </div>
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
          {KIND_LABEL[step.kind]}
        </span>
      </div>

      <p className="mt-1.5 line-clamp-2 text-xs text-neutral-500">
        {step.prompt}
      </p>

      <div className="mt-2 flex items-center justify-between">
        <span className="font-mono text-[10px] text-neutral-400">
          {step.model}
        </span>
        <span className={`text-[11px] font-medium capitalize ${status.text}`}>
          {step.status}
        </span>
      </div>

      {step.status === "failed" && step.error && (
        <p className="mt-1.5 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-600">
          {step.error}
        </p>
      )}
    </div>
  );
}
