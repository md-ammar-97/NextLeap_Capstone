import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { fnv1a, nanoid } from "./hash";
import personasData from "./personas-data.json";
import { postEvents } from "./api";

export type CartLine = { sku_id: string; qty: number };

interface CartState {
  lines: CartLine[];
  dismissed_sku_ids: string[];
  module_dismissed_hashes: string[];
  suggested_origin_sku_ids: string[];
  addToCart: (skuId: string, qty?: number) => void;
  removeFromCart: (skuId: string) => void;
  setQty: (skuId: string, qty: number) => void;
  clearCart: () => void;
  dismissSku: (skuId: string) => void;
  dismissModuleForCurrentHash: () => void;
  resetDismissed: () => void;
  markSuggestedOrigin: (skuId: string) => void;
  cartHash: () => string;
}

/** U3 (docs/update.md): fires suggestion_removed for a cart line that
 * originated from a copilot suggestion. Hash is captured *before* removal
 * so it reflects the basket state the removal actually happened from. */
function logSuggestionRemoved(skuId: string, hashBeforeRemoval: string) {
  postEvents([
    {
      session_id: useSessionStore.getState().sessionId,
      ts: new Date().toISOString(),
      type: "suggestion_removed",
      payload: { sku_id: skuId, cart_hash: hashBeforeRemoval },
    },
  ]);
}

const MAX_QTY = 10;

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      dismissed_sku_ids: [],
      module_dismissed_hashes: [],
      suggested_origin_sku_ids: [],
      addToCart: (skuId, qty = 1) =>
        set((state) => {
          const existing = state.lines.find((l) => l.sku_id === skuId);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.sku_id === skuId ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l
              ),
            };
          }
          return { lines: [...state.lines, { sku_id: skuId, qty: Math.min(MAX_QTY, qty) }] };
        }),
      removeFromCart: (skuId) =>
        set((state) => {
          if (state.suggested_origin_sku_ids.includes(skuId)) {
            logSuggestionRemoved(skuId, get().cartHash());
          }
          return {
            lines: state.lines.filter((l) => l.sku_id !== skuId),
            suggested_origin_sku_ids: state.suggested_origin_sku_ids.filter((id) => id !== skuId),
          };
        }),
      setQty: (skuId, qty) =>
        set((state) => {
          if (qty <= 0) {
            if (state.suggested_origin_sku_ids.includes(skuId)) {
              logSuggestionRemoved(skuId, get().cartHash());
            }
            return {
              lines: state.lines.filter((l) => l.sku_id !== skuId),
              suggested_origin_sku_ids: state.suggested_origin_sku_ids.filter((id) => id !== skuId),
            };
          }
          return {
            lines: state.lines.map((l) =>
              l.sku_id === skuId ? { ...l, qty: Math.min(MAX_QTY, qty) } : l
            ),
          };
        }),
      clearCart: () => set({ lines: [], suggested_origin_sku_ids: [] }),
      markSuggestedOrigin: (skuId) =>
        set((state) => ({
          suggested_origin_sku_ids: state.suggested_origin_sku_ids.includes(skuId)
            ? state.suggested_origin_sku_ids
            : [...state.suggested_origin_sku_ids, skuId],
        })),
      dismissSku: (skuId) =>
        set((state) => ({
          dismissed_sku_ids: state.dismissed_sku_ids.includes(skuId)
            ? state.dismissed_sku_ids
            : [...state.dismissed_sku_ids, skuId],
        })),
      dismissModuleForCurrentHash: () =>
        set((state) => {
          const hash = get().cartHash();
          return {
            module_dismissed_hashes: state.module_dismissed_hashes.includes(hash)
              ? state.module_dismissed_hashes
              : [...state.module_dismissed_hashes, hash],
          };
        }),
      resetDismissed: () => set({ dismissed_sku_ids: [], module_dismissed_hashes: [] }),
      cartHash: () => {
        const lines = get().lines;
        const sorted = [...lines].sort((a, b) => a.sku_id.localeCompare(b.sku_id));
        return fnv1a(JSON.stringify(sorted) + "|" + get().dismissed_sku_ids.slice().sort().join(","));
      },
    }),
    { name: "im-cart", storage: createJSONStorage(() => localStorage) }
  )
);

export type PersonaId = "priya" | "ishaan";

interface PersonaProfile {
  persona_id: PersonaId;
  display_name: string;
  framing: "trust" | "deal";
  history_category_ids: string[];
  order_again_sku_ids: string[];
}

export const PERSONAS = personasData as Record<PersonaId, PersonaProfile>;

interface PersonaState {
  personaId: PersonaId;
  setPersona: (id: PersonaId) => void;
}

export const usePersonaStore = create<PersonaState>()(
  persist(
    (set) => ({
      personaId: "priya",
      setPersona: (id) => set({ personaId: id }),
    }),
    { name: "im-persona", storage: createJSONStorage(() => localStorage) }
  )
);

export function currentPersonaProfile(personaId: PersonaId): PersonaProfile {
  return PERSONAS[personaId];
}

interface LocationState {
  address: string;
  lat: number;
  lng: number;
  setLocation: (address: string, lat: number, lng: number) => void;
}

const BENGALURU_DEFAULT = { address: "HSR Layout, Bengaluru", lat: 12.9716, lng: 77.5946 };

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      ...BENGALURU_DEFAULT,
      setLocation: (address, lat, lng) => set({ address, lat, lng }),
    }),
    { name: "im-location", storage: createJSONStorage(() => localStorage) }
  )
);

interface SessionState {
  sessionId: string;
}

export const useSessionStore = create<SessionState>()(
  persist(
    () => ({
      sessionId: `s_${nanoid()}`,
    }),
    { name: "im-session", storage: createJSONStorage(() => sessionStorage) }
  )
);

export interface PlacedOrder {
  order_id: string;
  session_id: string;
  persona_id: string;
  lines: CartLine[];
  totals: { item_total: number; handling: number; delivery: number; gst_sim: number; to_pay: number };
  new_category_sku_ids: string[];
  placed_at: string;
}

interface OrderState {
  lastOrder: PlacedOrder | null;
  setLastOrder: (order: PlacedOrder) => void;
}

interface UIState {
  openSkuId: string | null;
  openProductSheet: (skuId: string) => void;
  closeProductSheet: () => void;
  protectedTrialOpen: boolean;
  openProtectedTrial: () => void;
  closeProtectedTrial: () => void;
  metricsDrawerOpen: boolean;
  openMetricsDrawer: () => void;
  closeMetricsDrawer: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  openSkuId: null,
  openProductSheet: (skuId) => set({ openSkuId: skuId }),
  closeProductSheet: () => set({ openSkuId: null }),
  protectedTrialOpen: false,
  openProtectedTrial: () => set({ protectedTrialOpen: true }),
  closeProtectedTrial: () => set({ protectedTrialOpen: false }),
  metricsDrawerOpen: false,
  openMetricsDrawer: () => set({ metricsDrawerOpen: true }),
  closeMetricsDrawer: () => set({ metricsDrawerOpen: false }),
}));

export const useOrderStore = create<OrderState>()(
  persist(
    (set) => ({
      lastOrder: null,
      setLastOrder: (order) => set({ lastOrder: order }),
    }),
    { name: "im-order", storage: createJSONStorage(() => localStorage) }
  )
);
