/** @format */

import type { Shipment } from './types';

export const API_BASE_URL = 'http://localhost:3000/api/v1';

export const PORT_NAMES: Record<string, string> = {
  CNSHA: 'Shanghai',
  NLRTM: 'Rotterdam',
  DEHAM: 'Hamburg',
  USLAX: 'Los Angeles',
  GBFXT: 'Felixstowe',
  JPYOK: 'Yokohama',
  SGSIN: 'Singapore',
  INNSA: 'Mumbai',
  KRPUS: 'Busan',
  USNYC: 'New York',
  AUMEL: 'Melbourne',
};

export function getPortDisplay(portCode: string): string {
  return PORT_NAMES[portCode] ?? portCode;
}

export function getRouteDisplay(s: Shipment): string {
  const from = getPortDisplay(s.origin.port);
  const to = getPortDisplay(s.destination.port);
  return `${from} → ${to}`;
}

export const RISK_THRESHOLDS = {
  low: 39,
  medium: 69,
} as const;

export const LEG_TYPE_ICONS: Record<string, string> = {
  trucking: 'Truck',
  ocean: 'Ship',
  port: 'Anchor',
  rail: 'Train',
  air: 'Plane',
  'last-mile': 'Package',
};
