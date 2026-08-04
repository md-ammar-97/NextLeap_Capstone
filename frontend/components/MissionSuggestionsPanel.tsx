"use client";

import { Sparkles, X } from "lucide-react";
import type { CopilotResponseBody } from "@/lib/api";
import { SuggestionCard } from "./SuggestionCard";

/** Container-agnostic mission header + suggestion row, shared by the
 * cart-page MissionModule (inline glow-border container) and
 * MissionNudgeSheet (BottomSheet container) — docs/update.md U4. */
export function MissionSuggestionsPanel({
  data,
  sessionId,
  currentHash,
  onNotNow,
  onNotRelevant,
  onSuggestionTapped,
}: {
  data: CopilotResponseBody;
  sessionId: string;
  currentHash: string;
  onNotNow: () => void;
  onNotRelevant: (skuId: string) => void;
  onSuggestionTapped: (skuId: string) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-[var(--im-purple)] shrink-0" />
        <p className="flex-1 text-[14px] font-bold text-[var(--ink-900)]">{data.mission}</p>
        <button type="button" onClick={onNotNow} aria-label="Dismiss">
          <X size={16} className="text-[var(--ink-500)]" />
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 mt-3 -mx-1 px-1 snap-x scrollbar-none">
        {data.suggestions.map((s) => (
          <SuggestionCard
            key={s.sku_id}
            suggestion={s}
            sessionId={sessionId}
            cartHash={currentHash}
            onOpen={() => onSuggestionTapped(s.sku_id)}
            onNotRelevant={() => onNotRelevant(s.sku_id)}
          />
        ))}
      </div>
    </>
  );
}
