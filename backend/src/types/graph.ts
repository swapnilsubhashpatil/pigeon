export interface DependencyEdge {
  from_shipment: string;
  to_shipment: string;
  dependency_type: 'consolidation' | 'sequence' | 'shared_po';
  location?: string;
  notes?: string;
}

export type DependencyGraph = Map<string, string[]>;
