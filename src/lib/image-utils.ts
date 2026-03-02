import { safeUrl, bucketProfile, bucketBlogImages, bucketBlogVideos } from "./supabase";

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
  
  // Handle 'images' bucket paths directly since it is a public bucket
  // This bypasses the proxy which might fail due to authentication/key issues
  if (url.startsWith("images:")) {
    const path = url.slice(7).replace(/^\/+/, ""); // remove 'images:' and leading slashes
    // Use the configured Supabase URL
    const baseUrl = safeUrl.replace(/\/+$/, "");
    return `${baseUrl}/storage/v1/object/public/images/${path}`;
  }

  // Handle profile bucket paths directly
  if (url.startsWith(`${bucketProfile}:`)) {
    const path = url.slice(bucketProfile.length + 1).replace(/^\/+/, "");
    const baseUrl = safeUrl.replace(/\/+$/, "");
    return `${baseUrl}/storage/v1/object/public/${encodeURIComponent(bucketProfile)}/${path}`;
  }

  // Handle blog images bucket paths directly
  if (url.startsWith(`${bucketBlogImages}:`)) {
    const path = url.slice(bucketBlogImages.length + 1).replace(/^\/+/, "");
    const baseUrl = safeUrl.replace(/\/+$/, "");
    return `${baseUrl}/storage/v1/object/public/${encodeURIComponent(bucketBlogImages)}/${path}`;
  }

  // Handle blog videos bucket paths directly
  if (url.startsWith(`${bucketBlogVideos}:`)) {
    const path = url.slice(bucketBlogVideos.length + 1).replace(/^\/+/, "");
    const baseUrl = safeUrl.replace(/\/+$/, "");
    return `${baseUrl}/storage/v1/object/public/${encodeURIComponent(bucketBlogVideos)}/${path}`;
  }
  
  // If it's a Supabase URL or absolute external URL, return it directly
  // We are using unoptimized={true} in Image components now, so we don't need the proxy
  return url;
}
