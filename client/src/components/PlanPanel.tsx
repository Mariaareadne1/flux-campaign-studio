import { useAppState } from "../state/store";
import { StepCard } from "./StepCard";

export function PlanPanel() {
  const { job } = useAppState();
  const steps = job?.plan.steps ?? [];

  // The first non-terminal step is the one currently in focus.
  const activeId = steps.find(
    (s) => s.status === "running" || s.status === "pending",
  )?.id;

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50">
      <div className="border-b border-neutral-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">Agent plan</h2>
        <p className="text-xs text-neutral-500">
          {job ? "Live step-by-step progress" : "Steps appear here on run"}
        </p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
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
