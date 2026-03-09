import React from "react";
import { useSimStore, RewardBreakdown } from "../store/useSimStore";

const COMPONENTS: { key: keyof RewardBreakdown; label: string; color: string }[] = [
  { key: "distance_delta", label: "Distance", color: "#32cd32" },
  { key: "step_penalty", label: "Step", color: "#ff9933" },
  { key: "turn_penalty", label: "Turn", color: "#ff6666" },
  { key: "vertical_penalty", label: "Vertical", color: "#cc66ff" },
  { key: "revisit_penalty", label: "Revisit", color: "#ff3366" },
  { key: "collision_penalty", label: "Collision", color: "#cc0000" },
  { key: "target_bonus", label: "Target", color: "#ffdd00" },
];

const styles = {
  container: {
    padding: "12px",
    background: "#141420",
    borderRadius: "8px",
  },
  title: {
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    color: "#888",
    letterSpacing: "0.05em",
    marginBottom: "8px",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "4px",
    fontSize: "12px",
  },
  dot: (color: string) => ({
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: color,
    flexShrink: 0,
  }),
  label: {
    flex: 1,
    color: "#aaa",
  },
  value: (val: number) => ({
    minWidth: "50px",
    textAlign: "right" as const,
    fontWeight: 600,
    color: val > 0 ? "#32cd32" : val < 0 ? "#ff6666" : "#666",
  }),
  bar: {
    height: "3px",
    background: "#1a1a2e",
    borderRadius: "2px",
    width: "60px",
    overflow: "hidden" as const,
  },
  barFill: (val: number, color: string) => ({
    height: "100%",
    width: `${Math.min(Math.abs(val) * 20, 100)}%`,
    background: color,
    opacity: val === 0 ? 0 : 0.7,
  }),
  total: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 0 0",
    borderTop: "1px solid #333",
    marginTop: "4px",
    fontSize: "13px",
    fontWeight: 700,
  },
  rewardChart: {
    display: "flex",
    gap: "1px",
    height: "40px",
    alignItems: "flex-end",
    marginTop: "8px",
  },
  rewardBar: (val: number, maxAbs: number) => ({
    flex: 1,
    minWidth: "2px",
    maxWidth: "4px",
    height: `${Math.min((Math.abs(val) / maxAbs) * 100, 100)}%`,
    background: val >= 0 ? "#32cd32" : "#ff6666",
    opacity: 0.7,
    borderRadius: "1px 1px 0 0",
  }),
};

export default function RewardPanel() {
  const stepRecords = useSimStore((s) => s.stepRecords);

  if (stepRecords.length === 0) return null;

  const latest = stepRecords[stepRecords.length - 1];
  const b = latest.breakdown;

  // Mini reward timeline
  const recentRewards = stepRecords.slice(-50).map((r) => r.reward);
  const maxAbs = Math.max(...recentRewards.map(Math.abs), 1);

  return (
    <div style={styles.container}>
      <div style={styles.title}>Step {stepRecords.length} Reward Breakdown</div>

      {COMPONENTS.map(({ key, label, color }) => {
        const val = b[key];
        if (val === 0) return null;
        return (
          <div key={key} style={styles.row}>
            <div style={styles.dot(color)} />
            <span style={styles.label}>{label}</span>
            <div style={styles.bar}>
              <div style={styles.barFill(val, color)} />
            </div>
            <span style={styles.value(val)}>{val > 0 ? "+" : ""}{val.toFixed(1)}</span>
          </div>
        );
      })}

      <div style={styles.total}>
        <span style={{ color: "#ccc" }}>Total</span>
        <span style={{ color: b.total >= 0 ? "#32cd32" : "#ff6666" }}>
          {b.total > 0 ? "+" : ""}{b.total.toFixed(1)}
        </span>
      </div>

      {/* Mini reward timeline */}
      <div style={styles.title}>Reward History</div>
      <div style={styles.rewardChart}>
        {recentRewards.map((r, i) => (
          <div key={i} style={styles.rewardBar(r, maxAbs)} />
        ))}
      </div>
    </div>
  );
}
