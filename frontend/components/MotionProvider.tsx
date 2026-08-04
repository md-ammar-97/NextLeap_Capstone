"use client";

import { LazyMotion } from "framer-motion";
import type { ReactNode } from "react";

// Dynamic import (function form, not a static import) is what actually
// keeps framer-motion's engine out of the initial bundle — a static
// top-level import here would defeat the whole point (docs/update.md U5).
const loadFeatures = () => import("@/lib/motion-features").then((mod) => mod.default);

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  );
}
