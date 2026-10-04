/**
 * Privacy-conscious product analytics utility for LIFEDESK AI.
 * Tracks high-level feature engagement signals WITHOUT capturing
 * any private task content, memory notes, or personal identifiers.
 */

export type ProductEventName =
  | 'app_started'
  | 'task_created'
  | 'task_completed'
  | 'calendar_event_created'
  | 'recurring_item_created'
  | 'ai_interaction_used'
  | 'search_used'
  | 'memory_saved'
  | 'account_created'
  | 'user_returned';

interface EventPayload {
  eventName: ProductEventName;
  timestamp: string;
  metadata?: Record<string, string | number | boolean>;
}

const STORAGE_KEY = 'lifedesk_analytics_events';
const MAX_LOCAL_EVENTS = 50;

export function trackEvent(
  eventName: ProductEventName,
  metadata?: Record<string, string | number | boolean>
): void {
  try {
    const payload: EventPayload = {
      eventName,
      timestamp: new Date().toISOString(),
      metadata,
    };

    // Store lightweight aggregated counters in local storage
    const existingRaw = localStorage.getItem(STORAGE_KEY);
    const existingList: EventPayload[] = existingRaw ? JSON.parse(existingRaw) : [];

    // Keep list bounded to avoid bloating storage
    const updatedList = [payload, ...existingList].slice(0, MAX_LOCAL_EVENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));

    // Update activation & return metrics
    if (eventName === 'app_started') {
      const visitCount = Number(localStorage.getItem('lifedesk_visit_count') || '0') + 1;
      localStorage.setItem('lifedesk_visit_count', String(visitCount));
      if (visitCount > 1) {
        trackEvent('user_returned', { totalVisits: visitCount });
      }
    }
  } catch {
    // Fail silently without disrupting user operations
  }
}
