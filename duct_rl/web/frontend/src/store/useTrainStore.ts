import { create } from "zustand";

export interface TrainMetric {
  timestep: number;
  ep_rew_mean: number | null;
  ep_len_mean: number | null;
}

export interface TrainState {
  jobId: string | null;
  status: string; // "idle", "running", "completed", "failed", "cancelled"
  progress: number;
  metrics: TrainMetric[];
  modelWeights: string | null; // JSON weights for WASM inference
  error: string | null;

  startJob: (jobId: string) => void;
  addMetric: (metric: TrainMetric) => void;
  setProgress: (progress: number) => void;
  setCompleted: (weightsJson: string | null) => void;
  setFailed: (error: string) => void;
  reset: () => void;
}

export const useTrainStore = create<TrainState>((set) => ({
  jobId: null,
  status: "idle",
  progress: 0,
  metrics: [],
  modelWeights: null,
  error: null,

  startJob: (jobId) =>
    set({ jobId, status: "running", progress: 0, metrics: [], error: null }),
  addMetric: (metric) =>
    set((s) => ({ metrics: [...s.metrics, metric] })),
  setProgress: (progress) => set({ progress }),
  setCompleted: (weightsJson) =>
    set({ status: "completed", progress: 1, modelWeights: weightsJson }),
  setFailed: (error) => set({ status: "failed", error }),
  reset: () =>
    set({
      jobId: null,
      status: "idle",
      progress: 0,
      metrics: [],
      modelWeights: null,
      error: null,
    }),
}));
