import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma, withRetry } from "@lib/prisma";
import { supabaseAdmin, parseBucketSpec } from "@lib/supabase";
export const runtime = "nodejs";

const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));

export async function POST(req: Request) {
  const cookieStore = await cookies();
  let token = cookieStore.get("sb-access-token")?.value;
  if (!token) {
    const h = req.headers.get("authorization") || "";
    const m = h.match(/^Bearer\s+(.+)$/i);
    token = m?.[1];
  }
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await supabaseAdmin.auth.getUser(token);
  const userId = data.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { path, mediaId, blogId } = body as { path: string; mediaId?: string; blogId?: string };
  if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 });
  try {
    if (mediaId) {
      const media = await prisma.blogMedia.findUnique({ where: { id: mediaId }, include: { blog: true } });
      if (!media || media.blog.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    } else if (blogId) {
      const blog = await prisma.blogPost.findUnique({ where: { id: blogId } });
      if (!blog || blog.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { bucketName, objectPath } = parseBucketSpec(path);
    await supabaseAdmin.storage.from(bucketName).remove([objectPath]);
    if (mediaId) {
      await Promise.race([
        withRetry(() => prisma.blogMedia.delete({ where: { id: mediaId } })),
        timeout(5000)
      ]);
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
