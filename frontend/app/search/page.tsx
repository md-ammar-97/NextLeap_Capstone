"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Search } from "lucide-react";
import { searchSkus } from "@/lib/catalog";
import { useUIStore } from "@/lib/store";
import { ProductCard } from "@/components/ProductCard";
import { CartBar } from "@/components/CartBar";

const HINTS = ["Search for “atta”…", "“charger”…", "“micellar water”…"];

// The 5 research-callback SKUs (docs/context.md) — deliberately the chips,
// not arbitrary popular queries, so an empty/no-results search still plants
// the demo moment.
const SUGGESTED_QUERIES = ["atta", "charger", "micellar water", "melatonin"];

export default function SearchPage() {
  const router = useRouter();
  const openProductSheet = useUIStore((s) => s.openProductSheet);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [hintIndex, setHintIndex] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setHintIndex((i) => (i + 1) % HINTS.length), 2500);
    return () => clearInterval(id);
  }, []);

  const results = useMemo(() => searchSkus(query), [query]);
  const trimmed = query.trim();

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-20 bg-white border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => router.back()} aria-label="Back">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 flex items-center gap-2 bg-[var(--bg-soft)] rounded-[var(--r-pill)] px-3.5 py-2.5">
            <Search size={16} className="text-[var(--ink-500)] shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={HINTS[hintIndex]}
              className="flex-1 bg-transparent text-[13px] text-[var(--ink-900)] outline-none placeholder:text-[var(--ink-500)]"
            />
          </div>
        </div>
      </div>

      {trimmed && results.length > 0 && (
        <div className="px-4 pt-4 grid grid-cols-2 gap-x-3 gap-y-4">
          {results.map((sku) => (
            <ProductCard key={sku.sku_id} sku={sku} onOpen={openProductSheet} />
          ))}
        </div>
      )}

      {trimmed && results.length === 0 && (
        <div className="px-4 pt-8 text-center">
          <p className="text-[13px] text-[var(--ink-500)]">No products found for &lsquo;{trimmed}&rsquo;</p>
          <QueryChips onPick={setQuery} label="Try one of these instead" />
        </div>
      )}

      {!trimmed && (
        <div className="px-4 pt-8 text-center">
          <p className="text-[13px] text-[var(--ink-500)]">Search across all 12 categories</p>
          <QueryChips onPick={setQuery} label="Popular searches" />
        </div>
      )}

      <CartBar />
    </div>
  );
}

function QueryChips({ onPick, label }: { onPick: (q: string) => void; label: string }) {
  return (
    <div className="mt-4">
      <p className="text-[11px] font-semibold text-[var(--ink-500)] uppercase tracking-wide mb-2">{label}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTED_QUERIES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="text-[12px] font-medium px-3 py-1.5 rounded-[var(--r-pill)] border border-[var(--line)] text-[var(--ink-700)] bg-white"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
