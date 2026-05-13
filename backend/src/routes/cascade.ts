import { Router } from 'express';
import { z } from 'zod';
import { store } from '@/store';
import { simulateCascade, getCascadeGraph } from '@/modules/cascade-simulator';
import type { ApiResponse, CascadeImpactReport } from '@/types';

const router = Router();

const SimulateBodySchema = z.object({
  shipmentId: z.string(),
  delayHours: z.number().min(1).max(720),
});

router.post('/simulate', (req, res) => {
  const parsed = SimulateBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { shipmentId, delayHours } = parsed.data;

  if (!store.getById(shipmentId)) {
    res.status(404).json({ success: false, error: 'Shipment not found' });
    return;
  }

  const report = simulateCascade(shipmentId, delayHours);
  const response: ApiResponse<CascadeImpactReport> = { success: true, data: report };
  res.json(response);
});

router.get('/graph', (_req, res) => {
  const graph = getCascadeGraph();
  res.json({ success: true, data: graph });
});

export default router;
