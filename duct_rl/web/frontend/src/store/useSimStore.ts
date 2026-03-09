import { create } from "zustand";

export interface RewardBreakdown {
  step_penalty: number;
  distance_delta: number;
  turn_penalty: number;
  vertical_penalty: number;
  revisit_penalty: number;
  collision_penalty: number;
  target_bonus: number;
  total: number;
}

export interface StepRecord {
  position: [number, number, number];
  reward: number;
  breakdown: RewardBreakdown;
  action: number;
}

export interface MEPParams {
  name: string;
  cross_section_mm: number;
  clearance_m: number;
  voxel_size_m: number;
  reward_target: number;
  reward_step: number;
  reward_collision: number;
  reward_turn_horizontal: number;
  reward_turn_vertical: number;
  reward_vertical_per_voxel: number;
  reward_revisit: number;
  max_steps: number;
  min_straight_before_bend: number;
}

export interface SceneInfo {
  nx: number;
  ny: number;
  nz: number;
  voxel_size: number;
  origin: [number, number, number];
  start_ijk: [number, number, number];
  target_ijk: [number, number, number];
}

export interface ObstacleBox {
  x_min: number; y_min: number; z_min: number;
  x_max: number; y_max: number; z_max: number;
}

export interface CustomLayout {
  name: string;
  room_min: [number, number, number];
  room_max: [number, number, number];
  obstacles: ObstacleBox[];
  start: [number, number, number];
  target: [number, number, number];
}

export interface SimState {
  // Layout
  layoutMode: "preset" | "custom";
  room: string;
  customLayout: CustomLayout;
  savedLayouts: CustomLayout[];

  // Scene
  mepPreset: string;
  mepParams: MEPParams;
  sceneId: number | null;
  stateId: number | null;
  sceneInfo: SceneInfo | null;
  obstaclePositions: Float32Array | null;

  // Episode
  path: [number, number, number][];
  stepRecords: StepRecord[];
  isPlaying: boolean;
  playSpeed: number; // ms per step
  isDone: boolean;
  reachedTarget: boolean;
  totalReward: number;

  // Actions
  setLayoutMode: (mode: "preset" | "custom") => void;
  setRoom: (room: string) => void;
  setCustomLayout: (layout: CustomLayout) => void;
  saveLayout: (layout: CustomLayout) => void;
  deleteLayout: (name: string) => void;
  loadSavedLayout: (name: string) => void;
  setMepPreset: (preset: string) => void;
  updateMepParam: (key: keyof MEPParams, value: number) => void;
  setScene: (sceneId: number, info: SceneInfo, obstacles: Float32Array) => void;
  setStateId: (stateId: number) => void;
  addStep: (record: StepRecord) => void;
  setPlaying: (playing: boolean) => void;
  setPlaySpeed: (speed: number) => void;
  setDone: (done: boolean, reached: boolean) => void;
  resetEpisode: () => void;
}

const DEFAULT_MEP: MEPParams = {
  name: "duct",
  cross_section_mm: 400,
  clearance_m: 0.15,
  voxel_size_m: 0.3,
  reward_target: 100,
  reward_step: -1,
  reward_collision: -5,
  reward_turn_horizontal: -0.5,
  reward_turn_vertical: -2,
  reward_vertical_per_voxel: -0.3,
  reward_revisit: -2,
  max_steps: 300,
  min_straight_before_bend: 0,
};

const DEFAULT_CUSTOM_LAYOUT: CustomLayout = {
  name: "Custom",
  room_min: [0, 0, 0],
  room_max: [10, 10, 3],
  obstacles: [],
  start: [1, 1, 1.5],
  target: [9, 9, 1.5],
};

const STORAGE_KEY = "mep-rl-layouts";

function loadLayouts(): CustomLayout[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persistLayouts(layouts: CustomLayout[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
}

export const useSimStore = create<SimState>((set, get) => ({
  layoutMode: "preset",
  room: "simple",
  customLayout: { ...DEFAULT_CUSTOM_LAYOUT },
  savedLayouts: loadLayouts(),

  mepPreset: "duct",
  mepParams: { ...DEFAULT_MEP },
  sceneId: null,
  stateId: null,
  sceneInfo: null,
  obstaclePositions: null,
  path: [],
  stepRecords: [],
  isPlaying: false,
  playSpeed: 100,
  isDone: false,
  reachedTarget: false,
  totalReward: 0,

  setLayoutMode: (mode) => set({ layoutMode: mode }),
  setRoom: (room) => set({ room }),
  setCustomLayout: (layout) => set({ customLayout: layout }),
  saveLayout: (layout) => {
    const existing = get().savedLayouts.filter((l) => l.name !== layout.name);
    const updated = [...existing, layout];
    persistLayouts(updated);
    set({ savedLayouts: updated });
  },
  deleteLayout: (name) => {
    const updated = get().savedLayouts.filter((l) => l.name !== name);
    persistLayouts(updated);
    set({ savedLayouts: updated });
  },
  loadSavedLayout: (name) => {
    const found = get().savedLayouts.find((l) => l.name === name);
    if (found) set({ customLayout: { ...found } });
  },
  setMepPreset: (preset) => set({ mepPreset: preset }),
  updateMepParam: (key, value) =>
    set((s) => ({ mepParams: { ...s.mepParams, [key]: value } })),
  setScene: (sceneId, info, obstacles) =>
    set({
      sceneId,
      sceneInfo: info,
      obstaclePositions: obstacles,
      path: [],
      stepRecords: [],
      isDone: false,
      reachedTarget: false,
      totalReward: 0,
    }),
  setStateId: (stateId) => set({ stateId }),
  addStep: (record) =>
    set((s) => ({
      path: [...s.path, record.position],
      stepRecords: [...s.stepRecords, record],
      totalReward: s.totalReward + record.reward,
    })),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setPlaySpeed: (speed) => set({ playSpeed: speed }),
  setDone: (done, reached) =>
    set({ isDone: done, reachedTarget: reached, isPlaying: false }),
  resetEpisode: () =>
    set({
      path: [],
      stepRecords: [],
      isDone: false,
      reachedTarget: false,
      totalReward: 0,
      stateId: null,
    }),
}));
