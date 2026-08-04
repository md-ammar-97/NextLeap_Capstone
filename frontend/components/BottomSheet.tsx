"use client";

import { AnimatePresence, m, type PanInfo } from "framer-motion";
import { type ReactNode } from "react";

export function BottomSheet({
  open,
  onClose,
  children,
  maxHeight = "85dvh",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxHeight?: string;
}) {
  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 120 || info.velocity.y > 500) {
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <m.div
            className="fixed inset-0 bg-black/45 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <m.div
            className="fixed left-1/2 bottom-0 z-50 w-full max-w-[480px] -translate-x-1/2 bg-white rounded-t-[var(--r-lg)] overflow-hidden flex flex-col"
            style={{ maxHeight, boxShadow: "var(--shadow-sheet)" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
          >
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-9 h-1 rounded-full bg-[var(--line)]" />
            </div>
            <div className="overflow-y-auto">{children}</div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}
