"use client";

import { useEffect, useState } from "react";

const SLIDES = [
  { title: "Explore something new today", sub: "40+ categories, one delivery", tint: "linear-gradient(120deg,#8123AD,#5C1F87)" },
  { title: "Trust facts on every first try", sub: "Expiry, authenticity, sourcing — upfront", tint: "linear-gradient(120deg,#FC8019,#8123AD)" },
  { title: "Protected Trial on new categories", sub: "Instant replacement, no questions", tint: "linear-gradient(120deg,#1BA672,#2563EB)" },
];

export function PromoCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="overflow-hidden">
      <div
        className="flex gap-2 transition-transform duration-500 ease-out"
        style={{ transform: `translateX(calc(-${index} * (100% - 32px)))` }}
      >
        {SLIDES.map((s, i) => (
          <div
            key={i}
            className="shrink-0 w-[calc(100%-32px)] h-24 rounded-[var(--r-lg)] px-4 flex flex-col justify-center text-white"
            style={{ background: s.tint }}
          >
            <p className="text-[14px] font-bold">{s.title}</p>
            <p className="text-[11px] opacity-90 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
