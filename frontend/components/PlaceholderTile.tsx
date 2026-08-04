import { CATEGORY_ICONS, CATEGORY_TINTS } from "./icons";

export function PlaceholderTile({
  categoryId,
  className = "",
}: {
  categoryId: string;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[categoryId];
  const tint = CATEGORY_TINTS[categoryId] ?? "var(--bg-soft)";
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{ backgroundColor: tint }}
    >
      {Icon ? <Icon className="w-1/3 h-1/3 text-ink-700" strokeWidth={1.6} style={{ opacity: 0.55 }} /> : null}
    </div>
  );
}
