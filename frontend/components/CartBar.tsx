"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import { useCartStore } from "@/lib/store";
import { computeTotals } from "@/lib/cart";

export function CartBar() {
  const lines = useCartStore((s) => s.lines);
  const itemCount = lines.reduce((n, l) => n + l.qty, 0);
  const { to_pay } = computeTotals(lines);

  return (
    <AnimatePresence>
      {itemCount > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed left-1/2 -translate-x-1/2 bottom-3 w-[calc(100%-24px)] max-w-[456px] z-30"
        >
          <Link
            href="/cart"
            className="flex items-center justify-between bg-[var(--im-green)] text-white rounded-[var(--r-md)] px-4 py-3 shadow-lg"
          >
            <span className="flex items-center gap-2 text-[13px] font-semibold">
              <ShoppingCart size={16} />
              {itemCount} item{itemCount > 1 ? "s" : ""} · ₹{to_pay}
            </span>
            <span className="text-[13px] font-bold">View Cart →</span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
