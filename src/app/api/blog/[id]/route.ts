import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma, withRetry } from "@lib/prisma";
import type { Prisma } from "@prisma/client";
import { supabaseAdmin, createSignedUrl, parseBucketSpec } from "@lib/supabase";

export const runtime = "nodejs";

const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));

type BlogMedia = { path: string; type: "image" | "video"; url: string | null; title?: string | null; subtitle?: string | null; description?: string | null };

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idOrSlug } = await params;
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
  function toSlug(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  let post = await Promise.race([
    withRetry(() => prisma.blogPost.findUnique({ where: { id: idOrSlug }, include: { media: { orderBy: { sortOrder: "asc" } } } })),
    timeout(5000)
  ]) as any;

  if (!post) {
    const candidates = await Promise.race([
      withRetry(() => prisma.blogPost.findMany({ where: { published: true }, include: { media: { orderBy: { sortOrder: "asc" } } } })),
      timeout(5000)
    ]) as any[];
    post = candidates.find(p => toSlug(p.title) === idOrSlug) || null;
  }
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!post.published && post.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const coverUrl = post.coverPath ? `/api/image/proxy?path=${encodeURIComponent(post.coverPath)}` : null;
  const base = post.userId === userId ? post.media : post.media.filter((m:any)=> m.published);
  const media: (BlogMedia & { published?: boolean })[] = base.map((m:any) => ({
    path: m.path,
    type: (m.type as any) || "image",
    url: `/api/image/proxy?path=${encodeURIComponent(m.path)}`,
    published: !!m.published,
    title: m.title ?? null,
    subtitle: m.subtitle ?? null,
    description: m.description ?? null
  }));
  const headers = new Headers();
  headers.set("Cache-Control", "no-store");
  return new NextResponse(JSON.stringify({ post: { id: post.id, userId: post.userId, title: post.title, description: post.description, author: post.author, displayDate: post.displayDate, category: post.category, coverPath: post.coverPath ?? null, coverUrl, media, published: post.published, featured: post.featured, createdAt: post.createdAt } }), { headers });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  let token = cookieStore.get("sb-access-token")?.value;
  if (!token) {
    const h = req.headers.get("authorization") || "";
    const m = h.match(/^Bearer\s+(.+)$/i);
    token = m?.[1] || undefined;
  }
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await supabaseAdmin.auth.getUser(token);
  const userId = data.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const title = body.title as string | undefined;
  const description = body.description as string | undefined;
  const author = body.author as string | undefined;
  const displayDate = body.displayDate as string | undefined;
  const category = body.category as string | undefined;
  const published = body.published as boolean | undefined;
  const featured = body.featured as boolean | undefined;
  const media = Array.isArray(body.media) ? body.media as Array<{ path: string; type: string; published?: boolean; sortOrder?: number; title?: string | null; subtitle?: string | null; description?: string | null }> : undefined;
  const existing = await prisma.blogPost.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const coverPath = media && media.length ? (media.find(m=>String(m.type).toLowerCase()==="image")?.path ?? null) : null;
  if (typeof featured === "boolean" && featured === true) {
    await Promise.race([
      withRetry(() => prisma.blogPost.updateMany({ where: { userId, id: { not: id } }, data: { featured: false } })),
      timeout(5000)
    ]);
  }
  await Promise.race([
    withRetry(() => prisma.blogPost.update({
      where: { id, userId },
      data: {
        title: title ?? undefined,
        description: description ?? undefined,
        author: author !== undefined ? author : undefined,
        displayDate: displayDate !== undefined ? displayDate : undefined,
        category: category !== undefined ? category : undefined,
        coverPath: coverPath ?? undefined,
        published: typeof published === "boolean" ? published : undefined,
        featured: typeof featured === "boolean" ? featured : undefined,
        ...(media ? {
          media: {
            deleteMany: { blogId: id },
            ...(media.length ? { create: media.map((m, i) => ({ path: String(m.path), type: String(m.type), sortOrder: typeof m.sortOrder === "number" ? m.sortOrder! : i, published: typeof m.published === "boolean" ? m.published! : true, title: (m.title ?? undefined) as any, subtitle: (m.subtitle ?? undefined) as any, description: (m.description ?? undefined) as any })) } : {})
          }
        } : {})
      }
    })),
    timeout(5000)
  ]);
  const updated = await Promise.race([
    withRetry(() => prisma.blogPost.findUnique({ where: { id }, include: { media: { orderBy: { sortOrder: "asc" } } } })),
    timeout(5000)
  ]) as any;
  const coverUrl = updated?.coverPath ? `/api/image/proxy?path=${encodeURIComponent(updated.coverPath)}` : null;
  const signedMedia: (BlogMedia & { published?: boolean })[] = (updated?.media ?? []).map((m:any) => ({
    path: m.path,
    type: (m.type as any) || "image",
    url: `/api/image/proxy?path=${encodeURIComponent(m.path)}`,
    published: !!m.published,
    title: m.title ?? null,
    subtitle: m.subtitle ?? null,
    description: m.description ?? null
  }));
  return NextResponse.json({ ok: true, post: { id: updated?.id, userId: updated?.userId, title: updated?.title, description: updated?.description, author: updated?.author, displayDate: updated?.displayDate, category: updated?.category, coverPath: updated?.coverPath ?? null, coverUrl, media: signedMedia, published: updated?.published, featured: updated?.featured, createdAt: updated?.createdAt } });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  let token = cookieStore.get("sb-access-token")?.value;
  if (!token) {
    const h = req.headers.get("authorization") || "";
    const m = h.match(/^Bearer\s+(.+)$/i);
    token = m?.[1] || undefined;
  }
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await supabaseAdmin.auth.getUser(token);
  const userId = data.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const post = await withRetry(() => prisma.blogPost.findUnique({ where: { id }, include: { media: true } }));
  if (!post || post.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const paths: string[] = [];
  if (post.coverPath) paths.push(post.coverPath);
  for (const m of post.media) paths.push(m.path);
  for (const p of paths) {
    const { bucketName, objectPath } = parseBucketSpec(p);
    await supabaseAdmin.storage.from(bucketName).remove([objectPath]);
  }
  await withRetry(() => prisma.blogMedia.deleteMany({ where: { blogId: id } }));
  await withRetry(() => prisma.blogPost.delete({ where: { id } }));
  return NextResponse.json({ ok: true });
}
