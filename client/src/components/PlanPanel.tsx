import { useEffect, useRef } from "react";
import { useAppState } from "../state/store";
import { StepCard } from "./StepCard";

export function PlanPanel() {
  const { job } = useAppState();
  const steps = job?.plan.steps ?? [];
  const listRef = useRef<HTMLDivElement>(null);

  // The first non-terminal step is the one currently in focus.
  const activeId = steps.find(
    (s) => s.status === "running" || s.status === "pending",
  )?.id;

  const totalCost = steps.reduce((sum, s) => sum + (s.estCostUsd ?? 0), 0);

  // Keep the active step in view as the agent advances.
  useEffect(() => {
    if (!activeId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-step-id="${activeId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeId]);

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50">
      <div className="border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">Agent plan</h2>
          {totalCost > 0 && (
            <span className="font-mono text-xs text-neutral-500">
              ~${totalCost.toFixed(2)}
            </span>
          )}
        </div>
        <p className="text-xs text-neutral-500">
          {job ? "Live step-by-step progress" : "Steps appear here on run"}
        </p>
      </div>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {steps.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-neutral-400">
            No plan yet. Upload a product photo and run a campaign.
          </p>
        ) : (
          steps.map((step) => (
            <StepCard key={step.id} step={step} active={step.id === activeId} />
          ))
        )}
      </div>
    </aside>
  );
}
