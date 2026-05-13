/** @format */

import { useEffect, useState, useRef } from 'react';
import { api } from '../../lib/api';
import type { CascadeImpactReport } from '../../lib/types';

interface Node {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isRoot: boolean;
}

export function NetworkGraph({ shipmentId }: { shipmentId: string }) {
  const [graph, setGraph] = useState<Record<string, string[]>>({});
  const [report, setReport] = useState<CascadeImpactReport | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    Promise.all([api.cascadeGraph(), api.simulateCascade(shipmentId, 18)])
      .then(([g, r]) => {
        setGraph(g);
        setReport(r);
        const dependents = g[shipmentId] || [];
        const initialNodes: Node[] = [
          { id: shipmentId, x: 200, y: 150, vx: 0, vy: 0, isRoot: true },
          ...dependents.map((id, i) => ({ id, x: 350 + i * 120, y: 150 + (i % 2 === 0 ? -40 : 40), vx: 0, vy: 0, isRoot: false })),
        ];
        setNodes(initialNodes);
      });
  }, [shipmentId]);

  useEffect(() => {
    if (nodes.length === 0) return;
    const animate = () => {
      setNodes((prev) => {
        const next = prev.map((n) => ({ ...n }));
        // Simple force simulation
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const dx = next[j].x - next[i].x;
            const dy = next[j].y - next[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = (150 - dist) * 0.001;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            next[i].vx -= fx; next[i].vy -= fy;
            next[j].vx += fx; next[j].vy += fy;
          }
        }
        // Center root
        const root = next.find((n) => n.isRoot);
        if (root) {
          root.vx += (200 - root.x) * 0.02;
          root.vy += (150 - root.y) * 0.02;
        }
        // Update positions
        for (const n of next) {
          n.vx *= 0.9; n.vy *= 0.9;
          n.x += n.vx; n.y += n.vy;
        }
        return next;
      });
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [nodes.length]);

  const dependents = graph[shipmentId] || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dependency Network</span>
      </div>
      {nodes.length === 0 ? <div className="h-40 flex items-center justify-center text-xs text-gray-600">Loading graph...</div> : (
        <div className="relative h-[300px] w-full rounded-xl border border-white/5 bg-bg-primary overflow-hidden">
          <svg ref={svgRef} className="w-full h-full" viewBox="0 0 500 300">
            {/* Edges */}
            {dependents.map((depId) => {
              const source = nodes.find((n) => n.id === shipmentId);
              const target = nodes.find((n) => n.id === depId);
              if (!source || !target) return null;
              return (
                <g key={depId}>
                  <line x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke="rgba(99,102,241,0.2)" strokeWidth="1.5" />
                  <circle cx={target.x} cy={target.y} r="3" fill="rgba(99,102,241,0.3)">
                    <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.3;0.6;0.3" dur="2s" repeatCount="indefinite" />
                  </circle>
                </g>
              );
            })}
            {/* Nodes */}
            {nodes.map((node) => {
              const nodeReport = report?.cascade_nodes.find((n) => n.shipment_id === node.id);
              const isBreached = nodeReport?.sla_breached;
              return (
                <g key={node.id}>
                  <circle cx={node.x} cy={node.y} r={node.isRoot ? 28 : 22} fill={node.isRoot ? 'rgba(99,102,241,0.15)' : isBreached ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'} stroke={node.isRoot ? 'rgba(99,102,241,0.5)' : isBreached ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.3)'} strokeWidth="1.5" />
                  <text x={node.x} y={node.y + 1} textAnchor="middle" dominantBaseline="middle" className="text-[9px] font-mono font-bold" fill={node.isRoot ? '#818CF8' : isBreached ? '#EF4444' : '#10B981'}>{node.id}</text>
                  {node.isRoot && <circle cx={node.x} cy={node.y} r="32" fill="none" stroke="rgba(99,102,241,0.15)" strokeWidth="1"><animate attributeName="r" values="32;38;32" dur="3s" repeatCount="indefinite" /></circle>}
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
