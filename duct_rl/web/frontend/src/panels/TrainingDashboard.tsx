import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTrainStore } from "../store/useTrainStore";

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
  empty: {
    fontSize: "12px",
    color: "#555",
    textAlign: "center" as const,
    padding: "20px",
  },
};

export default function TrainingDashboard() {
  const metrics = useTrainStore((s) => s.metrics);
  const status = useTrainStore((s) => s.status);
  const progress = useTrainStore((s) => s.progress);
  const error = useTrainStore((s) => s.error);

  if (status === "idle" && metrics.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.title}>Training Dashboard</div>
        <div style={styles.empty}>Train a model to see reward curves here</div>
      </div>
    );
  }

  const data = metrics
    .filter((m) => m.ep_rew_mean !== null && m.ep_rew_mean !== undefined)
    .map((m) => ({
      timestep: m.timestep,
      reward: m.ep_rew_mean,
      length: m.ep_len_mean,
      // Plotted as a percentage on its own axis — reward and success rate
      // don't share a scale.
      success: m.success_rate != null ? m.success_rate * 100 : null,
    }));

  const latest = data.length ? data[data.length - 1] : null;

  return (
    <div style={styles.container}>
      <div style={styles.title}>
        Training Dashboard{" "}
        {status === "running" && (
          <span style={{ color: "#4488ff" }}>(live)</span>
        )}
        {status === "completed" && (
          <span style={{ color: "#32cd32" }}>(done)</span>
        )}
        {status === "failed" && (
          <span style={{ color: "#ff4444" }}>(failed)</span>
        )}
      </div>

      {status === "running" && data.length === 0 && (
        <div style={styles.empty}>
          Collecting episodes... {Math.round(progress * 100)}%
          <br />
          <span style={{ fontSize: "10px", color: "#444" }}>
            Chart appears after first episodes complete
          </span>
        </div>
      )}

      {error && (
        <div style={{ fontSize: "11px", color: "#ff4444", padding: "8px" }}>
          {error}
        </div>
      )}

      {data.length > 0 && (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis
              dataKey="timestep"
              tick={{ fontSize: 10, fill: "#666" }}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
            />
            <YAxis yAxisId="reward" tick={{ fontSize: 10, fill: "#666" }} />
            <YAxis
              yAxisId="success"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "#666" }}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: "#1a1a2e",
                border: "1px solid #333",
                fontSize: "12px",
              }}
            />
            <Line
              yAxisId="reward"
              type="monotone"
              dataKey="reward"
              stroke="#4488ff"
              strokeWidth={2}
              dot={false}
              name="Avg Reward"
            />
            <Line
              yAxisId="success"
              type="monotone"
              dataKey="success"
              stroke="#32cd32"
              strokeWidth={2}
              dot={false}
              connectNulls
              name="Reached Target %"
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {data.length > 0 && (
        <div style={{ display: "flex", gap: "16px", marginTop: "4px", fontSize: "11px", color: "#888" }}>
          <span>Points: {data.length}</span>
          <span>Latest reward: <span style={{ color: "#4488ff" }}>{latest?.reward?.toFixed(1)}</span></span>
          {latest?.success != null && (
            <span>Reached target: <span style={{ color: "#32cd32" }}>{latest.success.toFixed(0)}%</span></span>
          )}
        </div>
      )}
    </div>
  );
}
