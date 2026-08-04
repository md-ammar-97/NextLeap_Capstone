import { PlaceholderTile } from "./PlaceholderTile";

/** Renders the fetched stock photo (scripts/fetch_images.py) when a SKU has
 * one, falling back to the category-tinted PlaceholderTile otherwise —
 * drop-in replacement for direct PlaceholderTile usage, same categoryId +
 * className props, so every call site just adds `image` + `alt`. */
export function ProductImage({
  image,
  categoryId,
  alt,
  className = "",
}: {
  image?: string | null;
  categoryId: string;
  alt: string;
  className?: string;
}) {
  if (!image) {
    return <PlaceholderTile categoryId={categoryId} className={className} />;
  }
  return <img src={image} alt={alt} loading="lazy" className={`object-cover ${className}`} />;
}
