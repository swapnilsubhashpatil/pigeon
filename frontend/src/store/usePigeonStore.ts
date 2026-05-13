/** @format */

import { create } from 'zustand';
import type {
  Shipment,
  DecisionRecord,
  DisruptionEvent,
  FeedItem,
  DecisionStatus,
} from './types';

interface PigeonStore {
  // Shipments
  shipments: Map<string, Shipment>;
  setShipments: (shipments: Shipment[]) => void;
  updateShipmentScore: (
    id: string,
    composite: number,
    weighted: number
  ) => void;
  updateShipmentStatus: (id: string, status: Shipment['status']) => void;

  // Disruptions
  disruptions: DisruptionEvent[];
  addDisruption: (d: DisruptionEvent) => void;

  // Decisions
  decisions: Map<string, DecisionRecord>;
  pendingDecisions: DecisionRecord[];
  auditLog: DecisionRecord[];
  addDecision: (d: DecisionRecord) => void;
  resolveDecision: (id: string, status: DecisionStatus) => void;
  refreshPendingDecisions: () => void;
  setAuditLog: (log: DecisionRecord[]) => void;

  // Live feed
  eventFeed: FeedItem[];
  pushFeedItem: (item: FeedItem) => void;

  // Connection
  connected: boolean;
  setConnected: (v: boolean) => void;
}

export const usePigeonStore = create<PigeonStore>((set, get) => ({
  shipments: new Map(),
  setShipments: (shipments) =>
    set({
      shipments: new Map(shipments.map((s) => [s.shipment_id, s])),
    }),
  updateShipmentScore: (id, composite, weighted) =>
    set((state) => {
      const s = state.shipments.get(id);
      if (!s) return state;
      const updated = { ...s, composite_risk_score: composite, weighted_risk_score: weighted };
      const next = new Map(state.shipments);
      next.set(id, updated);
      return { shipments: next };
    }),
  updateShipmentStatus: (id, status) =>
    set((state) => {
      const s = state.shipments.get(id);
      if (!s) return state;
      const updated = { ...s, status };
      const next = new Map(state.shipments);
      next.set(id, updated);
      return { shipments: next };
    }),

  disruptions: [],
  addDisruption: (d) =>
    set((state) => ({ disruptions: [d, ...state.disruptions].slice(0, 50) })),

  decisions: new Map(),
  pendingDecisions: [],
  auditLog: [],
  addDecision: (d) =>
    set((state) => {
      const next = new Map(state.decisions);
      next.set(d.decision_id, d);
      const pending = Array.from(next.values()).filter((x) => x.status === 'pending_approval');
      const audit =
        d.status !== 'pending_approval'
          ? [d, ...state.auditLog].slice(0, 100)
          : state.auditLog;
      return { decisions: next, pendingDecisions: pending, auditLog: audit };
    }),
  resolveDecision: (id, status) =>
    set((state) => {
      const d = state.decisions.get(id);
      if (!d) return state;
      const updated: DecisionRecord = {
        ...d,
        status,
        resolved_at: new Date().toISOString(),
        resolved_by: 'manager',
      };
      const next = new Map(state.decisions);
      next.set(id, updated);
      const pending = Array.from(next.values()).filter((x) => x.status === 'pending_approval');
      const audit = [updated, ...state.auditLog].slice(0, 100);
      return { decisions: next, pendingDecisions: pending, auditLog: audit };
    }),
  refreshPendingDecisions: () =>
    set((state) => {
      const pending = Array.from(state.decisions.values()).filter(
        (x) => x.status === 'pending_approval'
      );
      return { pendingDecisions: pending };
    }),
  setAuditLog: (log) => set({ auditLog: log }),

  eventFeed: [],
  pushFeedItem: (item) =>
    set((state) => ({ eventFeed: [item, ...state.eventFeed].slice(0, 40) })),

  connected: false,
  setConnected: (v) => set({ connected: v }),
}));
