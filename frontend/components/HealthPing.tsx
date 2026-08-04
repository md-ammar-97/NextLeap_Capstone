"use client";

import { useEffect } from "react";
import { flushEventQueue, pingHealth } from "@/lib/api";

/** Fire-and-forget on every app load: keeps a warm connection to the
 * backend before the user reaches cart (no-op for cold starts on Render's
 * paid Standard plan, which doesn't sleep — this used to matter more on
 * the free tier), and retries any events queued from a previous failed
 * /events call (docs/edgecases.md #34). */
export function HealthPing() {
  useEffect(() => {
    pingHealth();
    void flushEventQueue();
  }, []);
  return null;
}
