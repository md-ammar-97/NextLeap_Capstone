"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { currentPersonaProfile, useCartStore, usePersonaStore, useSessionStore, useUIStore } from "./store";
import { fetchCopilotSuggestions, postEvents, type CopilotResponseBody } from "./api";

const DEBOUNCE_MS = 800;

export type MissionStatus = "idle" | "loading" | "ready" | "silent";

/** Shared copilot-fetch logic behind both the cart-page module and the
 * post-add nudge sheet (docs/update.md U4) — debounced fetch, cart-hash
 * tracking, dismiss handlers. Each caller renders its own container. */
export function useMissionSuggestions() {
  const lines = useCartStore((s) => s.lines);
  const dismissedSkuIds = useCartStore((s) => s.dismissed_sku_ids);
  const moduleDismissedHashes = useCartStore((s) => s.module_dismissed_hashes);
  const cartHashFn = useCartStore((s) => s.cartHash);
  const dismissSku = useCartStore((s) => s.dismissSku);
  const dismissModuleForCurrentHash = useCartStore((s) => s.dismissModuleForCurrentHash);
  const personaId = usePersonaStore((s) => s.personaId);
  const sessionId = useSessionStore((s) => s.sessionId);
  const openProductSheet = useUIStore((s) => s.openProductSheet);

  const [status, setStatus] = useState<MissionStatus>("idle");
  const [data, setData] = useState<CopilotResponseBody | null>(null);
  const everShownRef = useRef(false);
  const shownLoggedRef = useRef<string | null>(null);

  const currentHash = useMemo(() => cartHashFn(), [lines, dismissedSkuIds, cartHashFn]);
  const isDismissedForHash = moduleDismissedHashes.includes(currentHash);

  useEffect(() => {
    if (lines.length === 0 || isDismissedForHash) {
      setStatus("silent");
      setData(null);
      return;
    }

    setStatus("loading");

    const timer = setTimeout(async () => {
      const historyCategoryIds = currentPersonaProfile(personaId).history_category_ids;
      const result = await fetchCopilotSuggestions({
        session_id: sessionId,
        persona: personaId === "priya" ? "householder" : "experimenter",
        cart: lines,
        history_category_ids: historyCategoryIds,
        dismissed_sku_ids: dismissedSkuIds,
        local_hour: new Date().getHours(),
      });

      if (result && result.suggestions.length > 0) {
        everShownRef.current = true;
        setData(result);
        setStatus("ready");
        if (shownLoggedRef.current !== currentHash) {
          shownLoggedRef.current = currentHash;
          postEvents(
            result.suggestions.map((s) => ({
              session_id: sessionId,
              ts: new Date().toISOString(),
              type: "suggestion_shown" as const,
              payload: { sku_id: s.sku_id, cart_hash: currentHash },
            }))
          );
        }
      } else {
        setData(null);
        setStatus("silent");
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHash, isDismissedForHash, lines.length, personaId, sessionId]);

  function handleNotNow() {
    dismissModuleForCurrentHash();
    postEvents([
      {
        session_id: sessionId,
        ts: new Date().toISOString(),
        type: "module_dismissed",
        payload: { cart_hash: currentHash },
      },
    ]);
  }

  function handleNotRelevant(skuId: string) {
    dismissSku(skuId);
    postEvents([
      { session_id: sessionId, ts: new Date().toISOString(), type: "not_relevant", payload: { sku_id: skuId } },
    ]);
  }

  function handleSuggestionTapped(skuId: string) {
    postEvents([
      { session_id: sessionId, ts: new Date().toISOString(), type: "suggestion_tapped", payload: { sku_id: skuId } },
    ]);
    openProductSheet(skuId);
  }

  return {
    status,
    data,
    currentHash,
    sessionId,
    everShown: everShownRef.current,
    handleNotNow,
    handleNotRelevant,
    handleSuggestionTapped,
  };
}
