import type { Response } from 'express';
import { seedShipments, seedDependencyEdges, seedCustomers, type Customer } from '@/data';
import type {
  Shipment,
  Leg,
  DisruptionEvent,
  DecisionRecord,
  DependencyGraph,
} from '@/types';

interface SseClient {
  res: Response;
}

class Store {
  private shipments: Map<string, Shipment>;
  private disruptions: Map<string, DisruptionEvent>;
  private decisions: Map<string, DecisionRecord>;
  private auditLog: DecisionRecord[];
  private graph: DependencyGraph;
  private sseClients: Set<SseClient>;
  readonly customers: Map<string, Customer>;

  constructor() {
    this.shipments = new Map(seedShipments.map((s) => [s.shipment_id, { ...s }]));
    this.disruptions = new Map();
    this.decisions = new Map();
    this.auditLog = [];
    this.sseClients = new Set();
    this.customers = new Map(seedCustomers.map((c) => [c.customer_id, c]));

    this.graph = new Map();
    for (const edge of seedDependencyEdges) {
      const existing = this.graph.get(edge.from_shipment) ?? [];
      existing.push(edge.to_shipment);
      this.graph.set(edge.from_shipment, existing);
    }

    console.log(
      `[store] Loaded ${this.shipments.size} shipments, ${seedDependencyEdges.length} dependency edges, ${this.customers.size} customers`
    );
  }

  // --- Shipment operations ---

  getAll(): Shipment[] {
    return Array.from(this.shipments.values());
  }

  getById(id: string): Shipment | undefined {
    return this.shipments.get(id);
  }

  updateRiskScore(id: string, legScores: Pick<Leg, 'leg_id' | 'risk_score'>[]): Shipment | undefined {
    const shipment = this.shipments.get(id);
    if (!shipment) return undefined;

    const updatedLegs = shipment.legs.map((leg) => {
      const update = legScores.find((l) => l.leg_id === leg.leg_id);
      return update ? { ...leg, risk_score: update.risk_score } : leg;
    });

    const composite = Math.round(
      updatedLegs.reduce((sum, l) => sum + l.risk_score, 0) / updatedLegs.length
    );
    const hoursRemaining = (new Date(shipment.SLA_deadline).getTime() - Date.now()) / (1000 * 60 * 60);
    const urgencyMultiplier =
      hoursRemaining > 72 ? 1.0 :
      hoursRemaining > 48 ? 1.4 :
      hoursRemaining > 24 ? 1.8 : 2.5;
    const weighted = Math.min(100, Math.round(composite * urgencyMultiplier));

    const updated: Shipment = {
      ...shipment,
      legs: updatedLegs,
      composite_risk_score: composite,
      sla_urgency_multiplier: urgencyMultiplier,
      weighted_risk_score: weighted,
    };

    this.shipments.set(id, updated);
    this.broadcast({ type: 'risk_update', shipment_id: id, composite_risk_score: composite, weighted_risk_score: weighted });
    return updated;
  }

  updateStatus(id: string, status: Shipment['status']): Shipment | undefined {
    const shipment = this.shipments.get(id);
    if (!shipment) return undefined;
    const updated = { ...shipment, status };
    this.shipments.set(id, updated);
    return updated;
  }

  // --- Disruption operations ---

  getActiveDisruptions(): DisruptionEvent[] {
    return Array.from(this.disruptions.values()).filter((d) => !d.resolved);
  }

  addDisruption(event: DisruptionEvent): void {
    this.disruptions.set(event.event_id, event);
    this.broadcast({ type: 'disruption', event });
  }

  resolveDisruption(eventId: string): boolean {
    const event = this.disruptions.get(eventId);
    if (!event) return false;
    this.disruptions.set(eventId, { ...event, resolved: true, resolved_at: new Date().toISOString() });
    return true;
  }

  // --- Decision operations ---

  getPendingDecisions(): DecisionRecord[] {
    return Array.from(this.decisions.values()).filter((d) => d.status === 'pending_approval');
  }

  addDecision(record: DecisionRecord): void {
    this.decisions.set(record.decision_id, record);
    if (record.status === 'auto_executed') {
      this.auditLog.push(record);
      this.broadcast({ type: 'decision_auto_executed', record });
    } else if (record.status === 'pending_approval') {
      this.broadcast({ type: 'decision_pending', record });
    }
  }

  approveDecision(id: string, optionId: string): DecisionRecord | undefined {
    const record = this.decisions.get(id);
    if (!record || record.status !== 'pending_approval') return undefined;
    const updated: DecisionRecord = {
      ...record,
      status: 'approved',
      selected_option_id: optionId,
      resolved_at: new Date().toISOString(),
      resolved_by: 'manager',
    };
    this.decisions.set(id, updated);
    this.auditLog.push(updated);
    return updated;
  }

  rejectDecision(id: string): DecisionRecord | undefined {
    const record = this.decisions.get(id);
    if (!record || record.status !== 'pending_approval') return undefined;
    const updated: DecisionRecord = {
      ...record,
      status: 'overridden',
      resolved_at: new Date().toISOString(),
      resolved_by: 'manager',
    };
    this.decisions.set(id, updated);
    this.auditLog.push(updated);
    return updated;
  }

  getAuditLog(): DecisionRecord[] {
    return [...this.auditLog];
  }

  // --- Graph operations ---

  getDependents(shipmentId: string): string[] {
    return this.graph.get(shipmentId) ?? [];
  }

  getGraph(): DependencyGraph {
    return this.graph;
  }

  // --- SSE operations ---

  subscribe(res: Response): void {
    this.sseClients.add({ res });
  }

  unsubscribe(res: Response): void {
    for (const client of this.sseClients) {
      if (client.res === res) {
        this.sseClients.delete(client);
        break;
      }
    }
  }

  broadcast(event: unknown): void {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.sseClients) {
      client.res.write(data);
    }
  }
}

export const store = new Store();
