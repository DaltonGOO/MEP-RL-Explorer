import React, { useEffect, useState } from "react";
import { useSimStore, MEPParams } from "../store/useSimStore";
import { useTrainStore } from "../store/useTrainStore";
import LayoutBuilder from "./LayoutBuilder";

const ROOMS = [
  { id: "simple", label: "Simple Room", desc: "Column in center" },
  { id: "corridor", label: "Corridor", desc: "Wall with gap at top" },
  { id: "multi_floor", label: "Multi Floor", desc: "Find the shaft" },
  { id: "ceiling_beams", label: "Ceiling Beams", desc: "Navigate between beams" },
];

const MEP_PRESETS: Record<string, Partial<MEPParams>> = {
  duct: {
    name: "duct", cross_section_mm: 400, clearance_m: 0.15, voxel_size_m: 0.3,
    reward_target: 100, reward_step: -1, reward_collision: -5,
    reward_turn_horizontal: -0.5, reward_turn_vertical: -2,
    reward_vertical_per_voxel: -0.3, reward_revisit: -2,
    max_steps: 300, min_straight_before_bend: 0,
  },
  pipe: {
    name: "pipe", cross_section_mm: 100, clearance_m: 0.05, voxel_size_m: 0.2,
    reward_target: 100, reward_step: -1, reward_collision: -5,
    reward_turn_horizontal: -1, reward_turn_vertical: -3,
    reward_vertical_per_voxel: -0.5, reward_revisit: -2,
    max_steps: 400, min_straight_before_bend: 2,
  },
  cable_tray: {
    name: "cable_tray", cross_section_mm: 300, clearance_m: 0.10, voxel_size_m: 0.3,
    reward_target: 100, reward_step: -0.5, reward_collision: -5,
    reward_turn_horizontal: -0.3, reward_turn_vertical: -1,
    reward_vertical_per_voxel: -0.2, reward_revisit: -1.5,
    max_steps: 300, min_straight_before_bend: 0,
  },
};

const SLIDERS: { key: keyof MEPParams; label: string; min: number; max: number; step: number }[] = [
  { key: "reward_step", label: "Step Penalty", min: -5, max: 0, step: 0.1 },
  { key: "reward_collision", label: "Collision Penalty", min: -20, max: 0, step: 0.5 },
  { key: "reward_turn_horizontal", label: "Horizontal Turn", min: -5, max: 0, step: 0.1 },
  { key: "reward_turn_vertical", label: "Vertical Turn", min: -10, max: 0, step: 0.5 },
  { key: "reward_vertical_per_voxel", label: "Vertical Travel", min: -3, max: 0, step: 0.1 },
  { key: "reward_revisit", label: "Revisit Penalty", min: -10, max: 0, step: 0.5 },
  { key: "min_straight_before_bend", label: "Min Straight Before Bend", min: 0, max: 5, step: 1 },
  { key: "reward_target", label: "Target Reward", min: 10, max: 500, step: 10 },
];

const styles = {
  panel: {
    padding: "16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
    height: "100%",
    overflowY: "auto" as const,
  },
  section: {
    background: "#141420",
    borderRadius: "8px",
    padding: "12px",
  },
  sectionTitle: {
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    color: "#888",
    letterSpacing: "0.05em",
    marginBottom: "8px",
  },
  select: {
    width: "100%",
    padding: "8px",
    background: "#1a1a2e",
    color: "#e0e0e0",
    border: "1px solid #333",
    borderRadius: "4px",
    fontSize: "13px",
    cursor: "pointer",
  },
  presetRow: {
    display: "flex",
    gap: "4px",
  },
  presetBtn: (active: boolean) => ({
    flex: 1,
    padding: "8px 4px",
    background: active ? "#2a4a8a" : "#1a1a2e",
    color: active ? "#fff" : "#aaa",
    border: active ? "1px solid #4488ff" : "1px solid #333",
    borderRadius: "4px",
    fontSize: "12px",
    cursor: "pointer",
    fontWeight: active ? 600 : 400,
  }),
  slider: {
    width: "100%",
    accentColor: "#4488ff",
  },
  sliderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "12px",
    color: "#aaa",
  },
  sliderValue: {
    color: "#4488ff",
    fontWeight: 600,
    fontSize: "12px",
    minWidth: "40px",
    textAlign: "right" as const,
  },
  btn: (variant: "primary" | "secondary" | "danger") => ({
    width: "100%",
    padding: "10px",
    borderRadius: "6px",
    border: "none",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    ...(variant === "primary"
      ? { background: "#4488ff", color: "#fff" }
      : variant === "danger"
      ? { background: "#cc3333", color: "#fff" }
      : { background: "#1a1a2e", color: "#aaa", border: "1px solid #333" }),
  }),
  trainInput: {
    width: "100%",
    padding: "8px",
    background: "#1a1a2e",
    color: "#e0e0e0",
    border: "1px solid #333",
    borderRadius: "4px",
    fontSize: "13px",
  },
  progressBar: {
    width: "100%",
    height: "6px",
    background: "#1a1a2e",
    borderRadius: "3px",
    overflow: "hidden" as const,
  },
  progressFill: (pct: number) => ({
    width: `${pct * 100}%`,
    height: "100%",
    background: "#4488ff",
    transition: "width 0.3s",
  }),
  speedRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
  },
  stat: {
    fontSize: "13px",
    color: "#ccc",
    display: "flex",
    justifyContent: "space-between",
  },
};

interface SavedModel {
  model_id: string;
  mep: string;
  room: string;
  filename: string;
}

interface Props {
  onBuildScene: () => void;
  onTrain: (timesteps: number) => void;
  onPlay: (mode: "random" | "agent") => void;
  onStop: () => void;
  onReset: () => void;
  onLoadModel: (filename: string) => void;
}

export default function ControlPanel({ onBuildScene, onTrain, onPlay, onStop, onReset, onLoadModel }: Props) {
  const layoutMode = useSimStore((s) => s.layoutMode);
  const setLayoutMode = useSimStore((s) => s.setLayoutMode);
  const room = useSimStore((s) => s.room);
  const mepPreset = useSimStore((s) => s.mepPreset);
  const mepParams = useSimStore((s) => s.mepParams);
  const isPlaying = useSimStore((s) => s.isPlaying);
  const isDone = useSimStore((s) => s.isDone);
  const reachedTarget = useSimStore((s) => s.reachedTarget);
  const totalReward = useSimStore((s) => s.totalReward);
  const stepRecords = useSimStore((s) => s.stepRecords);
  const playSpeed = useSimStore((s) => s.playSpeed);
  const sceneId = useSimStore((s) => s.sceneId);
  const setRoom = useSimStore((s) => s.setRoom);
  const setMepPreset = useSimStore((s) => s.setMepPreset);
  const updateMepParam = useSimStore((s) => s.updateMepParam);
  const setPlaySpeed = useSimStore((s) => s.setPlaySpeed);

  const trainStatus = useTrainStore((s) => s.status);
  const trainProgress = useTrainStore((s) => s.progress);
  const modelWeights = useTrainStore((s) => s.modelWeights);
  const trainError = useTrainStore((s) => s.error);

  const [timesteps, setTimesteps] = useState(50000);
  const [savedModels, setSavedModels] = useState<SavedModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("");

  // Refresh the saved-model list on mount and whenever a run finishes.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/models")
      .then((r) => (r.ok ? r.json() : { models: [] }))
      .then((d) => {
        if (cancelled) return;
        const models: SavedModel[] = d.models ?? [];
        setSavedModels(models);
        setSelectedModel((cur) =>
          cur || (models.length ? models[models.length - 1].filename : "")
        );
      })
      .catch(() => { /* backend not running — training is unavailable anyway */ });
    return () => { cancelled = true; };
  }, [trainStatus]);

  const handlePreset = (preset: string) => {
    setMepPreset(preset);
    const params = MEP_PRESETS[preset];
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        updateMepParam(k as keyof MEPParams, v as number);
      });
    }
  };

  return (
    <div style={styles.panel}>
      {/* Layout Selection */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Layout</div>
        <div style={styles.presetRow}>
          <button
            style={styles.presetBtn(layoutMode === "preset")}
            onClick={() => setLayoutMode("preset")}
          >
            Presets
          </button>
          <button
            style={styles.presetBtn(layoutMode === "custom")}
            onClick={() => setLayoutMode("custom")}
          >
            Custom
          </button>
        </div>
        {layoutMode === "preset" ? (
          <select
            style={{ ...styles.select, marginTop: "8px" }}
            value={room}
            onChange={(e) => setRoom(e.target.value)}
          >
            {ROOMS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label} — {r.desc}
              </option>
            ))}
          </select>
        ) : (
          <div style={{ marginTop: "8px" }}>
            <LayoutBuilder />
          </div>
        )}
      </div>

      {/* MEP Preset */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>MEP System</div>
        <div style={styles.presetRow}>
          {Object.keys(MEP_PRESETS).map((p) => (
            <button
              key={p}
              style={styles.presetBtn(mepPreset === p)}
              onClick={() => handlePreset(p)}
            >
              {p.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Build Scene */}
      <button style={styles.btn("primary")} onClick={onBuildScene}>
        Build Scene
      </button>

      {/* Reward Sliders */}
      {sceneId !== null && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Reward Parameters</div>
          {SLIDERS.map(({ key, label, min, max, step }) => (
            <div key={key} style={{ marginBottom: "8px" }}>
              <div style={styles.sliderRow}>
                <span>{label}</span>
                <span style={styles.sliderValue}>
                  {(mepParams[key] as number).toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                style={styles.slider}
                min={min}
                max={max}
                step={step}
                value={mepParams[key] as number}
                onChange={(e) => updateMepParam(key, parseFloat(e.target.value))}
              />
            </div>
          ))}
        </div>
      )}

      {/* Training */}
      {sceneId !== null && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Training</div>
          <div style={{ marginBottom: "8px" }}>
            <label style={{ fontSize: "12px", color: "#888" }}>Timesteps</label>
            <input
              type="number"
              style={styles.trainInput}
              value={timesteps}
              onChange={(e) => setTimesteps(parseInt(e.target.value) || 50000)}
              min={1000}
              step={10000}
            />
          </div>
          {trainStatus === "running" ? (
            <>
              <div style={styles.progressBar}>
                <div style={styles.progressFill(trainProgress)} />
              </div>
              <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
                {Math.round(trainProgress * 100)}% complete
              </div>
            </>
          ) : (
            <button
              style={styles.btn("primary")}
              onClick={() => onTrain(timesteps)}
            >
              Train Agent
            </button>
          )}
          {trainStatus === "completed" && (
            <div style={{ fontSize: "12px", color: "#32cd32", marginTop: "4px" }}>
              Training complete — model ready
            </div>
          )}
          {trainStatus === "failed" && (
            <div style={{ fontSize: "11px", color: "#ff4444", marginTop: "4px" }}>
              {trainError}
            </div>
          )}
        </div>
      )}

      {/* Saved models — a trained policy outlives the page that made it */}
      {sceneId !== null && savedModels.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Saved Models</div>
          <select
            style={styles.select}
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            {savedModels.map((m) => (
              <option key={m.filename} value={m.filename}>
                {m.room} · {m.mep} · {m.model_id}
              </option>
            ))}
          </select>
          <button
            style={{ ...styles.btn("secondary"), marginTop: "6px" }}
            onClick={() => selectedModel && onLoadModel(selectedModel)}
          >
            Load for Playback
          </button>
          <div style={{ fontSize: "10px", color: "#666", marginTop: "6px" }}>
            Build the matching room first — a policy trained on one layout
            will not route another.
          </div>
        </div>
      )}

      {/* Playback */}
      {sceneId !== null && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Playback</div>
          <div style={styles.speedRow}>
            <span style={{ color: "#888" }}>Speed</span>
            <input
              type="range"
              style={{ ...styles.slider, flex: 1 }}
              min={10}
              max={500}
              step={10}
              value={playSpeed}
              onChange={(e) => setPlaySpeed(parseInt(e.target.value))}
            />
            <span style={styles.sliderValue}>{playSpeed}ms</span>
          </div>
          <div style={{ display: "flex", gap: "4px", marginTop: "8px" }}>
            {!isPlaying ? (
              <>
                <button
                  style={{ ...styles.btn("secondary"), flex: 1 }}
                  onClick={() => onPlay("random")}
                >
                  Random
                </button>
                <button
                  style={{
                    ...styles.btn(modelWeights ? "primary" : "secondary"),
                    flex: 1,
                    opacity: modelWeights ? 1 : 0.5,
                  }}
                  onClick={() => onPlay("agent")}
                  disabled={!modelWeights}
                >
                  Agent
                </button>
              </>
            ) : (
              <button style={styles.btn("danger")} onClick={onStop}>
                Stop
              </button>
            )}
          </div>
          {isDone && (
            <button
              style={{ ...styles.btn("secondary"), marginTop: "8px" }}
              onClick={onReset}
            >
              Reset Episode
            </button>
          )}
        </div>
      )}

      {/* Stats */}
      {stepRecords.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Episode Stats</div>
          <div style={styles.stat}>
            <span>Steps</span>
            <span>{stepRecords.length}</span>
          </div>
          <div style={styles.stat}>
            <span>Total Reward</span>
            <span style={{ color: totalReward >= 0 ? "#32cd32" : "#ff6666" }}>
              {totalReward.toFixed(1)}
            </span>
          </div>
          {isDone && (
            <div style={styles.stat}>
              <span>Result</span>
              <span style={{ color: reachedTarget ? "#32cd32" : "#ff6666" }}>
                {reachedTarget ? "TARGET REACHED" : "FAILED"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
