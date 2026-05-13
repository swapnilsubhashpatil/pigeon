import { Router } from 'express';
import { store } from '@/store';
import type { ApiResponse } from '@/types';

const router = Router();

interface HealthData {
  status: 'ok';
  shipmentCount: number;
  activeDisruptions: number;
}

router.get('/', (_req, res) => {
  const data: HealthData = {
    status: 'ok',
    shipmentCount: store.getAll().length,
    activeDisruptions: store.getActiveDisruptions().length,
  };
  const response: ApiResponse<HealthData> = { success: true, data };
  res.json(response);
});

export default router;
