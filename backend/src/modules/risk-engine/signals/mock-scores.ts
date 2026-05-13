// Pre-seeded realistic mock scores used as fallback when API keys are missing.
// Keyed by lane (origin→destination) and leg type.

export const MOCK_WEATHER_SCORES: Record<string, number> = {
  'CNSHA-NLRTM': 72,
  'CNSHA-DEHAM': 68,
  'USLAX-GBFXT': 28,
  'JPYOK-USLAX': 22,
  'SGSIN-NLRTM': 35,
  'INNSA-NLRTM': 42,
  'KRPUS-USNYC': 18,
  'AUMEL-DEHAM': 15,
  default: 30,
};

export const MOCK_VESSEL_DELTA_SCORES: Record<string, number> = {
  'CNSHA-NLRTM': 65,
  'CNSHA-DEHAM': 60,
  'USLAX-GBFXT': 20,
  'JPYOK-USLAX': 18,
  'SGSIN-NLRTM': 32,
  'INNSA-NLRTM': 38,
  'KRPUS-USNYC': 15,
  'AUMEL-DEHAM': 12,
  default: 25,
};

export const MOCK_PORT_CONGESTION_SCORES: Record<string, number> = {
  CNSHA: 80,
  NLRTM: 35,
  DEHAM: 42,
  USLAX: 48,
  GBFXT: 22,
  JPYOK: 28,
  SGSIN: 45,
  INNSA: 58,
  KRPUS: 30,
  USNYC: 55,
  AUMEL: 20,
  default: 35,
};

export const MOCK_TRAFFIC_SCORES: Record<string, number> = {
  'Shanghai Factory-CNSHA': 18,
  'CNSHA-Rotterdam DC': 12,
  'LA Factory-USLAX': 40,
  'USLAX-London DC': 25,
  default: 20,
};

export const MOCK_GEOPOLITICAL_SCORES: Record<string, number> = {
  CNSHA: 35,
  NLRTM: 10,
  DEHAM: 10,
  USLAX: 15,
  GBFXT: 10,
  JPYOK: 8,
  SGSIN: 12,
  INNSA: 25,
  KRPUS: 10,
  USNYC: 18,
  AUMEL: 8,
  default: 15,
};

export function getLaneKey(originPort: string, destPort: string): string {
  return `${originPort}-${destPort}`;
}
