import { NextResponse } from "next/server";
import { prisma, withRetry } from "@lib/prisma";
import { cookies } from "next/headers";
import { supabaseAdmin, createSignedUrl } from "@lib/supabase";
export const runtime = "nodejs";

const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
  const kwRaw: unknown = (body as any)?.seoKeyword ?? (body as any)?.seoKeywords;
  const keywords = Array.isArray(kwRaw) ? kwRaw : typeof kwRaw === "string" ? kwRaw.split(",") : [];
  const seoKeywords = Array.from(new Set(keywords.map((s: string) => (s || "").trim().toLowerCase()).filter(Boolean)));
  try {
    await Promise.race([
      withRetry(() => prisma.listing.update({
        where: { id, userId },
        data: {
          title: body.title,
          description: body.description,
          seoTitle: body.seoTitle ?? undefined,
          seoDescription: body.seoDescription ?? undefined,
          seoKeywords,
          price: body.price,
          address: body.address,
          city: body.city,
          state: body.state,
          country: body.country,
          bedrooms: body.bedrooms,
          bathrooms: body.bathrooms,
          floorArea: body.floorArea ?? null,
          lotArea: body.lotArea ?? null,
          parking: body.parking,
          indoorFeatures: body.indoorFeatures,
          outdoorFeatures: body.outdoorFeatures,
          landmarks: body.landmarks,
          owner: body.owner,
          developer: body.developer,
          status: body.status,
          type: body.type,
          industrySubtype: body.industrySubtype ?? null,
          commercialSubtype: body.commercialSubtype ?? null,
          published: body.published,
          featured: body.featured,
          featuredPreselling: body.featuredPreselling,
          ...(Array.isArray(body.images) ? {
            images: {
              deleteMany: { listingId: id },
              ...(body.images.length ? { create: (body.images as string[]).map((url: string, i: number) => ({ url, sortOrder: i })) } : {})
            }
          } : {})
        }
      })),
      timeout(5000)
    ]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Database error", details: String(err?.message ?? err) }, { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
  
  const listing = await Promise.race([
    withRetry(() => prisma.listing.findUnique({
      where: { id },
      include: { images: { orderBy: { sortOrder: "asc" } } }
    })),
    timeout(5000)
  ]) as any;
  
  if (!listing || listing.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const images = await Promise.all(listing.images.map(async (img: any) => ({
    id: img.id,
    path: img.url,
    url: (await createSignedUrl(img.url)) ?? ""
  })));
  return NextResponse.json({ listing: { ...listing, images } });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
  try {
    await Promise.race([
      withRetry(() => prisma.listing.delete({ where: { id, userId } })),
      timeout(5000)
    ]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Database error", details: String(err?.message ?? err) }, { status: 500 });
  }
}
