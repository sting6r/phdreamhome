import { createClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

function clean(v?: string) {
  if (!v) return undefined;
  const s = v.trim();
  return s.replace(/^['"`]/, "").replace(/['"`]$/, "");
}

const urlPublic = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const urlServer = clean(process.env.SUPABASE_URL);

// Robust check to prevent using a JWT/Key as a URL
function getValidUrl(url?: string) {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    // If it's a long JWT-like string instead of a short URL, it's probably a mistake
    if (url.length > 200) return undefined; 
    return url;
  }
  return undefined;
}

const finalUrl = getValidUrl(urlPublic) ?? getValidUrl(urlServer);

if (!finalUrl && process.env.NODE_ENV === "production") {
  let reason = "Variable is empty or missing";
  const rawUrl = urlPublic || urlServer;
  if (rawUrl) {
    if (!rawUrl.startsWith("http")) reason = "URL does not start with http/https";
    else if (rawUrl.length > 200) reason = "URL is too long (looks like a JWT/Token instead of a URL)";
  }
  
  // Only log if we're not in a CI/Build environment or if it's actually missing in production
  if (!process.env.CI && !process.env.RAILWAY_STATIC_URL) {
    console.warn(`Supabase URL notice: Using fallback URL. Reason: ${reason}`, {
      NEXT_PUBLIC_SUPABASE_URL: urlPublic ? (urlPublic.slice(0, 10) + "...") : "MISSING",
      SUPABASE_URL: urlServer ? (urlServer.slice(0, 10) + "...") : "MISSING",
    });
  }
}

export const safeUrl = finalUrl || "https://hcytsmimaehlmrvhrbda.supabase.co";

export const anon = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ?? 
  clean(process.env.SUPABASE_ANON_KEY) ?? 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXRzbWltYWVobG1ydmhyYmRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNjQ2NjAsImV4cCI6MjA3NTg0MDY2MH0.T8IJpPvv8n5j9kcRSsC9EnpxrEuAW3E1TNJUdn250Kc";

const service = clean(process.env.SUPABASE_SERVICE_ROLE_KEY) ?? 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXRzbWltYWVobG1ydmhyYmRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDI2NDY2MCwiZXhwIjoyMDc1ODQwNjYwfQ.EwxGACi4ptZtmABK5WH4hTK5l4GaXK9Mm-9fxCP45ik";
export const bucket = clean(process.env.SUPABASE_BUCKET) ?? "images";
export const bucketVideos = clean(process.env.SUPABASE_BUCKET_VIDEOS) ?? "videos";
export const bucketBlogImages = clean(process.env.SUPABASE_BUCKET_BLOG_IMAGES) ?? "blog image";
export const bucketBlogVideos = clean(process.env.SUPABASE_BUCKET_BLOG_VIDEOS) ?? "blog video";

// Legacy client for compatibility - try to avoid using this for auth in Next.js
// Persistence disabled to prevent conflicts with the SSR client
export const supabasePublic = createClient(safeUrl, anon, { 
  auth: { 
    persistSession: false, 
    autoRefreshToken: false, 
    detectSessionInUrl: false 
  } 
});

// Admin client for server-side operations
export const supabaseAdmin = typeof window === "undefined"
  ? createClient(safeUrl, service, { auth: { persistSession: false } })
  : (undefined as unknown as ReturnType<typeof createClient>);

// Recommended way to create clients in Next.js
let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClientSideClient() {
  if (typeof window === "undefined") return createBrowserClient(safeUrl, anon);
  if (!browserClient) {
    browserClient = createBrowserClient(safeUrl, anon);
  }
  return browserClient;
}

// Export a single instance for easier use
export const supabase = typeof window !== "undefined" ? createClientSideClient() : supabasePublic;

export function parseBucketSpec(p: string) {
  const i = p.indexOf(":");
  if (i > -1) {
    const b = p.slice(0, i).trim();
    const q = p.slice(i + 1).trim();
    return { bucketName: b || bucket, objectPath: q };
  }
  return { bucketName: bucket, objectPath: p };
}

export async function createSignedUrl(path: string, expires = Number(process.env.SUPABASE_SIGNED_URL_EXPIRES || 3600)) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  
  const { bucketName, objectPath } = parseBucketSpec(path);
  try {
    const { data } = await supabaseAdmin.storage.from(bucketName).createSignedUrl(objectPath, expires);
    if (data?.signedUrl) return data.signedUrl;
  } catch (error) {
    console.error("Error creating signed URL:", error);
  }
  try {
    const { data } = supabasePublic.storage.from(bucketName).getPublicUrl(objectPath);
    return data.publicUrl || null;
  } catch (error) {
    console.error("Error getting public URL:", error);
    return null;
  }
}
export async function createSignedUrls(paths: string[], expires = Number(process.env.SUPABASE_SIGNED_URL_EXPIRES || 3600)) {
  if (!paths.length) return [];
  
  // Group by bucket
  const byBucket: Record<string, { index: number; objectPath: string }[]> = {};
  paths.forEach((p, index) => {
    const { bucketName, objectPath } = parseBucketSpec(p);
    if (!byBucket[bucketName]) byBucket[bucketName] = [];
    byBucket[bucketName].push({ index, objectPath });
  });

  const results = new Array(paths.length).fill(null);

  await Promise.all(Object.entries(byBucket).map(async ([bucketName, items]) => {
    const objectPaths = items.map(i => i.objectPath);
    try {
      const { data, error } = await supabaseAdmin.storage.from(bucketName).createSignedUrls(objectPaths, expires);
      if (error || !data) throw error || new Error("No data returned");
      
      data.forEach((item, i) => {
        const originalIndex = items[i].index;
        if (item.signedUrl) {
          results[originalIndex] = item.signedUrl;
        } else {
          // Fallback to public URL if individual signing failed
          const { data: publicData } = supabasePublic.storage.from(bucketName).getPublicUrl(objectPaths[i]);
          results[originalIndex] = publicData.publicUrl || null;
        }
      });
    } catch (err) {
      console.error(`Error batch signing for bucket ${bucketName}:`, err);
      // Fallback all to public URL
      items.forEach(({ index, objectPath }) => {
        try {
          const { data } = supabasePublic.storage.from(bucketName).getPublicUrl(objectPath);
          results[index] = data.publicUrl || null;
        } catch {
          results[index] = null;
        }
      });
    }
  }));

  return results;
}
