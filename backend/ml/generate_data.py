"""
Synthetic training data generator for the delay-probability predictor.

Generates ~5,000 labeled samples. Each row is a snapshot of risk signals + SLA
state. The label `sla_breached` is computed from a deterministic ground-truth
function with noise, so the model learns the underlying relationship rather
than memorising specific inputs.
"""

import random
import numpy as np
import pandas as pd

SEED = 42
random.seed(SEED)
np.random.seed(SEED)

# Carriers and lanes mirror the backend seed data
CARRIERS = ['Maersk', 'MSC', 'CMA CGM', 'Hapag-Lloyd', 'ONE', 'Evergreen', 'COSCO', 'HMM']
LANES = [
    'CNSHA-NLRTM', 'CNSHA-DEHAM', 'USLAX-GBFXT', 'JPYOK-USLAX',
    'SGSIN-NLRTM', 'INNSA-NLRTM', 'KRPUS-USNYC', 'AUMEL-DEHAM',
]

CARRIER_ENC = {c: i for i, c in enumerate(CARRIERS)}
LANE_ENC = {l: i for i, l in enumerate(LANES)}

# Per-carrier historical reliability (0–1)
CARRIER_RELIABILITY = {
    'Maersk': 0.92, 'MSC': 0.88, 'CMA CGM': 0.85, 'Hapag-Lloyd': 0.91,
    'ONE': 0.86, 'Evergreen': 0.84, 'COSCO': 0.83, 'HMM': 0.80,
}

# Per-lane base risk (some lanes are riskier than others)
LANE_BASE_RISK = {
    'CNSHA-NLRTM': 0.18, 'CNSHA-DEHAM': 0.20, 'USLAX-GBFXT': 0.15,
    'JPYOK-USLAX': 0.12, 'SGSIN-NLRTM': 0.16, 'INNSA-NLRTM': 0.22,
    'KRPUS-USNYC': 0.14, 'AUMEL-DEHAM': 0.17,
}


def sla_urgency_multiplier(hours: float) -> float:
    if hours > 72:
        return 1.0
    if hours > 48:
        return 1.4
    if hours > 24:
        return 1.8
    return 2.5


def generate_row():
    carrier = random.choice(CARRIERS)
    lane = random.choice(LANES)

    # Beta distributions give us realistic signal scores
    # (mostly low with occasional spikes)
    weather = float(np.clip(np.random.beta(2, 3) * 100, 0, 100))
    vessel = float(np.clip(np.random.beta(2, 4) * 100, 0, 100))
    port_cong = float(np.clip(np.random.beta(2, 3) * 100, 0, 100))
    traffic = float(np.clip(np.random.beta(2, 4) * 100, 0, 100))
    geopolitical = float(np.clip(np.random.beta(1.5, 4) * 100, 0, 100))

    composite = (weather + vessel + port_cong + traffic + geopolitical) / 5.0

    # SLA window: 6h to 7 days (matches realistic shipment urgency distribution)
    sla_hours = float(np.random.uniform(6, 168))
    urgency_mult = sla_urgency_multiplier(sla_hours)

    # GROUND TRUTH PROBABILITY OF BREACH
    # Combines signal severity, SLA urgency, carrier reliability, and lane base risk
    signal_risk = (
        0.30 * weather / 100
        + 0.25 * port_cong / 100
        + 0.20 * vessel / 100
        + 0.15 * geopolitical / 100
        + 0.10 * traffic / 100
    )
    urgency_factor = 1.0 - min(sla_hours / 168, 1.0)
    carrier_factor = 1.0 - CARRIER_RELIABILITY[carrier]
    lane_factor = LANE_BASE_RISK[lane]

    p_breach = (
        0.45 * signal_risk
        + 0.30 * urgency_factor
        + 0.15 * carrier_factor
        + 0.10 * lane_factor
    )

    # Urgency multiplier amplifies risk for time-critical shipments
    p_breach *= 0.5 + 0.4 * urgency_mult

    # Small noise so the model has to generalise (not memorise the formula)
    p_breach += float(np.random.normal(0, 0.06))
    p_breach = float(np.clip(p_breach, 0, 1))

    # Deterministic threshold — features now carry meaningful signal
    sla_breached = 1 if p_breach > 0.45 else 0

    return {
        'weather_score': round(weather, 2),
        'vessel_delta_score': round(vessel, 2),
        'port_congestion_score': round(port_cong, 2),
        'traffic_score': round(traffic, 2),
        'geopolitical_score': round(geopolitical, 2),
        'composite_risk_score': round(composite, 2),
        'sla_hours_remaining': round(sla_hours, 2),
        'sla_urgency_multiplier': urgency_mult,
        'carrier_encoded': CARRIER_ENC[carrier],
        'lane_encoded': LANE_ENC[lane],
        'sla_breached': sla_breached,
    }


def main():
    n = 5000
    rows = [generate_row() for _ in range(n)]
    df = pd.DataFrame(rows)
    df.to_csv('training_data.csv', index=False)
    print(f"Generated {len(df)} rows -> training_data.csv")
    print(f"Breach rate: {df['sla_breached'].mean():.2%}")
    print("Class balance:")
    print(df['sla_breached'].value_counts())


if __name__ == '__main__':
    main()
