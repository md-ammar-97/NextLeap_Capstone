"use client";

import Link from "next/link";
import { MapPin, Search } from "lucide-react";
import { CATEGORIES, SKUS, getSkuById } from "@/lib/catalog";
import { currentPersonaProfile, useLocationStore, usePersonaStore, useUIStore } from "@/lib/store";
import { CategoryTile } from "@/components/CategoryTile";
import { ProductCard } from "@/components/ProductCard";
import { PromoCarousel } from "@/components/PromoCarousel";
import { CartBar } from "@/components/CartBar";
import { PersonaToggle } from "@/components/PersonaToggle";

export default function HomePage() {
  const personaId = usePersonaStore((s) => s.personaId);
  const profile = currentPersonaProfile(personaId);
  const openProductSheet = useUIStore((s) => s.openProductSheet);
  const address = useLocationStore((s) => s.address);

  const orderAgain = profile.order_again_sku_ids
    .map((id) => getSkuById(id))
    .filter((s): s is NonNullable<typeof s> => !!s);

  const deals = SKUS.filter((s) => s.deal).slice(0, 8);

  return (
    <div className="pb-24">
      <header
        className="px-4 pt-5 pb-6 rounded-b-[var(--r-lg)]"
        style={{ background: "linear-gradient(160deg, var(--im-purple), var(--im-purple-deep))" }}
      >
        <div className="flex items-center justify-between gap-2">
          <Link href="/location" className="flex items-center gap-1.5 text-white min-w-0">
            <MapPin size={16} className="shrink-0" />
            <span className="text-[13px] font-semibold truncate">Home — {address}</span>
          </Link>
          <PersonaToggle />
        </div>
        <p className="text-[11px] text-white/70 mt-0.5">Delivery in 12 minutes</p>

        <div className="mt-3 flex items-center gap-2 bg-white rounded-[var(--r-pill)] px-3.5 py-2.5">
          <Search size={16} className="text-[var(--ink-500)]" />
          <span className="text-[13px] text-[var(--ink-500)]">Search for &ldquo;atta&rdquo;&hellip;</span>
        </div>
      </header>

      <section className="mt-4 px-4">
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
          {CATEGORIES.map((c) => (
            <CategoryTile key={c.category_id} category={c} />
          ))}
        </div>
      </section>

      <section className="mt-4 px-4">
        <PromoCarousel />
      </section>

      {orderAgain.length > 0 && (
        <section className="mt-5">
          <h2 className="px-4 text-[15px] font-bold text-[var(--ink-900)] mb-2">Order Again</h2>
          <div className="flex gap-3 overflow-x-auto pb-1 px-4 scrollbar-none">
            {orderAgain.map((sku) => (
              <div key={sku.sku_id} className="w-32 shrink-0">
                <ProductCard sku={sku} onOpen={openProductSheet} />
              </div>
            ))}
          </div>
        </section>
      )}

      {deals.length > 0 && (
        <section className="mt-6 px-4">
          <h2 className="text-[15px] font-bold text-[var(--ink-900)] mb-2">Hot deals</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            {deals.map((sku) => (
              <ProductCard key={sku.sku_id} sku={sku} onOpen={openProductSheet} />
            ))}
          </div>
        </section>
      )}

      <CartBar />
    </div>
  );
}
