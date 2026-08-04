/** Small deterministic string hash (FNV-1a). Used for cart_hash — only
 * needs to be stable and collision-unlikely for a demo-sized catalog, not
 * cryptographically secure, so we avoid a WebCrypto async round-trip. */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

export function nanoid(size = 12): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  const arr = typeof crypto !== "undefined" && crypto.getRandomValues
    ? crypto.getRandomValues(new Uint8Array(size))
    : Array.from({ length: size }, () => Math.floor(Math.random() * 256));
  for (let i = 0; i < size; i++) {
    id += alphabet[arr[i] % alphabet.length];
  }
  return id;
}
