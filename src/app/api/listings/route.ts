import { NextResponse } from "next/server";
import { prisma } from "@lib/prisma";
import { listingSchema } from "@lib/validators";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@lib/supabase";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  let token = cookieStore.get("sb-access-token")?.value;
  if (!token) {
    const h = req.headers.get("authorization") || "";
    const m = h.match(/^Bearer\s+(.+)$/i);
    token = m?.[1];
  }
  if (!token) return NextResponse.json({ listings: [] });
  const { data } = await supabaseAdmin.auth.getUser(token);
  const userId = data.user?.id;
  if (!userId) return NextResponse.json({ listings: [] });
  const listings = await prisma.listing.findMany({
    where: { userId },
    include: { images: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" }
  });
  const { createSignedUrl } = await import("@lib/supabase");
  const signedListings = await Promise.all(listings.map(async (l) => {
    const images = await Promise.all(l.images.map(async (img) => ({
      id: img.id,
      path: img.url,
      url: (await createSignedUrl(img.url)) ?? ""
    })));
    return { ...l, images };
  }));
  return NextResponse.json({ listings: signedListings });
}
export async function POST(req: Request) {
  const cookieStore = await cookies();
  let token = cookieStore.get("sb-access-token")?.value;
  if (!token) {
    const h = req.headers.get("authorization") || "";
    const m = h.match(/^Bearer\s+(.+)$/i);
    token = m?.[1];
  }
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: u } = await supabaseAdmin.auth.getUser(token);
  const userId = u.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const parsed = listingSchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`);
    return NextResponse.json({ error: "Invalid", issues }, { status: 400 });
  }
  const data = parsed.data;
  const kwRaw: unknown = (body as any)?.seoKeyword ?? (body as any)?.seoKeywords ?? (data as any)?.seoKeyword;
  const keywords = Array.isArray(kwRaw) ? kwRaw : typeof kwRaw === "string" ? kwRaw.split(",") : [];
  const seoKeywords = Array.from(new Set(keywords.map(s => (s || "").trim().toLowerCase()).filter(Boolean)));
  const seoTitle = typeof (body as any)?.seoTitle === "string" ? (body as any)?.seoTitle : (data as any)?.seoTitle;
  const seoDescription = typeof (body as any)?.seoDescription === "string" ? (body as any)?.seoDescription : (data as any)?.seoDescription;
  try {
    const base = data.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
    const uniq = `${base || "listing"}-${Date.now().toString(36)}`;
    const created = await prisma.listing.create({
      data: {
        userId,
        title: data.title,
        slug: uniq,
        description: data.description,
        seoTitle: (seoTitle || undefined),
        seoDescription: (seoDescription || undefined),
        seoKeywords,
        price: data.price,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        floorArea: data.floorArea ?? null,
        lotArea: data.lotArea ?? null,
        parking: data.parking ?? 0,
        indoorFeatures: data.indoorFeatures ?? [],
        outdoorFeatures: data.outdoorFeatures ?? [],
      landmarks: data.landmarks ?? [],
      owner: data.owner ?? null,
      developer: data.developer ?? null,
      status: data.status ?? "For Rent",
      type: data.type ?? "House",
      industrySubtype: data.industrySubtype ?? null,
      commercialSubtype: data.commercialSubtype ?? null,
      published: data.published ?? false,
      featured: data.featured ?? false,
      featuredPreselling: data.featuredPreselling ?? false,
      ...(data.images.length ? { images: { create: data.images.map((url, i) => ({ url, sortOrder: i })) } } : {})
      }
    });
    return NextResponse.json({ listing: created });
  } catch (err: any) {
    return NextResponse.json({ error: "Database error", details: String(err?.message ?? err) }, { status: 500 });
  }
}
