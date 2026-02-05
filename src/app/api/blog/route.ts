import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma, withRetry } from "@lib/prisma";
// Type safety check
import type { Prisma } from "@prisma/client";
import { supabaseAdmin, createSignedUrl } from "@lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));

type BlogMedia = { path: string; type: "image" | "video"; url: string | null; title?: string | null; subtitle?: string | null; description?: string | null };
 type BlogPost = { id: string; userId: string; title: string; description: string; author?: string | null; displayDate?: string | null; category?: string | null; coverPath: string | null; coverUrl: string | null; media: BlogMedia[]; published: boolean; featured: boolean; createdAt: number };

export async function GET(req: Request) {
  const headers = new Headers();
  headers.set("Cache-Control", "no-store");
  const url = new URL(req.url);
  const mine = url.searchParams.get("mine") === "1";
  let userId: string | null = null;
  if (mine) {
    const cookieStore = await cookies();
    let token = cookieStore.get("sb-access-token")?.value;
    if (!token) {
      const h = req.headers.get("authorization") || "";
      const m = h.match(/^Bearer\s+(.+)$/i);
      token = m?.[1] || undefined;
    }
    if (token) {
      const { data } = await supabaseAdmin.auth.getUser(token);
      userId = data.user?.id || null;
    }
    if (!userId) return new NextResponse(JSON.stringify({ blogs: [] }), { headers });
  }
  const where: Prisma.BlogPostWhereInput = mine ? { userId: userId! } : { published: true };
  let rows: any[] = [];
  try {
    rows = await Promise.race([
      withRetry(() => prisma.blogPost.findMany({
        where,
        include: { media: { orderBy: { sortOrder: "asc" } } },
        orderBy: { createdAt: "desc" }
      }), 1, 0),
      timeout(5000)
    ]) as any[];
  } catch (dbError) {
    console.error("Prisma failed, attempting Supabase fallback:", dbError);
    let query = supabaseAdmin
      .from('BlogPost')
      .select('*, media:BlogMedia(*)')
      .order('createdAt', { ascending: false });
      
    if (mine && userId) {
      query = query.eq('userId', userId);
    } else {
      query = query.eq('published', true);
    }
    
    const { data, error } = await query;
    if (error) {
      console.error("Supabase fallback failed:", error);
      // Fallback to empty list so UI doesn't crash
      rows = []; 
    } else {
      rows = data || [];
      // Sort media
      rows.forEach((row: any) => {
        if (row.media && Array.isArray(row.media)) {
          row.media.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
        }
      });
    }
  }
   const blogs: BlogPost[] = rows.map((p: any) => {
    const coverUrl = p.coverPath ? `/api/image/proxy?path=${encodeURIComponent(p.coverPath)}` : null;
    const base = mine ? p.media : p.media.filter((m:any)=> m.published);
    const media: (BlogMedia & { published?: boolean })[] = base.map((m:any) => ({
      path: m.path,
      type: (m.type as "image" | "video") || "image",
      url: `/api/image/proxy?path=${encodeURIComponent(m.path)}`,
      published: !!m.published
    }));
    return {
      id: p.id,
      userId: p.userId,
      title: p.title,
      description: p.description,
      author: p.author,
      displayDate: p.displayDate,
      category: p.category,
      coverPath: p.coverPath ?? null,
      coverUrl,
      media,
      published: !!p.published,
      featured: !!p.featured,
      createdAt: (p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt)).getTime()
    };
  });
  return new NextResponse(JSON.stringify({ blogs }), { headers });
}

export async function POST(req: Request) {
  try {
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
  const title = String(body.title || "").trim();
  const description = String(body.description || "");
  const author = typeof body.author === "string" ? body.author : null;
  const displayDate = typeof body.displayDate === "string" ? body.displayDate : null;
  const category = typeof body.category === "string" ? body.category : "Featured Projects";
    const mediaBase: { path: string; type: "image" | "video"; published?: boolean; title?: string | null; subtitle?: string | null; description?: string | null }[] = Array.isArray(body.media)
      ? body.media.map((m:any)=> ({
          path: String(m.path || m),
          type: String(m.type || ((String(m)||"").includes(":") && /\.(mp4|webm|ogg)$/i.test(String(m).split(":").pop()||String(m)) ? "video" : "image")) as any,
          published: typeof m.published === "boolean" ? m.published : true,
          title: typeof m.title === "string" ? m.title : null,
          subtitle: typeof m.subtitle === "string" ? m.subtitle : null,
          description: typeof m.description === "string" ? m.description : null
        }))
      : [];
  const publishedReq: boolean = typeof body.published === "boolean" ? body.published : true;
  const featuredReq: boolean = typeof body.featured === "boolean" ? body.featured : false;
  if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });
  const coverPath = mediaBase.find(m=>m.type === "image")?.path || null;
  const created = await Promise.race([
    withRetry(() => prisma.blogPost.create({
    data: {
      userId,
      title,
      description,
      author: author ?? undefined,
      displayDate: displayDate ?? undefined,
      category: category ?? undefined,
      coverPath: coverPath ?? undefined,
      published: publishedReq,
      featured: featuredReq,
        media: {
          create: mediaBase.map((m, i) => ({ path: m.path, type: m.type, sortOrder: i, published: typeof m.published === "boolean" ? m.published : true, title: m.title ?? undefined, subtitle: m.subtitle ?? undefined, description: m.description ?? undefined }))
        }
    },
      include: { media: { orderBy: { sortOrder: "asc" } } }
    })),
    timeout(5000)
  ]) as any;
    const coverUrl = created.coverPath ? await createSignedUrl(created.coverPath) : null;
    const media: BlogMedia[] = await Promise.all(created.media.map(async (m:any) => ({
      path: m.path,
      type: (m.type as "image" | "video") || "image",
      url: await createSignedUrl(m.path),
      title: m.title ?? null,
      subtitle: m.subtitle ?? null,
      description: m.description ?? null
    })));
    const post: BlogPost = {
      id: created.id,
      userId: created.userId,
      title: created.title,
      description: created.description,
      author: created.author,
      displayDate: created.displayDate,
      category: created.category,
      coverPath: created.coverPath ?? null,
      coverUrl,
      media,
      published: !!created.published,
      featured: !!created.featured,
      createdAt: created.createdAt.getTime()
    };
    return NextResponse.json({ ok: true, post });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
