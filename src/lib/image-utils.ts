import { safeUrl, bucketProfile, bucketBlogImages, bucketBlogVideos, bucketVideos } from "./supabase";

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
  
  const baseUrl = safeUrl.replace(/\/+$/, "");

  // Handle 'images' bucket paths directly since it is a public bucket
  // This bypasses the proxy which might fail due to authentication/key issues
  if (url.startsWith("images:")) {
    const path = url.slice(7).replace(/^\/+/, ""); // remove 'images:' and leading slashes
    return `${baseUrl}/storage/v1/object/public/images/${path}`;
  }

  // Handle profile bucket paths directly
  if (url.startsWith(`${bucketProfile}:`)) {
    const path = url.slice(bucketProfile.length + 1).replace(/^\/+/, "");
    const encodedBucket = encodeURIComponent(bucketProfile);
    return `${baseUrl}/storage/v1/object/public/${encodedBucket}/${path}`;
  }

  // Handle blog images bucket
  if (url.startsWith(`${bucketBlogImages}:`)) {
    const path = url.slice(bucketBlogImages.length + 1).replace(/^\/+/, "");
    const encodedBucket = encodeURIComponent(bucketBlogImages);
    return `${baseUrl}/storage/v1/object/public/${encodedBucket}/${path}`;
  }

  // Handle blog videos bucket
  if (url.startsWith(`${bucketBlogVideos}:`)) {
    const path = url.slice(bucketBlogVideos.length + 1).replace(/^\/+/, "");
    const encodedBucket = encodeURIComponent(bucketBlogVideos);
    return `${baseUrl}/storage/v1/object/public/${encodedBucket}/${path}`;
  }

  // Handle videos bucket
  if (url.startsWith(`${bucketVideos}:`)) {
    const path = url.slice(bucketVideos.length + 1).replace(/^\/+/, "");
    const encodedBucket = encodeURIComponent(bucketVideos);
    return `${baseUrl}/storage/v1/object/public/${encodedBucket}/${path}`;
  }
  
  // If it's a Supabase URL or absolute external URL, return it directly
  // We are using unoptimized={true} in Image components now, so we don't need the proxy
  return url;
}
