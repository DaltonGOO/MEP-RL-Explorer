/**
 * WASM module loader — wraps the Rust mep-routing-core WASM exports.
 * Provides typed functions for scene building, stepping, and inference.
 */

let wasm: typeof import("mep-routing-core") | null = null;

export async function initWasm() {
  if (wasm) return wasm;
  wasm = await import("mep-routing-core");
  return wasm;
}

export function getWasm() {
  if (!wasm) throw new Error("WASM not initialized — call initWasm() first");
  return wasm;
}
