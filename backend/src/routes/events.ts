import { Router, type Request, type Response } from 'express';
import { store } from '@/store';

const router = Router();

const KEEPALIVE_INTERVAL_MS = 30_000;

router.get('/', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send current snapshot on connect so the client has an initial state
  const snapshot = {
    type: 'snapshot',
    shipments: store.getAll().map((s) => ({
      shipment_id: s.shipment_id,
      composite_risk_score: s.composite_risk_score,
      weighted_risk_score: s.weighted_risk_score,
      status: s.status,
    })),
    active_disruptions: store.getActiveDisruptions().length,
    pending_decisions: store.getPendingDecisions().length,
  };
  res.write(`data: ${JSON.stringify(snapshot)}\n\n`);

  store.subscribe(res);

  const keepalive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, KEEPALIVE_INTERVAL_MS);

  req.on('close', () => {
    clearInterval(keepalive);
    store.unsubscribe(res);
  });
});

export default router;
