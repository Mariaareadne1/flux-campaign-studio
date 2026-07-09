import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import type { CampaignType, Job, UploadResponse } from "../../../shared/types";

/**
 * App state for a single campaign session: the uploaded product image, the
 * typed goal, the chosen campaign type, and the current run (Job). The run's
 * live step statuses live inside `job.plan.steps` and are refreshed as the
 * server executor progresses.
 */
export interface AppState {
  upload: UploadResponse | null;
  goal: string;
  campaignType: CampaignType;
  job: Job | null;
  /** True while uploading or while a run is starting. */
  busy: boolean;
  error: string | null;
}

const initialState: AppState = {
  upload: null,
  goal: "",
  campaignType: "launch",
  job: null,
  busy: false,
  error: null,
};

export type Action =
  | { type: "SET_UPLOAD"; upload: UploadResponse | null }
  | { type: "SET_GOAL"; goal: string }
  | { type: "SET_CAMPAIGN_TYPE"; campaignType: CampaignType }
  | { type: "SET_JOB"; job: Job | null }
  | { type: "SET_BUSY"; busy: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "RESET" };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_UPLOAD":
      return { ...state, upload: action.upload, job: null, error: null };
    case "SET_GOAL":
      return { ...state, goal: action.goal };
    case "SET_CAMPAIGN_TYPE":
      return { ...state, campaignType: action.campaignType };
    case "SET_JOB":
      return { ...state, job: action.job };
    case "SET_BUSY":
      return { ...state, busy: action.busy };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}

const StateContext = createContext<AppState | null>(null);
const DispatchContext = createContext<Dispatch<Action> | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateValue = useMemo(() => state, [state]);
  return (
    <StateContext.Provider value={stateValue}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useAppState(): AppState {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error("useAppState must be used within <StoreProvider>");
  return ctx;
}

export function useAppDispatch(): Dispatch<Action> {
  const ctx = useContext(DispatchContext);
  if (!ctx) throw new Error("useAppDispatch must be used within <StoreProvider>");
  return ctx;
}

/** Completed steps that produced an image (used by Canvas and ExportBar). */
export function completedImageSteps(job: Job | null) {
  if (!job) return [];
  return job.plan.steps.filter(
    (s) => s.status === "done" && s.resultUrl && s.kind !== "export",
  );
}
