import fs from 'fs';
import path from 'path';

interface XGBTree {
  split_indices: number[];
  split_conditions: number[];
  left_children: number[];
  right_children: number[];
  base_weights: number[];
}

interface XGBModel {
  objective: string;
  feature_names: string[];
  base_margin: number;
  n_trees: number;
  trees: XGBTree[];
  test_cases: Array<{ features: Record<string, number>; expected_probability: number }>;
}

export interface PredictorFeatures {
  weather_score: number;
  vessel_delta_score: number;
  port_congestion_score: number;
  traffic_score: number;
  geopolitical_score: number;
  composite_risk_score: number;
  sla_hours_remaining: number;
  sla_urgency_multiplier: number;
  carrier_encoded: number;
  lane_encoded: number;
}

export interface DelayPrediction {
  breach_probability: number;
  breach_likely: boolean;
}

const CARRIER_ENC: Record<string, number> = {
  'Maersk': 0, 'MSC': 1, 'CMA CGM': 2, 'Hapag-Lloyd': 3,
  'ONE': 4, 'Evergreen': 5, 'COSCO': 6, 'HMM': 7,
};

const LANE_ENC: Record<string, number> = {
  'CNSHA-NLRTM': 0, 'CNSHA-DEHAM': 1, 'USLAX-GBFXT': 2, 'JPYOK-USLAX': 3,
  'SGSIN-NLRTM': 4, 'INNSA-NLRTM': 5, 'KRPUS-USNYC': 6, 'AUMEL-DEHAM': 7,
};

class DelayPredictor {
  private model: XGBModel | null = null;

  load(modelPath?: string): void {
    const resolved = modelPath ?? path.join(process.cwd(), 'ml', 'model.json');
    if (!fs.existsSync(resolved)) {
      console.warn(`[predictor] Model file not found at ${resolved} — predictions will use fallback`);
      return;
    }

    const raw = fs.readFileSync(resolved, 'utf8');
    this.model = JSON.parse(raw) as XGBModel;

    console.log(`[predictor] Loaded XGBoost model — ${this.model.n_trees} trees, base_margin=${this.model.base_margin.toFixed(4)}`);
    this.selfTest();
  }

  isReady(): boolean {
    return this.model !== null;
  }

  predict(features: PredictorFeatures): DelayPrediction {
    if (!this.model) {
      // Fallback when model not loaded — derive a rough probability from composite risk
      const fallback = Math.min(0.99, Math.max(0.01, features.composite_risk_score / 100));
      return { breach_probability: fallback, breach_likely: fallback > 0.5 };
    }

    const featureArray = this.featuresToArray(features);
    let margin = this.model.base_margin;
    for (const tree of this.model.trees) {
      margin += this.walkTree(tree, featureArray);
    }

    const probability = 1 / (1 + Math.exp(-margin));
    return {
      breach_probability: Math.round(probability * 1000) / 1000,
      breach_likely: probability > 0.5,
    };
  }

  private featuresToArray(f: PredictorFeatures): number[] {
    // Order MUST match feature_names in training script
    return [
      f.weather_score,
      f.vessel_delta_score,
      f.port_congestion_score,
      f.traffic_score,
      f.geopolitical_score,
      f.composite_risk_score,
      f.sla_hours_remaining,
      f.sla_urgency_multiplier,
      f.carrier_encoded,
      f.lane_encoded,
    ];
  }

  private walkTree(tree: XGBTree, features: number[]): number {
    let node = 0;
    while (tree.left_children[node] !== -1) {
      const splitIdx = tree.split_indices[node]!;
      const splitCond = tree.split_conditions[node]!;
      const featureVal = features[splitIdx] ?? 0;
      node = featureVal < splitCond
        ? tree.left_children[node]!
        : tree.right_children[node]!;
    }
    return tree.base_weights[node]!;
  }

  private selfTest(): void {
    if (!this.model) return;

    let passed = 0;
    let maxDelta = 0;

    for (const tc of this.model.test_cases) {
      const features: PredictorFeatures = {
        weather_score: tc.features['weather_score']!,
        vessel_delta_score: tc.features['vessel_delta_score']!,
        port_congestion_score: tc.features['port_congestion_score']!,
        traffic_score: tc.features['traffic_score']!,
        geopolitical_score: tc.features['geopolitical_score']!,
        composite_risk_score: tc.features['composite_risk_score']!,
        sla_hours_remaining: tc.features['sla_hours_remaining']!,
        sla_urgency_multiplier: tc.features['sla_urgency_multiplier']!,
        carrier_encoded: tc.features['carrier_encoded']!,
        lane_encoded: tc.features['lane_encoded']!,
      };

      const pred = this.predict(features);
      const delta = Math.abs(pred.breach_probability - tc.expected_probability);
      maxDelta = Math.max(maxDelta, delta);
      if (delta < 0.01) passed++;
    }

    const total = this.model.test_cases.length;
    console.log(`[predictor] Self-test: ${passed}/${total} cases within 1% (max delta: ${maxDelta.toFixed(4)})`);
  }
}

export function encodeCarrier(carrier: string): number {
  return CARRIER_ENC[carrier] ?? 0;
}

export function encodeLane(originPort: string, destPort: string): number {
  return LANE_ENC[`${originPort}-${destPort}`] ?? 0;
}

export const delayPredictor = new DelayPredictor();
