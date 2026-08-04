"use client";

import { useMissionSuggestions } from "@/lib/useMissionSuggestions";
import { MissionSuggestionsPanel } from "./MissionSuggestionsPanel";

/** Cart-page placement of the mission copilot — inline, always visible
 * once suggestions are ready. See MissionNudgeSheet for the post-add
 * nudge placement (docs/update.md U4), which shares the same underlying
 * useMissionSuggestions hook and MissionSuggestionsPanel presentation. */
export function MissionModule() {
  const { status, data, currentHash, sessionId, everShown, handleNotNow, handleNotRelevant, handleSuggestionTapped } =
    useMissionSuggestions();

  if (status === "loading" && everShown) {
    return (
      <div className="mx-4 mt-4 rounded-[var(--r-lg)] border border-[var(--line)] p-4 animate-pulse">
        <div className="h-4 w-2/3 bg-[var(--bg-soft)] rounded" />
        <div className="flex gap-3 mt-3">
          <div className="w-40 h-32 bg-[var(--bg-soft)] rounded-[var(--r-md)]" />
          <div className="w-40 h-32 bg-[var(--bg-soft)] rounded-[var(--r-md)]" />
        </div>
      </div>
    );
  }

  if (status !== "ready" || !data) return null;

  return (
    <div className="mx-4 mt-4 rounded-[var(--r-lg)] p-[1px]" style={{ background: "var(--ai-glow)" }}>
      <div className="rounded-[calc(var(--r-lg)-1px)] bg-white p-4">
        <MissionSuggestionsPanel
          data={data}
          sessionId={sessionId}
          currentHash={currentHash}
          onNotNow={handleNotNow}
          onNotRelevant={handleNotRelevant}
          onSuggestionTapped={handleSuggestionTapped}
        />
      </div>
    </div>
  );
}
