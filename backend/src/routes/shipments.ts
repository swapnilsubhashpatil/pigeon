import { Router } from 'express';
import { store } from '@/store';
import type { ApiResponse, Shipment } from '@/types';

const router = Router();

router.get('/', (req, res) => {
  let shipments = store.getAll();

  const { status, minRisk } = req.query;

  if (typeof status === 'string') {
    shipments = shipments.filter((s) => s.status === status);
  }

  if (typeof minRisk === 'string') {
    const threshold = Number(minRisk);
    if (!isNaN(threshold)) {
      shipments = shipments.filter((s) => s.weighted_risk_score >= threshold);
    }
  }

  const response: ApiResponse<Shipment[]> = { success: true, data: shipments };
  res.json(response);
});

router.get('/:id', (req, res) => {
  const shipment = store.getById(req.params['id'] ?? '');
  if (!shipment) {
    const response: ApiResponse<never> = { success: false, error: 'Shipment not found' };
    res.status(404).json(response);
    return;
  }
  const response: ApiResponse<Shipment> = { success: true, data: shipment };
  res.json(response);
});

export default router;
