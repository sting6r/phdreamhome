/**
 * Returns a proxy URL for images that might fail in Next.js Image Optimization
 * (like signed Supabase URLs or external URLs with complex parameters)
 */
export function getProxyImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  
  // If it's a Supabase URL or absolute external URL, use our proxy
  // This bypasses Next.js image optimization timeout/failure issues
  return `/api/image/proxy?path=${encodeURIComponent(url)}`;
}
