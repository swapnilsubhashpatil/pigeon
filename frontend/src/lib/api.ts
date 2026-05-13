/** @format */

import { API_BASE_URL } from './constants';
import type {
  ApiResponse,
  Shipment,
  DecisionRecord,
  CascadeImpactReport,
  DecisionStatus,
} from './types';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json: ApiResponse<T> = await res.json();
  if (!json.success) {
    throw new Error(typeof json.error === 'string' ? json.error : 'Request failed');
  }
  if (json.data === undefined) {
    throw new Error('No data returned');
  }
  return json.data;
}

export const api = {
  health: () => apiFetch<{ status: string; shipmentCount: number; activeDisruptions: number }>('/health'),

  shipments: (params?: { status?: string; minRisk?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.minRisk !== undefined) qs.set('minRisk', String(params.minRisk));
    return apiFetch<Shipment[]>(`/shipments?${qs.toString()}`);
  },

  shipment: (id: string) => apiFetch<Shipment>(`/shipments/${id}`),

  riskScores: () => apiFetch<Shipment[]>('/risk-scores'),

  refreshRisk: (id?: string) =>
    apiFetch<Shipment>(id ? `/risk-scores/refresh/${id}` : '/risk-scores/refresh', { method: 'POST' }),

  cascadeGraph: () => apiFetch<Record<string, string[]>>('/cascade/graph'),

  simulateCascade: (shipmentId: string, delayHours: number) =>
    apiFetch<CascadeImpactReport>('/cascade/simulate', {
      method: 'POST',
      body: JSON.stringify({ shipmentId, delayHours }),
    }),

  generateDecision: (shipmentId: string) =>
    apiFetch<DecisionRecord>('/decisions/generate', {
      method: 'POST',
      body: JSON.stringify({ shipmentId }),
    }),

  pendingDecisions: () => apiFetch<DecisionRecord[]>('/decisions'),

  auditLog: () => apiFetch<DecisionRecord[]>('/decisions/audit'),

  approveDecision: (id: string, optionId: string) =>
    apiFetch<DecisionRecord>(`/decisions/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ optionId }),
    }),

  rejectDecision: (id: string) =>
    apiFetch<DecisionRecord>(`/decisions/${id}/reject`, {
      method: 'POST',
    }),
};
