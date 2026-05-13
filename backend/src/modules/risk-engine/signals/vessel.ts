import WebSocket from 'ws';
import { z } from 'zod';
import { config } from '@/config';
import { safeFetch, clamp } from './fetcher';
import { MOCK_VESSEL_DELTA_SCORES, getLaneKey } from './mock-scores';
import { PORT_COORDS } from './weather';

interface VesselPosition {
  mmsi: string;
  lat: number;
  lon: number;
  speed: number;
  updatedAt: number;
}

// Bounding boxes for the 8 shipping lanes in seed data
const LANE_BOUNDING_BOXES = [
  { start: [30.0, 118.0], end: [32.0, 124.0] },  // CNSHA area
  { start: [51.0, 3.0],   end: [54.0, 10.0] },    // NLRTM / DEHAM area
  { start: [32.0, -120.0], end: [35.0, -116.0] },  // USLAX area
  { start: [35.0, 138.0], end: [36.0, 140.0] },    // JPYOK area
  { start: [1.0, 103.0],  end: [2.0, 105.0] },     // SGSIN area
  { start: [18.0, 72.0],  end: [20.0, 74.0] },     // INNSA area
  { start: [34.0, 128.0], end: [36.0, 130.0] },    // KRPUS area
  { start: [-38.0, 144.0], end: [-36.0, 146.0] },  // AUMEL area
];

const AisMessageSchema = z.object({
  MessageType: z.string(),
  Message: z.object({
    PositionReport: z.object({
      UserID: z.number(),
      Latitude: z.number(),
      Longitude: z.number(),
      Sog: z.number(),
    }).optional(),
  }).optional(),
});

const vesselCache = new Map<string, VesselPosition>();
let wsInstance: WebSocket | null = null;
let retryCount = 0;
const MAX_RETRIES = 5;

export function startAisStream(): void {
  if (!config.aisStreamApiKey) {
    console.warn('[risk-engine/vessel] AIS_STREAM_API_KEY not set — vessel signal will use mock scores');
    return;
  }

  function connect() {
    const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
    wsInstance = ws;

    ws.on('open', () => {
      retryCount = 0;
      console.log('[risk-engine/vessel] AIS WebSocket connected');
      ws.send(
        JSON.stringify({
          APIKey: config.aisStreamApiKey,
          BoundingBoxes: LANE_BOUNDING_BOXES.map((b) => [b.start, b.end]),
          FilterMessageTypes: ['PositionReport'],
        })
      );
    });

    ws.on('message', (data) => {
      try {
        const raw = JSON.parse(data.toString());
        const parsed = AisMessageSchema.safeParse(raw);
        if (!parsed.success || !parsed.data.Message?.PositionReport) return;

        const report = parsed.data.Message.PositionReport;
        const mmsi = String(report.UserID);
        vesselCache.set(mmsi, {
          mmsi,
          lat: report.Latitude,
          lon: report.Longitude,
          speed: report.Sog,
          updatedAt: Date.now(),
        });
      } catch {
        // silently skip malformed messages
      }
    });

    ws.on('error', (err) => {
      console.warn(`[risk-engine/vessel] WebSocket error: ${err.message}`);
    });

    ws.on('close', () => {
      wsInstance = null;
      if (retryCount < MAX_RETRIES) {
        const delay = Math.min(1000 * 2 ** retryCount, 30000);
        retryCount++;
        console.log(`[risk-engine/vessel] Reconnecting in ${delay}ms (attempt ${retryCount})`);
        setTimeout(connect, delay);
      } else {
        console.warn('[risk-engine/vessel] Max reconnect attempts reached — vessel signal degraded to mock');
      }
    });
  }

  connect();
}

function computeExpectedProgress(
  originPort: string,
  destPort: string,
  slaDeadline: string
): { lat: number; lon: number } | null {
  const origin = PORT_COORDS[originPort];
  const dest = PORT_COORDS[destPort];
  if (!origin || !dest) return null;

  const now = Date.now();
  const deadline = new Date(slaDeadline).getTime();
  const totalJourneyMs = 20 * 24 * 60 * 60 * 1000; // assume 20-day ocean voyage
  const startMs = deadline - totalJourneyMs;
  const elapsed = now - startMs;
  const progress = Math.max(0, Math.min(1, elapsed / totalJourneyMs));

  return {
    lat: origin.lat + (dest.lat - origin.lat) * progress,
    lon: origin.lon + (dest.lon - origin.lon) * progress,
  };
}

function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function deltaToScore(deltaKm: number): number {
  if (deltaKm < 50) return 5;
  if (deltaKm < 200) return 20;
  if (deltaKm < 500) return 45;
  if (deltaKm < 1000) return 70;
  return 90;
}

export async function fetchVesselDeltaScore(
  originPort: string,
  destPort: string,
  slaDeadline: string
): Promise<number> {
  const laneKey = getLaneKey(originPort, destPort);

  return (
    await safeFetch(
      'vessel',
      async () => {
        if (!config.aisStreamApiKey) throw new Error('AIS_STREAM_API_KEY not set');
        if (vesselCache.size === 0) throw new Error('Vessel cache is empty — AIS stream not ready');

        const expected = computeExpectedProgress(originPort, destPort, slaDeadline);
        if (!expected) throw new Error(`Unknown ports: ${originPort} / ${destPort}`);

        // Find any vessel in the cache in this region (simplified: closest to expected position)
        let minDelta = Infinity;
        for (const vessel of vesselCache.values()) {
          const delta = haversineKm(vessel, expected);
          if (delta < minDelta) minDelta = delta;
        }

        if (minDelta === Infinity) throw new Error('No vessel found in cache for lane');
        return clamp(deltaToScore(minDelta));
      },
      () => MOCK_VESSEL_DELTA_SCORES[laneKey] ?? MOCK_VESSEL_DELTA_SCORES['default'] ?? 25
    )
  ).score;
}

export function getVesselCacheSize(): number {
  return vesselCache.size;
}

export function countVesselsNear(lat: number, lon: number, radiusKm: number): number {
  let count = 0;
  for (const vessel of vesselCache.values()) {
    if (haversineKm(vessel, { lat, lon }) <= radiusKm) count++;
  }
  return count;
}
