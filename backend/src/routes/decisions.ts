import { Router } from 'express';
import { z } from 'zod';
import { store } from '@/store';
import { generateDecision } from '@/modules/decision-engine';
import type { ApiResponse, DecisionRecord } from '@/types';

const router = Router();

router.post('/generate', async (req, res) => {
  const parsed = z.object({ shipmentId: z.string() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { shipmentId } = parsed.data;
  if (!store.getById(shipmentId)) {
    res.status(404).json({ success: false, error: 'Shipment not found' });
    return;
  }

  try {
    const record = await generateDecision(shipmentId);
    const response: ApiResponse<DecisionRecord> = { success: true, data: record };
    res.json(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Decision generation failed';
    res.status(500).json({ success: false, error: msg });
  }
});

router.get('/', (_req, res) => {
  const pending = store.getPendingDecisions();
  const response: ApiResponse<DecisionRecord[]> = { success: true, data: pending };
  res.json(response);
});

router.get('/audit', (_req, res) => {
  const log = store.getAuditLog();
  const response: ApiResponse<DecisionRecord[]> = { success: true, data: log };
  res.json(response);
});

router.post('/:id/approve', (req, res) => {
  const parsed = z.object({ optionId: z.string() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }

  const updated = store.approveDecision(req.params['id']!, parsed.data.optionId);
  if (!updated) {
    res.status(404).json({ success: false, error: 'Decision not found or not pending' });
    return;
  }

  const response: ApiResponse<DecisionRecord> = { success: true, data: updated };
  res.json(response);
});

router.post('/:id/reject', (req, res) => {
  const updated = store.rejectDecision(req.params['id']!);
  if (!updated) {
    res.status(404).json({ success: false, error: 'Decision not found or not pending' });
    return;
  }

  const response: ApiResponse<DecisionRecord> = { success: true, data: updated };
  res.json(response);
});

export default router;
