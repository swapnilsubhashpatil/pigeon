import { Router } from 'express';
import { store } from '@/store';
import { refreshShipment, refreshAll, computeShipmentRisk } from '@/modules/risk-engine';
import type { ApiResponse, Shipment } from '@/types';

const router = Router();

router.get('/', (_req, res) => {
  const shipments = store.getAll();
  const response: ApiResponse<Shipment[]> = { success: true, data: shipments };
  res.json(response);
});

router.get('/:id', async (req, res) => {
  const shipment = store.getById(req.params['id'] ?? '');
  if (!shipment) {
    res.status(404).json({ success: false, error: 'Shipment not found' });
    return;
  }

  try {
    const breakdown = await computeShipmentRisk(shipment);
    res.json({ success: true, data: { shipment, breakdown } });
  } catch (err) {
    console.error('[risk-scores/get]', err);
    res.status(500).json({ success: false, error: 'Failed to compute risk breakdown' });
  }
});

router.post('/refresh', async (_req, res) => {
  try {
    const result = await refreshAll();
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[risk-scores/refresh-all]', err);
    res.status(500).json({ success: false, error: 'Refresh failed' });
  }
});

router.post('/refresh/:id', async (req, res) => {
  const id = req.params['id'] ?? '';
  try {
    const updated = await refreshShipment(id);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Shipment not found' });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[risk-scores/refresh]', err);
    res.status(500).json({ success: false, error: 'Refresh failed' });
  }
});

export default router;
