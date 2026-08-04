"use client";

import { useEffect, useState } from "react";
import { useMissionSuggestions } from "@/lib/useMissionSuggestions";
import { useSessionStore } from "@/lib/store";
import { BottomSheet } from "./BottomSheet";
import { MissionSuggestionsPanel } from "./MissionSuggestionsPanel";

/** Post-add nudge (docs/update.md U4) — demonstrates the copilot inside
 * the mission flow without requiring a trip to the cart. Mount only on
 * Home/Listing/Search (never Cart/Checkout, where MissionModule already
 * lives inline) — that placement alone satisfies "never on cart page,"
 * no extra gating needed. True one-shot per session: once shown, it won't
 * reopen even if the basket later produces a fresh "ready" state. */
export function MissionNudgeSheet() {
  const { status, data, currentHash, sessionId, handleNotNow, handleNotRelevant, handleSuggestionTapped } =
    useMissionSuggestions();
  const nudgeShownThisSession = useSessionStore((s) => s.nudgeShownThisSession);
  const markNudgeShown = useSessionStore((s) => s.markNudgeShown);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (status === "ready" && data && !nudgeShownThisSession) {
      setOpen(true);
      markNudgeShown();
    }
  }, [status, data, nudgeShownThisSession, markNudgeShown]);

  function close() {
    setOpen(false);
    // Same module_dismissed semantics as the cart-page "Not now" — keyed
    // by cart_hash, so a later basket change (new hash) isn't suppressed.
    handleNotNow();
  }

  if (!data) return null;

  return (
    <BottomSheet open={open} onClose={close} maxHeight="65dvh">
      <div className="px-4 pb-6 pt-1">
        <MissionSuggestionsPanel
          data={data}
          sessionId={sessionId}
          currentHash={currentHash}
          onNotNow={close}
          onNotRelevant={handleNotRelevant}
          onSuggestionTapped={handleSuggestionTapped}
        />
      </div>
    </BottomSheet>
  );
}
