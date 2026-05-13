import axios from 'axios';
import { z } from 'zod';
import { config } from '@/config';
import { safeFetch, clamp } from './fetcher';
import { MOCK_WEATHER_SCORES, getLaneKey } from './mock-scores';

export const PORT_COORDS: Record<string, { lat: number; lon: number }> = {
  CNSHA: { lat: 31.2304, lon: 121.4737 },
  NLRTM: { lat: 51.9225, lon: 4.4792 },
  DEHAM: { lat: 53.5753, lon: 9.8689 },
  USLAX: { lat: 33.7395, lon: -118.2596 },
  GBFXT: { lat: 51.9600, lon: 1.3500 },
  JPYOK: { lat: 35.4437, lon: 139.6380 },
  SGSIN: { lat: 1.2644, lon: 103.8230 },
  INNSA: { lat: 18.9500, lon: 72.8400 },
  KRPUS: { lat: 35.1028, lon: 129.0403 },
  USNYC: { lat: 40.6643, lon: -74.0060 },
  AUMEL: { lat: -37.8136, lon: 144.9631 },
};

const TomorrowResponseSchema = z.object({
  timelines: z.object({
    hourly: z.array(
      z.object({
        values: z.object({
          windSpeed: z.number(),
          rainIntensity: z.number(),
          snowIntensity: z.number().optional(),
          weatherCode: z.number().optional(),
        }),
      })
    ).min(1),
  }),
});

function midpoint(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): { lat: number; lon: number } {
  return { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
}

function severityToScore(windSpeed: number, precipIntensity: number): number {
  // precipIntensity = rainIntensity + snowIntensity combined
  let score = 0;
  if (windSpeed > 80) score += 65;
  else if (windSpeed > 50) score += 40;
  else if (windSpeed > 30) score += 20;

  if (precipIntensity > 10) score += 30;
  else if (precipIntensity > 5) score += 20;
  else if (precipIntensity > 2) score += 10;

  return clamp(score);
}

async function fetchFromTomorrow(lat: number, lon: number): Promise<number> {
  if (!config.tomorrowIoApiKey) throw new Error('TOMORROW_IO_API_KEY not set');

  const url = 'https://api.tomorrow.io/v4/weather/forecast';
  const response = await axios.get(url, {
    params: {
      location: `${lat},${lon}`,
      apikey: config.tomorrowIoApiKey,
      fields: ['windSpeed', 'precipitationIntensity', 'weatherCode'],
      timesteps: ['1h'],
      units: 'metric',
    },
    timeout: 8000,
  });

  const parsed = TomorrowResponseSchema.parse(response.data);
  const first = parsed.timelines.hourly[0];
  if (!first) throw new Error('No hourly data in Tomorrow.io response');

  const precipIntensity = first.values.rainIntensity + (first.values.snowIntensity ?? 0);
  return severityToScore(first.values.windSpeed, precipIntensity);
}

export async function fetchWeatherScore(
  originPort: string,
  destPort: string
): Promise<number> {
  const laneKey = getLaneKey(originPort, destPort);
  const originCoords = PORT_COORDS[originPort];
  const destCoords = PORT_COORDS[destPort];

  return (
    await safeFetch(
      'weather',
      async () => {
        if (!originCoords || !destCoords) throw new Error(`Unknown port: ${originPort} or ${destPort}`);
        const mid = midpoint(originCoords, destCoords);
        return fetchFromTomorrow(mid.lat, mid.lon);
      },
      () => MOCK_WEATHER_SCORES[laneKey] ?? MOCK_WEATHER_SCORES['default'] ?? 30
    )
  ).score;
}
