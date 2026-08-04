import {
  Wheat,
  Cookie,
  CupSoda,
  Milk,
  SprayCan,
  Carrot,
  Sparkles,
  Baby,
  Pill,
  PlugZap,
  Gift,
  PawPrint,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  wheat: Wheat,
  cookie: Cookie,
  "cup-soda": CupSoda,
  milk: Milk,
  "spray-can": SprayCan,
  carrot: Carrot,
  sparkles: Sparkles,
  baby: Baby,
  pill: Pill,
  "plug-zap": PlugZap,
  gift: Gift,
  "paw-print": PawPrint,
};

/** Deterministic tint per category so placeholder tiles read as distinct
 * without per-SKU image assets (docs/implementation_plan.md Pre-Flight
 * image decision). */
export const CATEGORY_TINTS: Record<string, string> = {
  staples: "#F3E7D3",
  snacks: "#FDE7CC",
  beverages: "#DCEFFB",
  dairy: "#FFF3D6",
  household: "#E3EAF3",
  fresh: "#E1F3E6",
  beauty: "#FBE4EE",
  baby: "#E9E4FB",
  pharma: "#E0F2F1",
  electronics: "#E7E9FB",
  party_gifting: "#FDE2E4",
  pet: "#EFE3D0",
};
