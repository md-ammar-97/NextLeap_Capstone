"use client";

import { discountPct, getSkuById } from "@/lib/catalog";
import { useCartStore, useUIStore } from "@/lib/store";
import { BottomSheet } from "./BottomSheet";
import { ProductImage } from "./ProductImage";
import { AddStepper } from "./AddStepper";
import { TrustChip } from "./TrustChip";

export function ProductSheet() {
  const openSkuId = useUIStore((s) => s.openSkuId);
  const closeProductSheet = useUIStore((s) => s.closeProductSheet);
  const sku = openSkuId ? getSkuById(openSkuId) : undefined;

  const line = useCartStore((s) => (sku ? s.lines.find((l) => l.sku_id === sku.sku_id) : undefined));
  const addToCart = useCartStore((s) => s.addToCart);
  const setQty = useCartStore((s) => s.setQty);
  const qty = line?.qty ?? 0;

  return (
    <BottomSheet open={!!sku} onClose={closeProductSheet}>
      {sku && (
        <div className="pb-8">
          <div className="w-full aspect-[4/3]">
            <ProductImage image={sku.image} categoryId={sku.category_id} alt={sku.name} className="w-full h-full" />
          </div>
          <div className="px-5 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-bold text-[var(--ink-900)]">{sku.name}</h2>
                <p className="text-[12px] text-[var(--ink-500)] mt-0.5">{sku.unit}</p>
              </div>
              <span
                className={`mt-1 w-3.5 h-3.5 border-2 flex items-center justify-center shrink-0 ${
                  sku.veg ? "border-[var(--im-green)]" : "border-[var(--im-red)]"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${sku.veg ? "bg-[var(--im-green)]" : "bg-[var(--im-red)]"}`} />
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-[20px] font-extrabold">₹{sku.price}</span>
              {sku.mrp > sku.price && (
                <>
                  <span className="text-[13px] text-[var(--ink-300)] line-through">₹{sku.mrp}</span>
                  <span className="text-[12px] font-semibold text-[var(--im-green)]">
                    {discountPct(sku)}% off
                  </span>
                </>
              )}
            </div>

            <p className="text-[13px] leading-[19px] text-[var(--ink-700)] mt-3">{sku.description}</p>

            {sku.trust_facts.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-semibold text-[var(--ink-500)] uppercase tracking-wide mb-2">
                  Good to know
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sku.trust_facts.map((f) => (
                    <TrustChip key={f.fact_id} type={f.type} label={f.label} />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5">
              <AddStepper
                qty={qty}
                disabled={sku.out_of_stock}
                onAdd={() => addToCart(sku.sku_id, 1)}
                onIncrement={() => setQty(sku.sku_id, qty + 1)}
                onDecrement={() => setQty(sku.sku_id, qty - 1)}
              />
            </div>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
