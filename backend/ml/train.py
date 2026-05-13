"""
Trains an XGBoost binary classifier on the synthetic training data.

Outputs:
  - model.json  — clean tree format consumable by the TypeScript predictor
  - test_cases  — embedded in model.json so the TS implementation can verify
                  itself against Python on startup
"""

import json
import math
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score

FEATURES = [
    'weather_score', 'vessel_delta_score', 'port_congestion_score',
    'traffic_score', 'geopolitical_score', 'composite_risk_score',
    'sla_hours_remaining', 'sla_urgency_multiplier',
    'carrier_encoded', 'lane_encoded',
]


def load_data():
    df = pd.read_csv('training_data.csv')
    X = df[FEATURES]
    y = df['sla_breached']
    return train_test_split(X, y, test_size=0.2, random_state=42)


def train():
    X_train, X_test, y_train, y_test = load_data()

    # Class balance — synthetic data has ~38% breach; weight positives accordingly
    pos_weight = (y_train == 0).sum() / max(1, (y_train == 1).sum())

    model = xgb.XGBClassifier(
        n_estimators=150,
        max_depth=5,
        learning_rate=0.08,
        objective='binary:logistic',
        eval_metric='logloss',
        scale_pos_weight=pos_weight,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=42,
    )

    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    print('\nClassification report:')
    print(classification_report(y_test, y_pred))
    print(f'ROC AUC: {roc_auc_score(y_test, y_proba):.3f}')

    return model, X_test, y_test


def export_model(model: xgb.XGBClassifier, X_test: pd.DataFrame) -> dict:
    """
    Convert XGBoost's internal tree dump to a flat array representation
    that the TypeScript predictor can consume without library deps.
    """
    booster = model.get_booster()
    raw_dump = booster.get_dump(dump_format='json')

    # Determine base margin (in logit space)
    # XGBoost stores base_score in probability space — convert to logit
    base_score = float(model.get_params().get('base_score') or 0.5)
    if 0.0 < base_score < 1.0:
        base_margin = math.log(base_score / (1.0 - base_score))
    else:
        base_margin = 0.0

    clean_trees = []
    for tree_json in raw_dump:
        tree = json.loads(tree_json)
        nodes = {}

        def walk(node):
            nid = node['nodeid']
            if 'leaf' in node:
                nodes[nid] = {'leaf': node['leaf']}
            else:
                # XGBoost uses fN naming like "f0", "f1" — extract index
                split_name = node['split']
                if split_name.startswith('f'):
                    split_idx = int(split_name[1:])
                else:
                    split_idx = FEATURES.index(split_name)
                nodes[nid] = {
                    'split_idx': split_idx,
                    'split_condition': node['split_condition'],
                    'yes': node['yes'],
                    'no': node['no'],
                }
                for child in node.get('children', []):
                    walk(child)

        walk(tree)

        max_node = max(nodes.keys())
        split_indices = [-1] * (max_node + 1)
        split_conditions = [0.0] * (max_node + 1)
        left_children = [-1] * (max_node + 1)
        right_children = [-1] * (max_node + 1)
        base_weights = [0.0] * (max_node + 1)

        for nid, n in nodes.items():
            if 'leaf' in n:
                base_weights[nid] = float(n['leaf'])
            else:
                split_indices[nid] = int(n['split_idx'])
                split_conditions[nid] = float(n['split_condition'])
                left_children[nid] = int(n['yes'])
                right_children[nid] = int(n['no'])

        clean_trees.append({
            'split_indices': split_indices,
            'split_conditions': split_conditions,
            'left_children': left_children,
            'right_children': right_children,
            'base_weights': base_weights,
        })

    # Generate test cases for TS verification
    samples = X_test[:5].reset_index(drop=True)
    probas = model.predict_proba(samples)[:, 1]
    test_cases = []
    for i in range(len(samples)):
        test_cases.append({
            'features': {col: float(samples.iloc[i][col]) for col in FEATURES},
            'expected_probability': float(probas[i]),
        })

    return {
        'objective': 'binary:logistic',
        'feature_names': FEATURES,
        'base_margin': base_margin,
        'n_trees': len(clean_trees),
        'trees': clean_trees,
        'test_cases': test_cases,
    }


def main():
    model, X_test, y_test = train()
    exported = export_model(model, X_test)

    with open('model.json', 'w') as f:
        json.dump(exported, f, indent=2)

    print(f"\nSaved model.json — {exported['n_trees']} trees, base_margin={exported['base_margin']:.4f}")
    print(f"Embedded {len(exported['test_cases'])} test cases for TS verification")


if __name__ == '__main__':
    main()
