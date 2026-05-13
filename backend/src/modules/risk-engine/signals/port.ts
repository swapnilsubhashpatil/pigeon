import { config } from '@/config';
import { safeFetch, clamp } from './fetcher';
import { MOCK_PORT_CONGESTION_SCORES } from './mock-scores';
import { PORT_COORDS } from './weather';
import { countVesselsNear, getVesselCacheSize } from './vessel';

const PORT_RADIUS_KM = 80;

function vesselCountToScore(count: number): number {
  if (count < 5)  return 10;
  if (count < 15) return 30;
  if (count < 30) return 55;
  if (count < 50) return 75;
  return 90;
}

export async function fetchPortCongestionScore(portCode: string): Promise<number> {
  return (
    await safeFetch(
      'port',
      () => {
        if (!config.aisStreamApiKey) throw new Error('AIS_STREAM_API_KEY not set');
        if (getVesselCacheSize() === 0) throw new Error('Vessel cache empty — AIS stream not ready');

        const coords = PORT_COORDS[portCode];
        if (!coords) throw new Error(`No coordinates for port: ${portCode}`);

        const count = countVesselsNear(coords.lat, coords.lon, PORT_RADIUS_KM);
        return Promise.resolve(clamp(vesselCountToScore(count)));
      },
      () => MOCK_PORT_CONGESTION_SCORES[portCode] ?? MOCK_PORT_CONGESTION_SCORES['default'] ?? 35
    )
  ).score;
}
