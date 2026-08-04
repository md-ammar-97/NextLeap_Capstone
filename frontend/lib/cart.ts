import { getSkuById } from "./catalog";
import type { CartLine } from "./store";

export interface CartTotals {
  item_total: number;
  handling: number;
  delivery: number;
  gst_sim: number;
  to_pay: number;
}

const HANDLING = 2;
const DELIVERY = 0;

/** Totals are always derived from current catalog prices, never trusted
 * from stored state (docs/edgecases.md #21). */
export function computeTotals(lines: CartLine[]): CartTotals {
  const item_total = lines.reduce((sum, l) => {
    const sku = getSkuById(l.sku_id);
    return sum + (sku ? sku.price * l.qty : 0);
  }, 0);
  const gst_sim = Math.round(0.05 * HANDLING);
  const to_pay = item_total + HANDLING + DELIVERY + gst_sim;
  return { item_total, handling: HANDLING, delivery: DELIVERY, gst_sim, to_pay };
}

export function generateLocalOrderId(): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `IM-LOCAL-${rand}`;
}

export function generateOrderId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `IM-${y}${m}${d}-${rand}`;
}
