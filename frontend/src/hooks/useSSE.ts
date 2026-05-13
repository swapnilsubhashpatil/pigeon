/** @format */

import { useEffect, useRef } from 'react';
import { API_BASE_URL } from '../lib/constants';
import { usePigeonStore } from '../store/usePigeonStore';
import type { SseEvent, FeedItem } from '../lib/types';

export function useSSE() {
  const setShipments = usePigeonStore((s) => s.setShipments);
  const updateShipmentScore = usePigeonStore((s) => s.updateShipmentScore);
  const addDisruption = usePigeonStore((s) => s.addDisruption);
  const addDecision = usePigeonStore((s) => s.addDecision);
  const pushFeedItem = usePigeonStore((s) => s.pushFeedItem);
  const setConnected = usePigeonStore((s) => s.setConnected);

  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`${API_BASE_URL}/events`);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const event: SseEvent = JSON.parse(e.data);

        switch (event.type) {
          case 'snapshot': {
            // We only get summary data from SSE snapshot, fetch full data on init instead
            // But we can set connected state here
            break;
          }
          case 'risk_update': {
            updateShipmentScore(
              event.shipment_id,
              event.composite_risk_score,
              event.weighted_risk_score
            );
            pushFeedItem({
              id: `${event.shipment_id}-risk-${Date.now()}`,
              type: 'risk_update',
              message: `Risk update: ${event.shipment_id} now at ${event.weighted_risk_score}`,
              timestamp: Date.now(),
              payload: event,
            });
            break;
          }
          case 'disruption': {
            addDisruption(event.event);
            pushFeedItem({
              id: event.event.event_id,
              type: 'disruption',
              message: `Disruption: ${event.event.subtype} in ${event.event.affected_region}`,
              timestamp: Date.now(),
              payload: event.event,
            });
            break;
          }
          case 'cascade_report': {
            pushFeedItem({
              id: `cascade-${event.report.trigger_shipment}-${Date.now()}`,
              type: 'cascade',
              message: `Cascade: $${event.report.total_sla_exposure_usd.toLocaleString()} exposure from ${event.report.trigger_shipment}`,
              timestamp: Date.now(),
              payload: event.report,
            });
            break;
          }
          case 'decision_pending': {
            addDecision(event.record);
            pushFeedItem({
              id: event.record.decision_id,
              type: 'decision_pending',
              message: `Decision pending: ${event.record.decision_id} for ${event.record.shipment_id}`,
              timestamp: Date.now(),
              payload: event.record,
            });
            break;
          }
          case 'decision_auto_executed': {
            addDecision(event.record);
            pushFeedItem({
              id: event.record.decision_id,
              type: 'auto_executed',
              message: `Auto-executed: ${event.record.shipment_id} — ${event.record.selected_option_id}`,
              timestamp: Date.now(),
              payload: event.record,
            });
            break;
          }
        }
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [setShipments, updateShipmentScore, addDisruption, addDecision, pushFeedItem, setConnected]);
}
