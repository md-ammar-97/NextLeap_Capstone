import Link from "next/link";
import type { Category } from "@/lib/catalog";
import { CATEGORY_ICONS, CATEGORY_TINTS } from "./icons";

export function CategoryTile({ category }: { category: Category }) {
  const Icon = CATEGORY_ICONS[category.icon];
  const tint = CATEGORY_TINTS[category.category_id] ?? "var(--bg-soft)";
  return (
    <Link href={`/c/${category.category_id}`} className="flex flex-col items-center gap-1.5 shrink-0 w-16">
      <div
        className="w-16 h-16 rounded-[var(--r-lg)] flex items-center justify-center"
        style={{ backgroundColor: tint }}
      >
        {Icon ? <Icon className="w-7 h-7 text-[var(--ink-700)]" strokeWidth={1.8} /> : null}
      </div>
      <span className="text-[11px] leading-[14px] text-center text-[var(--ink-700)] line-clamp-2">
        {category.name}
      </span>
    </Link>
  );
}
