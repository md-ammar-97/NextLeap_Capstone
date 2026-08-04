"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus } from "lucide-react";

export function AddStepper({
  qty,
  onAdd,
  onIncrement,
  onDecrement,
  disabled = false,
  size = "md",
}: {
  qty: number;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const h = size === "sm" ? "h-7" : "h-8";
  const text = size === "sm" ? "text-[11px]" : "text-xs";

  if (disabled) {
    return (
      <div
        className={`${h} px-3 flex items-center justify-center rounded-[var(--r-pill)] bg-[var(--bg-soft)] text-[var(--ink-300)] ${text} font-bold`}
      >
        Sold out
      </div>
    );
  }

  return (
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      className={`${h} flex items-center justify-center rounded-[var(--r-pill)] overflow-hidden select-none ${
        qty > 0
          ? "bg-[var(--im-green)] text-white px-1"
          : "bg-white text-[var(--im-green)] border border-[var(--im-green)] px-4"
      }`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {qty === 0 ? (
          <motion.button
            key="add"
            type="button"
            onClick={onAdd}
            className={`font-bold ${text} tracking-wide`}
          >
            ADD
          </motion.button>
        ) : (
          <motion.div key="stepper" className="flex items-center gap-2.5 px-1">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={onDecrement}
              className="w-5 h-5 flex items-center justify-center"
            >
              <Minus size={14} strokeWidth={3} />
            </button>
            <span className={`font-bold ${text} min-w-[1ch] text-center tabular-nums`}>{qty}</span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={onIncrement}
              className="w-5 h-5 flex items-center justify-center"
            >
              <Plus size={14} strokeWidth={3} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
