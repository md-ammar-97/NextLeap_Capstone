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
    const run = () => {
      pingHealth();
      void flushEventQueue();
    };
    // Deferred off the critical rendering path (docs/update.md U5) —
    // requestIdleCallback isn't in Safari <16.4, so fall back to a short
    // timeout rather than skip the deferral there.
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(run, 1000);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
