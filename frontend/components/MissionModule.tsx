"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { getSkuById } from "@/lib/catalog";
import { currentPersonaProfile, useCartStore, usePersonaStore, useSessionStore, useUIStore } from "@/lib/store";
import { fetchCopilotSuggestions, postEvents, type CopilotResponseBody, type Suggestion } from "@/lib/api";
import { PlaceholderTile } from "./PlaceholderTile";
import { AddStepper } from "./AddStepper";
import { TrustChip } from "./TrustChip";
import { ProtectedTrialBadge } from "./ProtectedTrialBadge";

const DEBOUNCE_MS = 800;

type Status = "idle" | "loading" | "ready" | "silent";

export function MissionModule() {
  const lines = useCartStore((s) => s.lines);
  const dismissedSkuIds = useCartStore((s) => s.dismissed_sku_ids);
  const moduleDismissedHashes = useCartStore((s) => s.module_dismissed_hashes);
  const cartHashFn = useCartStore((s) => s.cartHash);
  const dismissSku = useCartStore((s) => s.dismissSku);
  const dismissModuleForCurrentHash = useCartStore((s) => s.dismissModuleForCurrentHash);
  const personaId = usePersonaStore((s) => s.personaId);
  const sessionId = useSessionStore((s) => s.sessionId);
  const openProductSheet = useUIStore((s) => s.openProductSheet);

  const [status, setStatus] = useState<Status>("idle");
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

  if (status === "loading" && everShownRef.current) {
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
    <div
      className="mx-4 mt-4 rounded-[var(--r-lg)] p-[1px]"
      style={{ background: "var(--ai-glow)" }}
    >
      <div className="rounded-[calc(var(--r-lg)-1px)] bg-white p-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[var(--im-purple)] shrink-0" />
          <p className="flex-1 text-[14px] font-bold text-[var(--ink-900)]">{data.mission}</p>
          <button type="button" onClick={handleNotNow} aria-label="Dismiss">
            <X size={16} className="text-[var(--ink-500)]" />
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1 mt-3 -mx-1 px-1 snap-x scrollbar-none">
          {data.suggestions.map((s) => (
            <SuggestionCard
              key={s.sku_id}
              suggestion={s}
              sessionId={sessionId}
              onOpen={() => {
                postEvents([
                  {
                    session_id: sessionId,
                    ts: new Date().toISOString(),
                    type: "suggestion_tapped",
                    payload: { sku_id: s.sku_id },
                  },
                ]);
                openProductSheet(s.sku_id);
              }}
              onNotRelevant={() => handleNotRelevant(s.sku_id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  sessionId,
  onOpen,
  onNotRelevant,
}: {
  suggestion: Suggestion;
  sessionId: string;
  onOpen: () => void;
  onNotRelevant: () => void;
}) {
  const sku = getSkuById(suggestion.sku_id);
  const addToCart = useCartStore((s) => s.addToCart);
  const setQty = useCartStore((s) => s.setQty);
  const line = useCartStore((s) => s.lines.find((l) => l.sku_id === suggestion.sku_id));
  const qty = line?.qty ?? 0;

  if (!sku) return null;

  function logAdded() {
    postEvents([
      {
        session_id: sessionId,
        ts: new Date().toISOString(),
        type: "suggestion_added",
        payload: { sku_id: sku!.sku_id, is_new_category: suggestion.is_new_category },
      },
    ]);
  }

  return (
    <div className="w-[220px] shrink-0 snap-start rounded-[var(--r-md)] border border-[var(--line)] p-2.5 flex flex-col">
      <button type="button" onClick={onOpen} className="flex gap-2 text-left">
        <div className="w-14 h-14 rounded-[var(--r-sm)] overflow-hidden shrink-0">
          <PlaceholderTile categoryId={sku.category_id} className="w-full h-full" />
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold line-clamp-2 text-[var(--ink-900)]">{sku.name}</p>
          <p className="text-[12px] font-bold mt-0.5">₹{sku.price}</p>
        </div>
      </button>

      {suggestion.price_anchor && (
        <p className="text-[10px] text-[var(--im-green)] mt-1.5">{suggestion.price_anchor}</p>
      )}
      <p className="text-[11px] italic text-[var(--ink-700)] mt-1 line-clamp-2">{suggestion.why}</p>

      <div className="flex flex-wrap gap-1 mt-1.5">
        {suggestion.trust_facts.slice(0, 3).map((f, i) => (
          <TrustChip key={i} type={f.type} label={f.label} />
        ))}
      </div>

      <div className="flex items-center justify-between mt-2">
        {suggestion.protected_trial ? <ProtectedTrialBadge /> : <span />}
        <AddStepper
          qty={qty}
          size="sm"
          onAdd={() => {
            addToCart(sku.sku_id, 1);
            logAdded();
          }}
          onIncrement={() => setQty(sku.sku_id, qty + 1)}
          onDecrement={() => setQty(sku.sku_id, qty - 1)}
        />
      </div>

      <button
        type="button"
        onClick={onNotRelevant}
        className="text-[10px] text-[var(--ink-300)] mt-1.5 self-end"
      >
        Not relevant
      </button>
    </div>
  );
}
