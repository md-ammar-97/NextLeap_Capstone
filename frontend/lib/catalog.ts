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

/** U1 (docs/update.md): token-AND matching, not a single-substring test —
 * a naive substring match would fail the search's own mandated demo query
 * ("micellar water" is not a contiguous substring of "Micellar Cleansing
 * Water" / tag "micellar-water"). Falls back to a whitespace-stripped
 * contiguous match only if the primary pass finds nothing, which is what
 * makes "garlicbread" find "Baker's Dozen Garlic Bread". */
export function searchSkus(query: string): Sku[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  const qNoSpace = q.replace(/\s+/g, "");

  function corpusFor(sku: Sku): string {
    const category = getCategoryById(sku.category_id);
    const raw = [sku.name, sku.tags.join(" "), category?.name ?? ""].join(" ").toLowerCase();
    return `${raw} ${raw.replace(/-/g, " ")}`;
  }

  let matches = SKUS.filter((s) => {
    const corpus = corpusFor(s);
    return tokens.every((t) => corpus.includes(t));
  });

  if (matches.length === 0) {
    matches = SKUS.filter((s) => corpusFor(s).replace(/[\s-]+/g, "").includes(qNoSpace));
  }

  // Relevance tier: exact name < name contains query < tag match < category-name-only
  // match. Without this, a query that happens to substring-match a category
  // name (e.g. "atta" inside "Atta, Rice & Dal") floods results with every
  // SKU in that category instead of surfacing the actual atta SKU first.
  function tier(s: Sku): number {
    const name = s.name.toLowerCase();
    if (name === q) return 0;
    if (name.includes(q)) return 1;
    const tagsBlob = s.tags.join(" ").toLowerCase().replace(/-/g, " ");
    if (tokens.every((t) => tagsBlob.includes(t))) return 2;
    return 3;
  }

  return matches.sort((a, b) => tier(a) - tier(b));
}
