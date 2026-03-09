import React, { useState } from "react";
import { useSimStore, CustomLayout, ObstacleBox } from "../store/useSimStore";

const styles = {
  container: {
    padding: "12px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
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
  row: {
    display: "flex",
    gap: "6px",
    marginBottom: "6px",
    alignItems: "center",
  },
  label: {
    fontSize: "11px",
    color: "#888",
    width: "16px",
    flexShrink: 0,
  },
  input: {
    flex: 1,
    padding: "5px 6px",
    background: "#1a1a2e",
    color: "#e0e0e0",
    border: "1px solid #333",
    borderRadius: "4px",
    fontSize: "12px",
    width: "60px",
  },
  obstacleCard: {
    background: "#1a1a2e",
    borderRadius: "4px",
    padding: "8px",
    marginBottom: "6px",
    border: "1px solid #333",
  },
  obstacleHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "6px",
  },
  removeBtn: {
    background: "none",
    border: "none",
    color: "#cc3333",
    cursor: "pointer",
    fontSize: "12px",
    padding: "2px 6px",
  },
  btn: (variant: "primary" | "secondary" | "danger" | "small") => ({
    width: variant === "small" ? "auto" : "100%",
    padding: variant === "small" ? "5px 10px" : "8px",
    borderRadius: "4px",
    border: "none",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    ...(variant === "primary"
      ? { background: "#4488ff", color: "#fff" }
      : variant === "danger"
      ? { background: "#cc3333", color: "#fff" }
      : { background: "#1a1a2e", color: "#aaa", border: "1px solid #333" }),
  }),
  nameInput: {
    width: "100%",
    padding: "6px 8px",
    background: "#1a1a2e",
    color: "#e0e0e0",
    border: "1px solid #333",
    borderRadius: "4px",
    fontSize: "12px",
    marginBottom: "6px",
  },
  savedItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 8px",
    background: "#1a1a2e",
    borderRadius: "4px",
    marginBottom: "4px",
    fontSize: "12px",
    color: "#ccc",
    cursor: "pointer",
    border: "1px solid #333",
  },
};

function Vec3Input({
  value,
  onChange,
  labels = ["X", "Y", "Z"],
}: {
  value: [number, number, number];
  onChange: (v: [number, number, number]) => void;
  labels?: [string, string, string];
}) {
  return (
    <div style={styles.row}>
      {labels.map((l, i) => (
        <React.Fragment key={l}>
          <span style={styles.label}>{l}</span>
          <input
            type="number"
            step="0.5"
            style={styles.input}
            value={value[i]}
            onChange={(e) => {
              const v = [...value] as [number, number, number];
              const n = parseFloat(e.target.value); if (isNaN(n)) return; v[i] = n;
              onChange(v);
            }}
          />
        </React.Fragment>
      ))}
    </div>
  );
}

function ObstacleEditor({
  box,
  index,
  onChange,
  onRemove,
}: {
  box: ObstacleBox;
  index: number;
  onChange: (b: ObstacleBox) => void;
  onRemove: () => void;
}) {
  const update = (field: keyof ObstacleBox, val: number) =>
    onChange({ ...box, [field]: val });

  return (
    <div style={styles.obstacleCard}>
      <div style={styles.obstacleHeader}>
        <span style={{ fontSize: "11px", color: "#888" }}>Obstacle {index + 1}</span>
        <button style={styles.removeBtn} onClick={onRemove}>remove</button>
      </div>
      <div style={{ fontSize: "10px", color: "#666", marginBottom: "4px" }}>Min (x, y, z)</div>
      <div style={styles.row}>
        {(["x_min", "y_min", "z_min"] as const).map((f) => (
          <input
            key={f}
            type="number"
            step="0.5"
            style={styles.input}
            value={box[f]}
            onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) update(f, v); }}
          />
        ))}
      </div>
      <div style={{ fontSize: "10px", color: "#666", marginBottom: "4px" }}>Max (x, y, z)</div>
      <div style={styles.row}>
        {(["x_max", "y_max", "z_max"] as const).map((f) => (
          <input
            key={f}
            type="number"
            step="0.5"
            style={styles.input}
            value={box[f]}
            onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) update(f, v); }}
          />
        ))}
      </div>
    </div>
  );
}

export default function LayoutBuilder() {
  const layout = useSimStore((s) => s.customLayout);
  const savedLayouts = useSimStore((s) => s.savedLayouts);
  const setCustomLayout = useSimStore((s) => s.setCustomLayout);
  const saveLayout = useSimStore((s) => s.saveLayout);
  const deleteLayout = useSimStore((s) => s.deleteLayout);
  const loadSavedLayout = useSimStore((s) => s.loadSavedLayout);

  const [saveName, setSaveName] = useState(layout.name);

  const update = (partial: Partial<CustomLayout>) =>
    setCustomLayout({ ...layout, ...partial });

  const addObstacle = () => {
    const cx = (layout.room_max[0] - layout.room_min[0]) / 2 + layout.room_min[0];
    const cy = (layout.room_max[1] - layout.room_min[1]) / 2 + layout.room_min[1];
    update({
      obstacles: [
        ...layout.obstacles,
        {
          x_min: cx - 1, y_min: cy - 1, z_min: layout.room_min[2],
          x_max: cx + 1, y_max: cy + 1, z_max: layout.room_max[2],
        },
      ],
    });
  };

  const updateObstacle = (i: number, box: ObstacleBox) => {
    const obs = [...layout.obstacles];
    obs[i] = box;
    update({ obstacles: obs });
  };

  const removeObstacle = (i: number) => {
    update({ obstacles: layout.obstacles.filter((_, j) => j !== i) });
  };

  return (
    <div style={styles.container}>
      {/* Room Dimensions */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Room Bounds (meters)</div>
        <div style={{ fontSize: "10px", color: "#666", marginBottom: "4px" }}>Min corner</div>
        <Vec3Input value={layout.room_min} onChange={(v) => update({ room_min: v })} />
        <div style={{ fontSize: "10px", color: "#666", marginBottom: "4px" }}>Max corner</div>
        <Vec3Input value={layout.room_max} onChange={(v) => update({ room_max: v })} />
      </div>

      {/* Start / Target */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Start Position</div>
        <Vec3Input value={layout.start} onChange={(v) => update({ start: v })} />
        <div style={{ ...styles.sectionTitle, marginTop: "8px" }}>Target Position</div>
        <Vec3Input value={layout.target} onChange={(v) => update({ target: v })} />
      </div>

      {/* Obstacles */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          Obstacles ({layout.obstacles.length})
        </div>
        {layout.obstacles.map((obs, i) => (
          <ObstacleEditor
            key={i}
            box={obs}
            index={i}
            onChange={(b) => updateObstacle(i, b)}
            onRemove={() => removeObstacle(i)}
          />
        ))}
        <button style={styles.btn("secondary")} onClick={addObstacle}>
          + Add Obstacle
        </button>
      </div>

      {/* Save / Load */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Save / Load</div>
        <input
          style={styles.nameInput}
          placeholder="Layout name..."
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
        />
        <button
          style={styles.btn("primary")}
          onClick={() => {
            if (saveName.trim()) {
              saveLayout({ ...layout, name: saveName.trim() });
            }
          }}
        >
          Save Layout
        </button>

        {savedLayouts.length > 0 && (
          <div style={{ marginTop: "8px" }}>
            <div style={{ fontSize: "10px", color: "#666", marginBottom: "4px" }}>
              Saved Layouts
            </div>
            {savedLayouts.map((sl) => (
              <div key={sl.name} style={styles.savedItem}>
                <span
                  onClick={() => {
                    loadSavedLayout(sl.name);
                    setSaveName(sl.name);
                  }}
                  style={{ flex: 1, cursor: "pointer" }}
                >
                  {sl.name}
                </span>
                <button
                  style={styles.removeBtn}
                  onClick={() => deleteLayout(sl.name)}
                >
                  delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
