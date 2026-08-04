"use client";

import { useEffect } from "react";
import { flushEventQueue, pingHealth } from "@/lib/api";

/** Fire-and-forget on every app load: wakes a sleeping Render free-tier
 * instance before the user reaches cart, and retries any events queued
 * from a previous failed /events call (docs/edgecases.md #34). */
export function HealthPing() {
  useEffect(() => {
    pingHealth();
    void flushEventQueue();
  }, []);
  return null;
}
