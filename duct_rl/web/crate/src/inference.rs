use serde::{Deserialize, Serialize};

/// A minimal MLP for running SB3-trained policies in the browser.
/// Architecture: input -> Dense(64, tanh) -> Dense(64, tanh) -> Dense(n_actions)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MLPWeights {
    pub layers: Vec<LayerWeights>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayerWeights {
    pub weights: Vec<Vec<f32>>, // shape: [out_features][in_features]
    pub biases: Vec<f32>,       // shape: [out_features]
}

pub struct SimpleMLP {
    layers: Vec<(Vec<Vec<f32>>, Vec<f32>)>,
}

impl SimpleMLP {
    pub fn from_weights(weights: &MLPWeights) -> Self {
        let layers = weights
            .layers
            .iter()
            .map(|l| (l.weights.clone(), l.biases.clone()))
            .collect();
        Self { layers }
    }

    pub fn predict(&self, input: &[f32]) -> usize {
        let mut x = input.to_vec();
        let n_layers = self.layers.len();

        for (i, (weights, biases)) in self.layers.iter().enumerate() {
            let mut out = vec![0.0f32; biases.len()];
            for (j, (w_row, &b)) in weights.iter().zip(biases.iter()).enumerate() {
                let mut sum = b;
                for (k, &w) in w_row.iter().enumerate() {
                    sum += w * x[k];
                }
                // Apply tanh for all layers except the last (action logits)
                out[j] = if i < n_layers - 1 { sum.tanh() } else { sum };
            }
            x = out;
        }

        // Argmax
        x.iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap())
            .map(|(i, _)| i)
            .unwrap_or(0)
    }
}
