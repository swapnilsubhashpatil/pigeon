import { refreshAll } from './scorer';

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function startScheduler(): void {
  console.log('[risk-engine/scheduler] Starting — first refresh in 15 minutes');

  setInterval(async () => {
    console.log('[risk-engine/scheduler] Running scheduled risk refresh...');
    try {
      const { refreshed, errors } = await refreshAll();
      console.log(`[risk-engine/scheduler] Refresh complete — ${refreshed} updated, ${errors} errors`);
    } catch (err) {
      console.error('[risk-engine/scheduler] Unexpected error during refresh:', err);
    }
  }, INTERVAL_MS);
}
