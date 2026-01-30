import { createClient } from "@supabase/supabase-js";

function clean(v?: string) {
  if (!v) return undefined;
  const s = v.trim();
  return s.replace(/^['"`]/, "").replace(/['"`]$/, "");
}

const urlPublic = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const urlServer = clean(process.env.SUPABASE_URL);
const anon = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ?? clean(process.env.SUPABASE_ANON_KEY) ?? "placeholder-key";
const service = clean(process.env.SUPABASE_SERVICE_ROLE_KEY) ?? "placeholder-key";
export const bucket = clean(process.env.SUPABASE_BUCKET) ?? "images";
export const bucketVideos = clean(process.env.SUPABASE_BUCKET_VIDEOS) ?? "videos";
export const bucketBlogImages = clean(process.env.SUPABASE_BUCKET_BLOG_IMAGES) ?? "blog image";
export const bucketBlogVideos = clean(process.env.SUPABASE_BUCKET_BLOG_VIDEOS) ?? "blog video";

const finalUrl = urlPublic ?? urlServer;

if (!finalUrl || !finalUrl.startsWith("http")) {
  console.error("CRITICAL ERROR: Invalid SUPABASE_URL detected in environment:", finalUrl);
}

const safeUrl = finalUrl || "https://placeholder-url-missing.supabase.co";

export const supabasePublic = createClient(safeUrl, anon, { auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: true } });
export const supabaseAdmin = typeof window === "undefined"
  ? createClient(safeUrl, service, { auth: { persistSession: false } })
  : (undefined as unknown as ReturnType<typeof createClient>);

export function parseBucketSpec(p: string) {
  const i = p.indexOf(":");
  if (i > -1) {
    const b = p.slice(0, i).trim();
    const q = p.slice(i + 1).trim();
    return { bucketName: b || bucket, objectPath: q };
  }
  return { bucketName: bucket, objectPath: p };
}

export async function createSignedUrl(path: string, expires = Number(process.env.SUPABASE_SIGNED_URL_EXPIRES || 604800)) {
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
export async function createSignedUrls(paths: string[], expires = Number(process.env.SUPABASE_SIGNED_URL_EXPIRES || 604800)) {
  return Promise.all(paths.map(p => createSignedUrl(p, expires)));
}
