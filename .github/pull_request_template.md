## What

<!-- What changed, in a sentence or two. -->

## Why

<!-- The problem this solves. Link an issue if there is one. -->

## Env parity

<!--
The 3D environment is implemented twice — duct_rl/python/grid3d.py (used for
training) and duct_rl/web/crate/src/grid3d.rs (used for browser playback).
They must agree, or a trained policy behaves differently on playback than it
did in training.

Tick whichever applies:
-->

- [ ] Does not touch environment dynamics, observations, or rewards
- [ ] Touches them, and both implementations were updated together

## Checks

- [ ] `cargo test` / `cargo clippy` pass (`duct_rl/web/crate`)
- [ ] `python test_env3d.py` passes (`duct_rl/python`)
- [ ] WASM pkg rebuilt and committed, if the Rust core changed
