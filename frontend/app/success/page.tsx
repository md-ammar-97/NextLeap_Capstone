"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import confetti from "canvas-confetti";
import { useOrderStore, useUIStore } from "@/lib/store";
import { getSkuById } from "@/lib/catalog";

export default function SuccessPage() {
  const router = useRouter();
  const order = useOrderStore((s) => s.lastOrder);
  const openMetricsDrawer = useUIStore((s) => s.openMetricsDrawer);
  const fired = useRef(false);

  useEffect(() => {
    if (!order) {
      router.replace("/");
      return;
    }
    if (fired.current) return;
    fired.current = true;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    confetti({
      particleCount: reducedMotion ? 0 : 150,
      spread: 70,
      origin: { y: 0.3 },
      disableForReducedMotion: true,
    });
  }, [order, router]);

  if (!order) return null;

  return (
    <div className="min-h-[100dvh] flex flex-col items-center px-6 pt-16 pb-10 text-center">
      <CheckCircle2 size={56} className="text-[var(--im-green)]" strokeWidth={1.6} />
      <h1 className="text-[19px] font-extrabold text-[var(--ink-900)] mt-4">Order placed!</h1>
      <p className="text-[13px] text-[var(--ink-500)] mt-1">Order ID {order.order_id}</p>

      <div className="w-full mt-6 rounded-[var(--r-md)] border border-[var(--line)] p-4 text-left">
        {order.lines.map((l) => {
          const sku = getSkuById(l.sku_id);
          if (!sku) return null;
          return (
            <div key={l.sku_id} className="flex items-center justify-between py-1.5 text-[13px]">
              <span className="text-[var(--ink-700)]">
                {sku.name} x{l.qty}
              </span>
              <span className="font-medium text-[var(--ink-900)]">₹{sku.price * l.qty}</span>
            </div>
          );
        })}
        <div className="h-px bg-[var(--line)] my-2" />
        <div className="flex items-center justify-between text-[13px] font-extrabold">
          <span>To Pay</span>
          <span>₹{order.totals.to_pay}</span>
        </div>
      </div>

      <Link
        href="/"
        className="mt-8 bg-[var(--im-orange)] text-white text-[13px] font-bold px-8 py-3 rounded-[var(--r-md)]"
      >
        Back to Home
      </Link>

      <button
        type="button"
        className="mt-4 text-[12px] text-[var(--ink-500)] underline"
        onClick={openMetricsDrawer}
      >
        View session metrics
      </button>
    </div>
  );
}
