import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@lib/prisma";
import { supabaseAdmin, bucketBlogImages, bucketBlogVideos, createSignedUrl, parseBucketSpec } from "@lib/supabase";
export const runtime = "nodejs";

async function exists(bucketName: string, objectPath: string): Promise<boolean> {
  try {
    const dl = await supabaseAdmin.storage.from(bucketName).download(objectPath);
    if (dl.data) return true;
  } catch {}
  try {
    const { data } = supabaseAdmin.storage.from(bucketName).getPublicUrl(objectPath);
    const url = data.publicUrl || null;
    if (url) {
      const r = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (r.ok) return true;
    }
  } catch {}
  try {
    const url = await createSignedUrl(`${bucketName}:${objectPath}`);
    if (url) {
      const r = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (r.ok) return true;
    }
  } catch {}
  return false;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const blogId = url.searchParams.get("blogId") || undefined;
  const cookieStore = await cookies();
  let token = cookieStore.get("sb-access-token")?.value;
  if (!token) {
    const h = req.headers.get("authorization") || "";
    const m = h.match(/^Bearer\s+(.+)$/i);
    token = m?.[1] || undefined;
  }
  let userId: string | null = null;
  if (token) {
    const { data } = await supabaseAdmin.auth.getUser(token);
    userId = data.user?.id || null;
  }
  if (!userId && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const where = blogId ? { id: blogId } : (userId ? { userId } : {});
  const blogs = await prisma.blogPost.findMany({ where, include: { media: true } });
  const results: Array<{
    blogId: string;
    title: string;
    coverPath: string | null;
    coverBucketMatch: boolean | null;
    coverExists: boolean | null;
    media: Array<{ id: string; path: string; bucketName: string; objectPath: string; type: string; bucketMatch: boolean; exists: boolean }>;
  }> = [];
  for (const b of blogs) {
    let coverBucketMatch: boolean | null = null;
    let coverExists: boolean | null = null;
    if (b.coverPath) {
      const { bucketName, objectPath } = parseBucketSpec(b.coverPath);
      coverBucketMatch = bucketName === bucketBlogImages;
      coverExists = await exists(bucketName, objectPath);
    }
    const media = await Promise.all(b.media.map(async (m) => {
      const { bucketName, objectPath } = parseBucketSpec(m.path);
      const isVideo = (String(m.type || "")).toLowerCase() === "video" || /\.(mp4|webm|ogg)$/i.test(objectPath);
      const bucketMatch = isVideo ? bucketName === bucketBlogVideos : bucketName === bucketBlogImages;
      const ok = await exists(bucketName, objectPath);
      return { id: m.id, path: m.path, bucketName, objectPath, type: m.type, bucketMatch, exists: ok };
    }));
    results.push({ blogId: b.id, title: b.title, coverPath: b.coverPath ?? null, coverBucketMatch, coverExists, media });
  }
  const summary = results.reduce((acc, r) => {
    const total = r.media.length;
    const mismatched = r.media.filter(x => !x.bucketMatch).length + (r.coverBucketMatch === false ? 1 : 0);
    const missing = r.media.filter(x => !x.exists).length + (r.coverExists === false ? 1 : 0);
    acc.totalMedia += total;
    acc.mismatched += mismatched;
    acc.missing += missing;
    return acc;
  }, { totalMedia: 0, mismatched: 0, missing: 0 });
  return NextResponse.json({ summary, results });
}

