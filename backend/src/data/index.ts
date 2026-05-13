import { z } from 'zod';
import shipmentsRaw from './shipments.json';
import dependencyGraphRaw from './dependency-graph.json';
import customersRaw from './customers.json';
import type { Shipment, DependencyEdge } from '@/types';

const LegSchema = z.object({
  leg_id: z.string(),
  type: z.enum(['trucking', 'ocean', 'port', 'rail', 'air', 'last-mile']),
  risk_score: z.number().min(0).max(100),
  origin: z.string().optional(),
  destination: z.string().optional(),
});

const ShipmentSchema = z.object({
  shipment_id: z.string(),
  status: z.enum(['pending', 'in_transit', 'at_port', 'delayed', 'delivered']),
  origin: z.object({ port: z.string(), country: z.string() }),
  destination: z.object({ port: z.string(), country: z.string() }),
  carrier: z.string(),
  SLA_deadline: z.string().datetime(),
  customer_id: z.string(),
  purchase_orders: z.array(z.string()),
  legs: z.array(LegSchema),
  composite_risk_score: z.number().min(0).max(100),
  sla_urgency_multiplier: z.number(),
  weighted_risk_score: z.number(),
});

const DependencyEdgeSchema = z.object({
  from_shipment: z.string(),
  to_shipment: z.string(),
  dependency_type: z.enum(['consolidation', 'sequence', 'shared_po']),
  location: z.string().optional(),
  notes: z.string().optional(),
});

const CustomerSchema = z.object({
  customer_id: z.string(),
  name: z.string(),
  tier: z.enum(['gold', 'silver', 'bronze']),
  sla_penalty_per_day_usd: z.number(),
});

export interface Customer {
  customer_id: string;
  name: string;
  tier: 'gold' | 'silver' | 'bronze';
  sla_penalty_per_day_usd: number;
}

function loadShipments(): Shipment[] {
  const result = z.array(ShipmentSchema).safeParse(shipmentsRaw);
  if (!result.success) {
    throw new Error(`Shipment seed data validation failed: ${result.error.message}`);
  }
  return result.data as Shipment[];
}

function loadDependencyEdges(): DependencyEdge[] {
  const result = z.array(DependencyEdgeSchema).safeParse(dependencyGraphRaw);
  if (!result.success) {
    throw new Error(`Dependency graph seed data validation failed: ${result.error.message}`);
  }
  return result.data as DependencyEdge[];
}

function loadCustomers(): Customer[] {
  const result = z.array(CustomerSchema).safeParse(customersRaw);
  if (!result.success) {
    throw new Error(`Customer seed data validation failed: ${result.error.message}`);
  }
  return result.data;
}

export const seedShipments = loadShipments();
export const seedDependencyEdges = loadDependencyEdges();
export const seedCustomers = loadCustomers();
