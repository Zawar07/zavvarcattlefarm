/**
 * Converts a private Vercel Blob URL to a proxied URL that can be used in <img> tags.
 * Falls back to the original URL if it's not a blob URL (e.g. already a public URL).
 */
export function proxiedBlobUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Route through our authenticated proxy
  return `/api/blob-proxy?url=${encodeURIComponent(url)}`;
}
