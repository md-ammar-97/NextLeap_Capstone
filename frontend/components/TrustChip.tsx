import type { TrustFactType } from "@/lib/catalog";

const ICON_BY_TYPE: Record<TrustFactType, string> = {
  expiry: "🕒",
  ingredient: "🌾",
  authenticity: "✅",
  freshness: "🌿",
  sourcing: "📍",
  compatibility: "🔌",
  warranty: "🛡️",
  return: "↩",
  quantity: "📦",
};

export function TrustChip({ type, label }: { type: TrustFactType; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 bg-[var(--bg-soft)] text-[var(--ink-700)] text-[10px] leading-[14px] font-medium px-2 py-1 rounded-[var(--r-pill)] whitespace-nowrap">
      <span aria-hidden>{ICON_BY_TYPE[type] ?? "•"}</span>
      {label}
    </span>
  );
}
