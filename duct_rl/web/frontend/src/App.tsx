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

  // ── WASM handle lifecycle ─────────────────────────────────────────────────
  // Scenes, episode states, models and MEPConfigs all live in WASM memory
  // behind handles. Dropping one without freeing it strands the allocation
  // for the life of the page, and these are not small — a multi_floor scene
  // is ~28k voxels, and an episode state holds a visited set that grows to
  // max_steps entries.

  const modelIdRef = useRef<number | null>(null);
  const mepRef = useRef<any>(null);

  const makeMep = useCallback((wasm: any) => {
    const p = store.getState().mepParams;
    return new wasm.MEPConfig(
      p.cross_section_mm, p.clearance_m, p.voxel_size_m,
      p.reward_target, p.reward_step, p.reward_collision,
      p.reward_turn_horizontal, p.reward_turn_vertical,
      p.reward_vertical_per_voxel, p.reward_revisit,
      p.max_steps, p.min_straight_before_bend,
    );
  }, []);

  /** Stops playback and releases the model and MEPConfig it was using. */
  const endPlayback = useCallback((wasm: any) => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (modelIdRef.current !== null) {
      wasm.free_model(modelIdRef.current);
      modelIdRef.current = null;
    }
    if (mepRef.current !== null) {
      mepRef.current.free();
      mepRef.current = null;
    }
  }, []);

  /** Releases the current scene and its episode state. */
  const disposeScene = useCallback((wasm: any) => {
    const { sceneId, stateId } = store.getState();
    if (stateId !== null) wasm.free_state(stateId);
    if (sceneId !== null) wasm.free_scene(sceneId);
    store.getState().resetEpisode(); // also clears stateId
  }, []);

  /**
   * Starts a fresh episode, releasing the previous one's state, and seeds
   * the path with the start voxel.
   */
  const beginEpisode = useCallback((wasm: any, sceneId: number) => {
    const prev = store.getState().stateId;
    if (prev !== null) wasm.free_state(prev);
    store.getState().resetEpisode();

    const stateId = wasm.reset_episode(sceneId);
    store.getState().setStateId(stateId);

    const pos = wasm.get_state_position(stateId);
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
    return stateId;
  }, []);

  useEffect(() => {
    if (layoutMode !== "custom" || !wasmModule) return;

    if (liveDebounceRef.current) clearTimeout(liveDebounceRef.current);
    liveDebounceRef.current = window.setTimeout(() => {
      // This runs on every debounced edit — once per 250ms while dragging an
      // obstacle — so failing to release the previous scene here leaked one
      // scene and one episode state per tick.
      let mep: any = null;
      try {
        mep = makeMep(wasmModule);
        const geometryJson = JSON.stringify({
          room_min: customLayout.room_min,
          room_max: customLayout.room_max,
          obstacles: customLayout.obstacles,
          start: customLayout.start,
          target: customLayout.target,
        });
        disposeScene(wasmModule);
        const sceneId = wasmModule.create_scene_from_json(geometryJson, mep);
        const info = fromWasm(wasmModule.get_scene_info(sceneId));
        const obstacles = new Float32Array(wasmModule.get_obstacle_positions(sceneId));
        store.getState().setScene(sceneId, info, obstacles);
        beginEpisode(wasmModule, sceneId);
      } catch (e) {
        console.warn("Live preview error:", e);
      } finally {
        if (mep) mep.free();
      }
    }, 250);

    return () => {
      if (liveDebounceRef.current) clearTimeout(liveDebounceRef.current);
    };
  }, [customLayout, layoutMode, wasmModule, makeMep, disposeScene, beginEpisode]);

  // Release everything still held when the app unmounts.
  useEffect(() => {
    return () => {
      if (!wasmModule) return;
      endPlayback(wasmModule);
      disposeScene(wasmModule);
    };
  }, [wasmModule, endPlayback, disposeScene]);

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
    const { layoutMode, room, customLayout } = store.getState();

    const mep = makeMep(wasmModule);
    try {
      // Any in-flight playback holds handles of its own.
      endPlayback(wasmModule);
      store.getState().setPlaying(false);
      disposeScene(wasmModule);

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
      beginEpisode(wasmModule, sceneId);
    } finally {
      mep.free();
    }
  }, [wasmModule, makeMep, endPlayback, disposeScene, beginEpisode]);

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
      const { sceneId } = store.getState();
      if (sceneId === null) return;

      // Whatever the last playback held is dead now.
      endPlayback(wasmModule);

      if (mode === "agent") {
        const weightsJson = trainStore.getState().modelWeights;
        if (!weightsJson) return;
        try {
          modelIdRef.current = wasmModule.load_model(weightsJson);
        } catch (e) {
          // load_model rejects a policy trained against a different
          // observation width rather than letting it emit nonsense actions.
          trainStore
            .getState()
            .setFailed(`Could not load model: ${e}. Retrain the agent.`);
          return;
        }
      }

      // Held for the whole episode — stepFn reads it on every tick — so it is
      // released by endPlayback rather than here.
      const mep = makeMep(wasmModule);
      mepRef.current = mep;

      beginEpisode(wasmModule, sceneId);
      store.getState().setPlaying(true);

      const stepFn = () => {
        const { sceneId: sid, stateId: stid, isPlaying, isDone } = store.getState();
        if (!isPlaying || isDone || sid === null || stid === null) {
          endPlayback(wasmModule);
          return;
        }

        const modelId = modelIdRef.current;
        let action: number;
        if (mode === "agent" && modelId !== null) {
          const obs = wasmModule.get_obs(sid, stid, mep);
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
          endPlayback(wasmModule);
          return;
        }

        timerRef.current = window.setTimeout(stepFn, store.getState().playSpeed);
      };

      timerRef.current = window.setTimeout(stepFn, store.getState().playSpeed);
    },
    [wasmModule, makeMep, endPlayback, beginEpisode]
  );

  const handleStop = useCallback(() => {
    store.getState().setPlaying(false);
    // Clearing the timer means stepFn never runs again, so this is the only
    // place left that can release the model and MEPConfig it was using.
    if (wasmModule) endPlayback(wasmModule);
  }, [wasmModule, endPlayback]);

  const handleReset = useCallback(() => {
    if (!wasmModule) return;
    const { sceneId } = store.getState();
    if (sceneId === null) return;

    endPlayback(wasmModule);
    store.getState().setPlaying(false);
    beginEpisode(wasmModule, sceneId);
  }, [wasmModule, endPlayback, beginEpisode]);

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
