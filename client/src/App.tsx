import { Canvas } from "./components/Canvas";
import { ExportBar } from "./components/ExportBar";
import { GoalInput } from "./components/GoalInput";
import { PlanPanel } from "./components/PlanPanel";
import { StoreProvider, useAppState } from "./state/store";

function ErrorBanner() {
  const { error } = useAppState();
  if (!error) return null;
  return (
    <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
      {error}
    </div>
  );
}

function Studio() {
  return (
    <div className="flex h-full flex-col">
      <GoalInput />
      <ErrorBanner />
      <div className="flex min-h-0 flex-1">
        <PlanPanel />
        <Canvas />
      </div>
      <ExportBar />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Studio />
    </StoreProvider>
  );
}
