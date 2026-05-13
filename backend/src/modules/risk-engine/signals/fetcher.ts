import type { SignalResult } from './types';

export async function safeFetch(
  source: string,
  fetchFn: () => Promise<number>,
  mockFn: () => number
): Promise<SignalResult> {
  try {
    const score = await fetchFn();
    return { score: clamp(score), source: 'live' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[risk-engine/${source}] Falling back to mock — ${msg}`);
    return { score: clamp(mockFn()), source: 'mock', detail: msg };
  }
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
