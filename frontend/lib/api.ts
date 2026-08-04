import type { TrustFactType } from "./catalog";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const COPILOT_TIMEOUT_MS = 2500;

export interface CopilotRequestBody {
  session_id: string;
  persona: "householder" | "experimenter";
  cart: { sku_id: string; qty: number }[];
  history_category_ids: string[];
  dismissed_sku_ids: string[];
  local_hour: number;
}

export interface Suggestion {
  sku_id: string;
  why: string;
  trust_facts: { type: TrustFactType; label: string }[];
  price_anchor: string | null;
  protected_trial: boolean;
  is_new_category: boolean;
}

export interface CopilotResponseBody {
  mission: string;
  confidence: number;
  suggestions: Suggestion[];
  latency_ms: number;
  model: string;
}

export type EventType =
  | "suggestion_shown"
  | "suggestion_tapped"
  | "suggestion_added"
  | "suggestion_removed"
  | "module_dismissed"
  | "not_relevant"
  | "checkout_started"
  | "order_placed"
  | "copilot_latency";

export interface EventPayload {
  session_id: string;
  ts: string;
  type: EventType;
  payload?: Record<string, unknown>;
}

let inFlightController: AbortController | null = null;

/** Calls /copilot with a hard client timeout and cancels any stale
 * in-flight request from a previous cart state (docs/edgecases.md #15).
 * Returns null on any non-2xx, timeout, or network error — the caller
 * simply renders nothing (docs/edgecases.md #1, #9). */
export async function fetchCopilotSuggestions(
  body: CopilotRequestBody
): Promise<CopilotResponseBody | null> {
  inFlightController?.abort();
  const controller = new AbortController();
  inFlightController = controller;

  const timeoutId = setTimeout(() => controller.abort(), COPILOT_TIMEOUT_MS);
  const start = performance.now();

  try {
    const res = await fetch(`${API_URL}/copilot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.status === 204) {
      postEvents([latencyEvent(body.session_id, performance.now() - start, false)]);
      return null;
    }
    if (!res.ok) {
      postEvents([latencyEvent(body.session_id, performance.now() - start, true)]);
      return null;
    }
    const data = (await res.json()) as CopilotResponseBody;
    postEvents([latencyEvent(body.session_id, data.latency_ms, false)]);
    return data;
  } catch {
    clearTimeout(timeoutId);
    postEvents([latencyEvent(body.session_id, performance.now() - start, true)]);
    return null;
  } finally {
    if (inFlightController === controller) inFlightController = null;
  }
}

function latencyEvent(sessionId: string, latencyMs: number, failed: boolean): EventPayload {
  return {
    session_id: sessionId,
    ts: new Date().toISOString(),
    type: "copilot_latency",
    payload: { latency_ms: Math.round(latencyMs), failed },
  };
}

const QUEUE_KEY = "im-event-queue";
const QUEUE_CAP = 200;

function readQueue(): EventPayload[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as EventPayload[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(events: EventPayload[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(events.slice(-QUEUE_CAP)));
  } catch {
    // ignore quota errors — best-effort instrumentation only
  }
}

/** Queues events client-side and attempts an immediate flush; failures are
 * retried on the next call (docs/edgecases.md #34). Never blocks the UI. */
export function postEvents(newEvents: EventPayload[]) {
  const queue = [...readQueue(), ...newEvents].slice(-QUEUE_CAP);
  writeQueue(queue);
  void flushEventQueue();
}

let flushing = false;
export async function flushEventQueue() {
  if (flushing) return;
  const queue = readQueue();
  if (queue.length === 0) return;
  flushing = true;
  try {
    const res = await fetch(`${API_URL}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(queue),
    });
    if (res.ok) writeQueue([]);
  } catch {
    // stays queued, retried on next postEvents/flush call
  } finally {
    flushing = false;
  }
}

/** Fire-and-forget health ping on app load to pre-warm a sleeping Render
 * free-tier instance before the user reaches cart. */
export function pingHealth() {
  fetch(`${API_URL}/health`).catch(() => {});
}

export async function fetchMetrics(sessionId: string) {
  try {
    const res = await fetch(`${API_URL}/metrics/${sessionId}`);
    if (!res.ok) return null;
    return (await res.json()) as {
      session_id: string;
      counts: Record<string, number>;
      latency_p95_ms: number | null;
      new_category_added: number;
    };
  } catch {
    return null;
  }
}
