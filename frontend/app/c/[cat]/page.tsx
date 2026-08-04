"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CATEGORIES, getCategoryById, getSkusByCategory } from "@/lib/catalog";
import { useUIStore } from "@/lib/store";
import { ProductCard } from "@/components/ProductCard";
import { CartBar } from "@/components/CartBar";

export default function ListingPage() {
  const params = useParams<{ cat: string }>();
  const router = useRouter();
  const openProductSheet = useUIStore((s) => s.openProductSheet);

  const category = getCategoryById(params.cat);
  const skus = getSkusByCategory(params.cat);

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-20 bg-white border-b border-[var(--line)]">
        <div className="flex items-center gap-2 px-4 py-3">
          <button type="button" onClick={() => router.back()} aria-label="Back">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-[16px] font-bold text-[var(--ink-900)]">{category?.name ?? "Category"}</h1>
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-none">
          {CATEGORIES.map((c) => (
            <Link
              key={c.category_id}
              href={`/c/${c.category_id}`}
              className={`shrink-0 text-[12px] font-medium px-3 py-1.5 rounded-[var(--r-pill)] border ${
                c.category_id === params.cat
                  ? "bg-[var(--im-purple)] text-white border-[var(--im-purple)]"
                  : "bg-white text-[var(--ink-700)] border-[var(--line)]"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 grid grid-cols-2 gap-x-3 gap-y-4">
        {skus.map((sku) => (
          <ProductCard key={sku.sku_id} sku={sku} onOpen={openProductSheet} />
        ))}
      </div>

      <CartBar />
    </div>
  );
}
