import catalogData from "./catalog-data.json";

export type TrustFactType =
  | "expiry"
  | "ingredient"
  | "authenticity"
  | "freshness"
  | "sourcing"
  | "compatibility"
  | "warranty"
  | "return"
  | "quantity";

export type RiskTier = "low" | "medium" | "high";

export interface Category {
  category_id: string;
  name: string;
  icon: string;
  risk_tier: RiskTier;
  trust_template: TrustFactType[];
}

export interface CatalogTrustFact {
  fact_id: string;
  type: TrustFactType;
  label: string;
}

export interface Deal {
  label: string;
  lowest_30d: boolean;
}

export interface AnchorPrice {
  retailer: string;
  price: number;
}

export interface Sku {
  sku_id: string;
  name: string;
  category_id: string;
  unit: string;
  price: number;
  mrp: number;
  veg: boolean;
  image: string | null;
  tags: string[];
  description: string;
  trust_facts: CatalogTrustFact[];
  out_of_stock: boolean;
  complements: string[];
  anchor_price?: AnchorPrice;
  deal?: Deal;
}

interface CatalogFile {
  categories: Category[];
  skus: Sku[];
}

const catalog = catalogData as CatalogFile;

export const CATEGORIES: Category[] = catalog.categories;
export const SKUS: Sku[] = catalog.skus;

const skuIndex = new Map<string, Sku>(SKUS.map((s) => [s.sku_id, s]));
const categoryIndex = new Map<string, Category>(CATEGORIES.map((c) => [c.category_id, c]));

export function getSkuById(skuId: string): Sku | undefined {
  return skuIndex.get(skuId);
}

export function getCategoryById(categoryId: string): Category | undefined {
  return categoryIndex.get(categoryId);
}

export function getSkusByCategory(categoryId: string): Sku[] {
  return SKUS.filter((s) => s.category_id === categoryId);
}

export function discountPct(sku: Sku): number {
  if (sku.mrp <= sku.price) return 0;
  return Math.round(((sku.mrp - sku.price) / sku.mrp) * 100);
}

export function searchSkus(query: string): Sku[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SKUS.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q)) ||
      s.category_id.toLowerCase().includes(q)
  );
}
