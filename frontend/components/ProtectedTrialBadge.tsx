"use client";

import { ShieldCheck } from "lucide-react";
import { useUIStore } from "@/lib/store";
import { BottomSheet } from "./BottomSheet";

export function ProtectedTrialBadge() {
  const openProtectedTrial = useUIStore((s) => s.openProtectedTrial);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openProtectedTrial();
      }}
      className="inline-flex items-center gap-1 bg-[var(--trust-blue)] text-white text-[10px] font-semibold px-2 py-1 rounded-[var(--r-pill)]"
    >
      <ShieldCheck size={12} strokeWidth={2.2} />
      Protected Trial
    </button>
  );
}

export function ProtectedTrialSheet() {
  const open = useUIStore((s) => s.protectedTrialOpen);
  const close = useUIStore((s) => s.closeProtectedTrial);
  return (
    <BottomSheet open={open} onClose={close} maxHeight="60dvh">
      <div className="px-5 pb-8 pt-1">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="text-[var(--trust-blue)]" size={22} />
          <h2 className="text-[17px] font-bold text-[var(--ink-900)]">Protected Trial</h2>
        </div>
        <p className="text-[14px] leading-[20px] text-[var(--ink-700)]">
          First time trying this category? If anything&rsquo;s wrong — wrong item, damaged, not
          fresh — instant replacement or refund. No questions, no photos, no support calls.
        </p>
      </div>
    </BottomSheet>
  );
}
