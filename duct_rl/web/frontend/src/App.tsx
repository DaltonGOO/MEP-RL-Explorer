import React, { useCallback, useEffect, useRef, useState } from "react";
import SceneRenderer from "./three/SceneRenderer";
import ControlPanel from "./panels/ControlPanel";
import RewardPanel from "./panels/RewardPanel";
import TrainingDashboard from "./panels/TrainingDashboard";
import { useSimStore } from "./store/useSimStore";
import { useTrainStore } from "./store/useTrainStore";

const API = "/api";

/**
 * serde_wasm_bindgen serializes Rust structs/json! values as JS Maps.
 * This recursively converts Maps → plain objects, and detects
 * "array-like" Maps (keys 0,1,2…) → real JS arrays.
 */
function fromWasm(val: any): any {
  if (val instanceof Map) {
    // Check if it looks like an array (sequential integer keys)
    const keys = Array.from(val.keys());
    const isArray = keys.length > 0 && keys.every((k, i) => k === i);
    if (isArray) {
      return keys.map((k) => fromWasm(val.get(k)));
    }
    const obj: any = {};
    val.forEach((v: any, k: any) => { obj[k] = fromWasm(v); });
    return obj;
  }
  if (Array.isArray(val)) {
    return val.map(fromWasm);
  }
  return val;
}

const styles = {
  layout: {
    display: "flex",
    width: "100%",
    height: "100vh",
  },
  sidebar: {
    width: "320px",
    minWidth: "320px",
    borderRight: "1px solid #222",
    overflowY: "auto" as const,
    background: "#0d0d15",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
  },
  viewport: {
    flex: 1,
    position: "relative" as const,
  },
  bottomPanel: {
    height: "220px",
    borderTop: "1px solid #222",
    display: "flex",
    gap: "1px",
    background: "#222",
  },
  bottomHalf: {
    flex: 1,
    overflow: "auto",
    background: "#0d0d15",
    padding: "8px",
  },
  header: {
    padding: "16px",
    borderBottom: "1px solid #222",
    background: "#0d0d15",
  },
  title: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#fff",
  },
  subtitle: {
    fontSize: "12px",
    color: "#666",
    marginTop: "2px",
  },
  wasmBadge: {
    display: "inline-block",
    padding: "2px 8px",
    background: "#1a2a1a",
    color: "#32cd32",
    borderRadius: "4px",
    fontSize: "10px",
    fontWeight: 600,
    marginLeft: "8px",
  },
};

export default function App() {
  const [wasmReady, setWasmReady] = useState(false);
  const [wasmModule, setWasmModule] = useState<any>(null);
  const timerRef = useRef<number | null>(null);

  const store = useSimStore;
  const trainStore = useTrainStore;
  const liveDebounceRef = useRef<number | null>(null);

  // Subscribe to custom layout changes for live preview
  const customLayout = useSimStore((s) => s.customLayout);
  const layoutMode = useSimStore((s) => s.layoutMode);

  useEffect(() => {
    if (layoutMode !== "custom" || !wasmModule) return;

    if (liveDebounceRef.current) clearTimeout(liveDebounceRef.current);
    liveDebounceRef.current = window.setTimeout(() => {
      try {
        const { mepParams } = store.getState();
        const mep = new wasmModule.MEPConfig(
          mepParams.cross_section_mm, mepParams.clearance_m, mepParams.voxel_size_m,
          mepParams.reward_target, mepParams.reward_step, mepParams.reward_collision,
          mepParams.reward_turn_horizontal, mepParams.reward_turn_vertical,
          mepParams.reward_vertical_per_voxel, mepParams.reward_revisit,
          mepParams.max_steps, mepParams.min_straight_before_bend,
        );
        const geometryJson = JSON.stringify({
          room_min: customLayout.room_min,
          room_max: customLayout.room_max,
          obstacles: customLayout.obstacles,
          start: customLayout.start,
          target: customLayout.target,
        });
        const sceneId = wasmModule.create_scene_from_json(geometryJson, mep);
        const info = fromWasm(wasmModule.get_scene_info(sceneId));
        const obstacles = new Float32Array(wasmModule.get_obstacle_positions(sceneId));
        store.getState().setScene(sceneId, info, obstacles);

        // Reset episode to show start position
        store.getState().resetEpisode();
        const stateId = wasmModule.reset_episode(sceneId);
        store.getState().setStateId(stateId);
        const pos = wasmModule.get_state_position(stateId);
        store.getState().addStep({
          position: [pos[0], pos[1], pos[2]],
          reward: 0,
          breakdown: {
            step_penalty: 0, distance_delta: 0, turn_penalty: 0,
            vertical_penalty: 0, revisit_penalty: 0, collision_penalty: 0,
            target_bonus: 0, total: 0,
          },
          action: -1,
        });
      } catch (e) {
        console.warn("Live preview error:", e);
      }
    }, 250);

    return () => {
      if (liveDebounceRef.current) clearTimeout(liveDebounceRef.current);
    };
  }, [customLayout, layoutMode, wasmModule]);

  // Initialize WASM
  useEffect(() => {
    (async () => {
      try {
        const wasm = await import("mep-routing-core");
        await wasm.default();
        setWasmModule(wasm);
        setWasmReady(true);
      } catch (e) {
        console.warn("WASM not available — running in API-only mode", e);
        setWasmReady(false);
      }
    })();
  }, []);

  const handleBuildScene = useCallback(() => {
    if (!wasmModule) return;
    const { layoutMode, room, customLayout, mepParams } = store.getState();

    // Create MEPConfig in WASM
    const mep = new wasmModule.MEPConfig(
      mepParams.cross_section_mm,
      mepParams.clearance_m,
      mepParams.voxel_size_m,
      mepParams.reward_target,
      mepParams.reward_step,
      mepParams.reward_collision,
      mepParams.reward_turn_horizontal,
      mepParams.reward_turn_vertical,
      mepParams.reward_vertical_per_voxel,
      mepParams.reward_revisit,
      mepParams.max_steps,
      mepParams.min_straight_before_bend
    );

    let sceneId: number;
    if (layoutMode === "custom") {
      const geometryJson = JSON.stringify({
        room_min: customLayout.room_min,
        room_max: customLayout.room_max,
        obstacles: customLayout.obstacles,
        start: customLayout.start,
        target: customLayout.target,
      });
      sceneId = wasmModule.create_scene_from_json(geometryJson, mep);
    } else {
      sceneId = wasmModule.create_scene(room, mep);
    }
    const info = fromWasm(wasmModule.get_scene_info(sceneId));
    const obstacles = new Float32Array(wasmModule.get_obstacle_positions(sceneId));

    store.getState().setScene(sceneId, info, obstacles);

    // Auto-reset episode
    const stateId = wasmModule.reset_episode(sceneId);
    store.getState().setStateId(stateId);
    store.getState().resetEpisode();
    const stateId2 = wasmModule.reset_episode(sceneId);
    store.getState().setStateId(stateId2);

    // Add start position to path
    const pos = wasmModule.get_state_position(stateId2);
    store.getState().addStep({
      position: [pos[0], pos[1], pos[2]],
      reward: 0,
      breakdown: {
        step_penalty: 0, distance_delta: 0, turn_penalty: 0,
        vertical_penalty: 0, revisit_penalty: 0, collision_penalty: 0,
        target_bonus: 0, total: 0,
      },
      action: -1,
    });
  }, [wasmModule]);

  const handleTrain = useCallback(async (timesteps: number) => {
    const { layoutMode, room, customLayout, mepParams } = store.getState();

    try {
      const body: any = { mep: mepParams, timesteps };
      if (layoutMode === "custom") {
        body.geometry = {
          room_min: customLayout.room_min,
          room_max: customLayout.room_max,
          obstacles: customLayout.obstacles,
          start: customLayout.start,
          target: customLayout.target,
        };
      } else {
        body.room = room;
      }

      const res = await fetch(`${API}/train`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const { job_id } = await res.json();
      trainStore.getState().startJob(job_id);

      // Connect WebSocket for live metrics
      const ws = new WebSocket(
        `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/ws/train/${job_id}`
      );

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "metric") {
          trainStore.getState().addMetric(msg.data);
          trainStore.getState().setProgress(msg.progress);
        } else if (msg.type === "done") {
          if (msg.status === "completed" && msg.model_path) {
            // Fetch the model weights
            const filename = msg.model_path.split(/[/\\]/).pop();
            try {
              const wRes = await fetch(`${API}/models/${filename}/weights`);
              if (wRes.ok) {
                const weights = await wRes.json();
                trainStore.getState().setCompleted(JSON.stringify(weights));
              } else {
                trainStore.getState().setCompleted(null);
              }
            } catch {
              trainStore.getState().setCompleted(null);
            }
          } else {
            trainStore.getState().setFailed(msg.error || "Training failed");
          }
          ws.close();
        }
      };

      ws.onerror = () => {
        console.warn("WebSocket failed, falling back to polling");
        // Poll for training status instead
        const poll = setInterval(async () => {
          try {
            const r = await fetch(`${API}/train/${job_id}`);
            const data = await r.json();
            trainStore.getState().setProgress(data.progress || 0);
            if (data.metrics) {
              data.metrics.forEach((m: any) => trainStore.getState().addMetric(m));
            }
            if (data.status === "completed") {
              clearInterval(poll);
              if (data.model_path) {
                const filename = data.model_path.split(/[/\\]/).pop();
                try {
                  const wRes = await fetch(`${API}/models/${filename}/weights`);
                  if (wRes.ok) {
                    const weights = await wRes.json();
                    trainStore.getState().setCompleted(JSON.stringify(weights));
                  } else {
                    trainStore.getState().setCompleted(null);
                  }
                } catch {
                  trainStore.getState().setCompleted(null);
                }
              }
            } else if (data.status === "failed" || data.status === "cancelled") {
              clearInterval(poll);
              trainStore.getState().setFailed(data.error || "Training failed");
            }
          } catch { /* ignore poll errors */ }
        }, 1000);
      };
    } catch (e) {
      trainStore.getState().setFailed(String(e));
    }
  }, []);

  const handlePlay = useCallback(
    (mode: "random" | "agent") => {
      if (!wasmModule) return;
      const { sceneId, mepParams } = store.getState();
      if (sceneId === null) return;

      // Reset episode
      store.getState().resetEpisode();
      const stateId = wasmModule.reset_episode(sceneId);
      store.getState().setStateId(stateId);

      // Load model if agent mode
      let modelId: number | null = null;
      if (mode === "agent") {
        const weightsJson = trainStore.getState().modelWeights;
        if (!weightsJson) return;
        modelId = wasmModule.load_model(weightsJson);
      }

      const mep = new wasmModule.MEPConfig(
        mepParams.cross_section_mm,
        mepParams.clearance_m,
        mepParams.voxel_size_m,
        mepParams.reward_target,
        mepParams.reward_step,
        mepParams.reward_collision,
        mepParams.reward_turn_horizontal,
        mepParams.reward_turn_vertical,
        mepParams.reward_vertical_per_voxel,
        mepParams.reward_revisit,
        mepParams.max_steps,
        mepParams.min_straight_before_bend
      );

      // Add start position
      const startPos = wasmModule.get_state_position(stateId);
      store.getState().addStep({
        position: [startPos[0], startPos[1], startPos[2]],
        reward: 0,
        breakdown: {
          step_penalty: 0, distance_delta: 0, turn_penalty: 0,
          vertical_penalty: 0, revisit_penalty: 0, collision_penalty: 0,
          target_bonus: 0, total: 0,
        },
        action: -1,
      });

      store.getState().setPlaying(true);

      const stepFn = () => {
        const { sceneId: sid, stateId: stid, isPlaying, isDone } = store.getState();
        if (!isPlaying || isDone || sid === null || stid === null) {
          if (modelId !== null) wasmModule.free_model(modelId);
          return;
        }

        let action: number;
        if (mode === "agent" && modelId !== null) {
          const obs = wasmModule.get_obs(sid, stid);
          action = wasmModule.predict_action(modelId, Array.from(obs));
        } else {
          action = Math.floor(Math.random() * 6);
        }

        const result = fromWasm(wasmModule.step_episode(sid, stid, action, mep));

        store.getState().addStep({
          position: result.position,
          reward: result.reward,
          breakdown: result.breakdown,
          action,
        });

        if (result.done) {
          store.getState().setDone(true, result.reached_target);
          if (modelId !== null) wasmModule.free_model(modelId);
          return;
        }

        timerRef.current = window.setTimeout(stepFn, store.getState().playSpeed);
      };

      timerRef.current = window.setTimeout(stepFn, store.getState().playSpeed);
    },
    [wasmModule]
  );

  const handleStop = useCallback(() => {
    store.getState().setPlaying(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleReset = useCallback(() => {
    if (!wasmModule) return;
    const { sceneId } = store.getState();
    if (sceneId === null) return;

    store.getState().resetEpisode();
    const stateId = wasmModule.reset_episode(sceneId);
    store.getState().setStateId(stateId);

    const pos = wasmModule.get_state_position(stateId);
    store.getState().addStep({
      position: [pos[0], pos[1], pos[2]],
      reward: 0,
      breakdown: {
        step_penalty: 0, distance_delta: 0, turn_penalty: 0,
        vertical_penalty: 0, revisit_penalty: 0, collision_penalty: 0,
        target_bonus: 0, total: 0,
      },
      action: -1,
    });
  }, [wasmModule]);

  return (
    <div style={styles.layout}>
      <div style={styles.sidebar}>
        <div style={styles.header}>
          <div style={styles.title}>
            MEP RL Explorer
            {wasmReady && <span style={styles.wasmBadge}>WASM</span>}
          </div>
          <div style={styles.subtitle}>
            Reinforcement Learning for MEP Routing
          </div>
        </div>
        <ControlPanel
          onBuildScene={handleBuildScene}
          onTrain={handleTrain}
          onPlay={handlePlay}
          onStop={handleStop}
          onReset={handleReset}
        />
      </div>

      <div style={styles.main}>
        <div style={styles.viewport}>
          <SceneRenderer />
        </div>
        <div style={styles.bottomPanel}>
          <div style={styles.bottomHalf}>
            <RewardPanel />
          </div>
          <div style={styles.bottomHalf}>
            <TrainingDashboard />
          </div>
        </div>
      </div>
    </div>
  );
}
