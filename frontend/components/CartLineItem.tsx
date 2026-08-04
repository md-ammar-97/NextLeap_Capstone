"use client";

import { getSkuById } from "@/lib/catalog";
import { useCartStore, useUIStore } from "@/lib/store";
import { ProductImage } from "./ProductImage";
import { AddStepper } from "./AddStepper";

export function CartLineItem({ skuId, qty }: { skuId: string; qty: number }) {
  const sku = getSkuById(skuId);
  const setQty = useCartStore((s) => s.setQty);
  const addToCart = useCartStore((s) => s.addToCart);
  const openProductSheet = useUIStore((s) => s.openProductSheet);

  if (!sku) return null;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-[var(--line)] last:border-b-0">
      <button
        type="button"
        onClick={() => openProductSheet(sku.sku_id)}
        className="w-14 h-14 rounded-[var(--r-sm)] overflow-hidden shrink-0"
      >
        <ProductImage image={sku.image} categoryId={sku.category_id} alt={sku.name} className="w-full h-full" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[var(--ink-900)] line-clamp-2">{sku.name}</p>
        <p className="text-[11px] text-[var(--ink-500)] mt-0.5">{sku.unit}</p>
        <p className="text-[13px] font-bold mt-1">₹{sku.price * qty}</p>
      </div>
      <AddStepper
        qty={qty}
        size="sm"
        onAdd={() => addToCart(sku.sku_id, 1)}
        onIncrement={() => setQty(sku.sku_id, qty + 1)}
        onDecrement={() => setQty(sku.sku_id, qty - 1)}
      />
    </div>
  );
}
