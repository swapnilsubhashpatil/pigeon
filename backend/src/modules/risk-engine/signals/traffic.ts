import axios from 'axios';
import { z } from 'zod';
import { config } from '@/config';
import { safeFetch, clamp } from './fetcher';
import { MOCK_TRAFFIC_SCORES } from './mock-scores';

// Maps port codes to real addresses so Google Maps can geocode them
const PORT_ADDRESSES: Record<string, string> = {
  CNSHA: 'Port of Shanghai, Pudong, Shanghai, China',
  NLRTM: 'Port of Rotterdam, Rotterdam, Netherlands',
  DEHAM: 'Port of Hamburg, Hamburg, Germany',
  USLAX: 'Port of Los Angeles, San Pedro, CA, USA',
  GBFXT: 'Port of Felixstowe, Felixstowe, UK',
  JPYOK: 'Port of Yokohama, Yokohama, Japan',
  SGSIN: 'Port of Singapore, Tanjong Pagar, Singapore',
  INNSA: 'Jawaharlal Nehru Port, Navi Mumbai, India',
  KRPUS: 'Port of Busan, Busan, South Korea',
  USNYC: 'Port of New York, Bayonne, NJ, USA',
  AUMEL: 'Port of Melbourne, Melbourne, Victoria, Australia',
};

function resolveAddress(raw: string): string {
  return PORT_ADDRESSES[raw] ?? raw;
}

// Baseline trucking durations in minutes per route (origin description → dest description)
const TRUCKING_BASELINES: Record<string, number> = {
  'Shanghai Factory-CNSHA': 90,
  'Ningbo Factory-CNSHA': 120,
  'Suzhou Factory-CNSHA': 110,
  'Hangzhou Factory-CNSHA': 130,
  'Qingdao Factory-CNSHA': 480,
  'Shenzhen Factory-CNSHA': 120,
  'Tianjin Factory-CNSHA': 600,
  'Guangzhou Factory-CNSHA': 150,
  'Wuhan Factory-CNSHA': 720,
  'Chongqing Factory-CNSHA': 900,
  "Xi'an Factory-CNSHA": 840,
  'Dongguan Factory-CNSHA': 140,
  'Foshan Factory-CNSHA': 150,
  'Nanjing Factory-CNSHA': 180,
  'LA Factory-USLAX': 45,
  'San Diego Factory-USLAX': 120,
  'Phoenix Factory-USLAX': 360,
  'Las Vegas Factory-USLAX': 270,
  'Seattle Factory-USLAX': 1200,
  'Tokyo Factory-JPYOK': 60,
  'Osaka Factory-JPYOK': 90,
  'Nagoya Factory-JPYOK': 75,
  'Kobe Factory-JPYOK': 80,
  'Hiroshima Factory-JPYOK': 180,
  'Melbourne Factory-AUMEL': 30,
  'Sydney Factory-AUMEL': 540,
  'Brisbane Factory-AUMEL': 1440,
  'Perth Factory-AUMEL': 2880,
  default: 120,
};

const RoutesResponseSchema = z.object({
  routes: z.array(
    z.object({
      duration: z.string(), // e.g. "5400s"
    })
  ).min(1),
});

function durationStringToMinutes(dur: string): number {
  const seconds = parseInt(dur.replace('s', ''), 10);
  return Math.round(seconds / 60);
}

function delayRatioToScore(ratio: number): number {
  if (ratio < 0.1) return 10;
  if (ratio < 0.3) return 30;
  if (ratio < 0.6) return 55;
  return 80;
}

async function fetchFromGoogleMaps(origin: string, destination: string): Promise<number> {
  if (!config.googleMapsApiKey) throw new Error('GOOGLE_MAPS_API_KEY not set');

  const baselineKey = `${origin}-${destination}`;
  const baselineMin = TRUCKING_BASELINES[baselineKey] ?? TRUCKING_BASELINES['default'] ?? 120;

  const response = await axios.post(
    'https://routes.googleapis.com/directions/v2:computeRoutes',
    {
      origin: { address: resolveAddress(origin) },
      destination: { address: resolveAddress(destination) },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
    },
    {
      headers: {
        'X-Goog-Api-Key': config.googleMapsApiKey,
        'X-Goog-FieldMask': 'routes.duration',
      },
      timeout: 8000,
    }
  );

  const parsed = RoutesResponseSchema.parse(response.data);
  const first = parsed.routes[0];
  if (!first) throw new Error('No routes returned');

  const actualMin = durationStringToMinutes(first.duration);
  const ratio = (actualMin - baselineMin) / baselineMin;
  return clamp(delayRatioToScore(ratio));
}

export async function fetchTrafficScore(
  legOrigin: string,
  legDestination: string
): Promise<number> {
  const mockKey = `${legOrigin}-${legDestination}`;
  return (
    await safeFetch(
      'traffic',
      () => fetchFromGoogleMaps(legOrigin, legDestination),
      () => MOCK_TRAFFIC_SCORES[mockKey] ?? MOCK_TRAFFIC_SCORES['default'] ?? 20
    )
  ).score;
}
