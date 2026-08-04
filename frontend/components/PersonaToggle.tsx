"use client";

import { currentPersonaProfile, useCartStore, usePersonaStore, type PersonaId } from "@/lib/store";

const OPTIONS: { id: PersonaId; label: string }[] = [
  { id: "priya", label: "Priya" },
  { id: "ishaan", label: "Ishaan" },
];

/** Judge-facing demo toggle (docs/context.md section 5, P1 in the
 * requirements). Switching persona swaps history/framing and clears the
 * copilot dismissed-list so the new persona isn't silently suppressed by
 * the previous one's session state (docs/edgecases.md #39). The backend
 * copilot cache key already includes persona, so no server-side cache
 * clear is needed. */
export function PersonaToggle() {
  const personaId = usePersonaStore((s) => s.personaId);
  const setPersona = usePersonaStore((s) => s.setPersona);
  const resetDismissed = useCartStore((s) => s.resetDismissed);

  return (
    <div className="inline-flex bg-white/15 rounded-[var(--r-pill)] p-0.5">
      {OPTIONS.map((opt) => {
        const active = personaId === opt.id;
        const profile = currentPersonaProfile(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            title={`${profile.display_name} — ${profile.framing === "trust" ? "trust-led" : "deal-led"}`}
            onClick={() => {
              if (opt.id === personaId) return;
              setPersona(opt.id);
              resetDismissed();
            }}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-[var(--r-pill)] transition-colors ${
              active ? "bg-white text-[var(--im-purple)]" : "text-white/80"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
