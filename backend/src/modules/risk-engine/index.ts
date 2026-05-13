import { startAisStream } from './signals/vessel';
import { startScheduler } from './scheduler';

export function initRiskEngine(): void {
  console.log('[risk-engine] Initialising...');
  startAisStream();
  startScheduler();
  console.log('[risk-engine] Initialised');
}

export { refreshShipment, refreshAll, computeShipmentRisk } from './scorer';
