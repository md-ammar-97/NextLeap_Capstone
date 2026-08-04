"use client";

import { useEffect, useState } from "react";
import { useSessionStore, useUIStore } from "@/lib/store";
import { fetchMetrics } from "@/lib/api";
import { BottomSheet } from "./BottomSheet";

interface FunnelStep {
  label: string;
  value: number;
}

export function MetricsDrawer() {
  const open = useUIStore((s) => s.metricsDrawerOpen);
  const close = useUIStore((s) => s.closeMetricsDrawer);
  const sessionId = useSessionStore((s) => s.sessionId);

  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [latencyP95, setLatencyP95] = useState<number | null>(null);
  const [newCategoryAdded, setNewCategoryAdded] = useState(0);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchMetrics(sessionId).then((data) => {
      setLoading(false);
      if (!data) return;
      setCounts(data.counts ?? {});
      setLatencyP95(data.latency_p95_ms);
      setNewCategoryAdded(data.new_category_added ?? 0);
    });
  }, [open, sessionId]);

  const steps: FunnelStep[] = [
    { label: "Suggestions shown", value: counts.suggestion_shown ?? 0 },
    { label: "Suggestions tapped", value: counts.suggestion_tapped ?? 0 },
    { label: "Suggestions added", value: counts.suggestion_added ?? 0 },
    { label: "New-category items added", value: newCategoryAdded },
    { label: "Checkout completed", value: counts.order_placed ?? 0 },
  ];
  const max = Math.max(1, ...steps.map((s) => s.value));
  const allZero = steps.every((s) => s.value === 0);
  // North-star metric per docs/context.md section 6: a session counts as a
  // category-expansion win only if a new-category item was both added via
  // the copilot AND the checkout actually completed — not either alone.
  const categoryExpansionAchieved = newCategoryAdded >= 1 && (counts.order_placed ?? 0) >= 1;

  return (
    <BottomSheet open={open} onClose={close} maxHeight="70dvh">
      <div className="px-5 pb-8 pt-1 font-mono">
        <p className="text-[11px] uppercase tracking-wide text-[var(--ink-500)] mb-1">
          Session instrumentation — not a product surface
        </p>
        <h2 className="text-[15px] font-bold text-[var(--ink-900)] mb-2">Exploration funnel</h2>

        {!loading && (
          <div
            className={`mb-4 text-[12px] font-semibold px-3 py-2 rounded-[var(--r-sm)] ${
              categoryExpansionAchieved
                ? "bg-[var(--im-green)]/10 text-[var(--im-green)]"
                : "bg-[var(--bg-soft)] text-[var(--ink-500)]"
            }`}
          >
            Session Category-Expansion: {categoryExpansionAchieved ? "Achieved ✓" : "Not yet"}
          </div>
        )}

        {loading && <p className="text-[12px] text-[var(--ink-500)]">Loading…</p>}

        {!loading && (
          <div className="space-y-3">
            {steps.map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-[var(--ink-700)]">{s.label}</span>
                  <span className="font-bold text-[var(--ink-900)]">{s.value}</span>
                </div>
                <div className="h-2 bg-[var(--bg-soft)] rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-[var(--ink-700)]"
                    style={{ width: `${(s.value / max) * 100}%` }}
                  />
                </div>
              </div>
            ))}

            {allZero && (
              <p className="text-[11px] text-[var(--ink-500)] pt-1">
                No copilot interactions logged yet this session — this is expected on an empty
                or unaided run, not an error.
              </p>
            )}

            <div className="pt-2 mt-2 border-t border-[var(--line)] flex justify-between text-[12px]">
              <span className="text-[var(--ink-700)]">Copilot latency p95</span>
              <span className="font-bold text-[var(--ink-900)]">
                {latencyP95 !== null ? `${Math.round(latencyP95)}ms` : "—"}
              </span>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
