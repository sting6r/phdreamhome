/**
 * Returns a proxy URL for images that might fail in Next.js Image Optimization
 * (like signed Supabase URLs or external URLs with complex parameters)
 */
export function getProxyImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;

  // DIRECTLY return Supabase URLs to avoid proxy overhead/failures
  // The proxy seems to be failing for valid signed URLs (likely due to headers or environment issues)
  // Next.js Image Optimization handles these fine as long as the domain is in next.config.js
  if (url.includes(".supabase.co/storage/v1/object")) {
    return url;
  }
  
  // If it's a Supabase URL or absolute external URL, use our proxy
  // This bypasses Next.js image optimization timeout/failure issues
  return `/api/image/proxy?path=${encodeURIComponent(url)}`;
}
