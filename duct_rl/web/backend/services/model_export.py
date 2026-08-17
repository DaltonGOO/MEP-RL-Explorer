"""Extract MLP weights from SB3 PPO model into JSON for WASM inference."""

from __future__ import annotations

import json
from pathlib import Path

import torch


def export_mlp_weights(model_path: str, output_path: str) -> dict:
    """Load an SB3 PPO model and extract its MLP weights as JSON.

    SB3 PPO MlpPolicy architecture (default):
      policy.mlp_extractor.policy_net: Sequential(
        Linear(obs_dim, 64) -> Tanh,
        Linear(64, 64) -> Tanh
      )
      policy.action_net: Linear(64, n_actions)

    Returns dict with format:
      { "layers": [
          { "weights": [[...]], "biases": [...] },  # OBS_DIM -> 64
          { "weights": [[...]], "biases": [...] },  # 64 -> 64
          { "weights": [[...]], "biases": [...] },  # 64 -> 6
      ]}

    The input width is grid3d.OBS_DIM. The WASM loader checks it and rejects
    models trained against a different observation layout.
    """
    from stable_baselines3 import PPO

    model = PPO.load(model_path)
    policy = model.policy

    layers = []

    # Extract policy_net layers (hidden layers with tanh)
    for module in policy.mlp_extractor.policy_net:
        if isinstance(module, torch.nn.Linear):
            w = module.weight.detach().cpu().numpy().tolist()
            b = module.bias.detach().cpu().numpy().tolist()
            layers.append({"weights": w, "biases": b})

    # Extract action_net (final linear layer)
    action_net = policy.action_net
    w = action_net.weight.detach().cpu().numpy().tolist()
    b = action_net.bias.detach().cpu().numpy().tolist()
    layers.append({"weights": w, "biases": b})

    result = {"layers": layers}

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    with open(output, "w") as f:
        json.dump(result, f)

    return result
