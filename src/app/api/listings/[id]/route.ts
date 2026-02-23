import { NextResponse } from "next/server";
import { prisma, withRetry } from "@lib/prisma";
import { cookies } from "next/headers";
import { supabaseAdmin, createSignedUrl, parseBucketSpec } from "@lib/supabase";
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
    console.error("Prisma update failed, attempting Supabase fallback:", err);
    // Supabase Fallback for Update
    // Note: This is complex because of the relation update (images).
    // We'll do a best-effort update of the main listing fields.
    // Handling images transactionally via REST is hard, so we might skip image updates or do them sequentially.
    
    try {
      const updateData: any = {
        title: body.title,
        description: body.description,
        seoTitle: body.seoTitle,
        seoDescription: body.seoDescription,
        seoKeywords: seoKeywords,
        price: body.price,
        address: body.address,
        city: body.city,
        state: body.state,
        country: body.country,
        bedrooms: body.bedrooms,
        bathrooms: body.bathrooms,
        floorArea: body.floorArea,
        lotArea: body.lotArea,
        parking: body.parking,
        indoorFeatures: body.indoorFeatures,
        outdoorFeatures: body.outdoorFeatures,
        landmarks: body.landmarks,
        owner: body.owner,
        developer: body.developer,
        status: body.status,
        type: body.type,
        industrySubtype: body.industrySubtype,
        commercialSubtype: body.commercialSubtype,
        published: body.published,
        featured: body.featured,
        featuredPreselling: body.featuredPreselling
      };

      // Remove undefined/nulls if needed, but Supabase handles them usually.
      // Clean up updateData
      Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

      const { error: mainError } = await supabaseAdmin
        .from('Listing')
        .update(updateData)
        .eq('id', id)
        .eq('userId', userId);

      if (mainError) throw mainError;

      // Handle images if provided
      if (Array.isArray(body.images)) {
        // Delete existing images
        await supabaseAdmin.from('ListingImage').delete().eq('listingId', id);
        
        // Insert new images
        if (body.images.length > 0) {
          const imageInserts = body.images.map((url: string, i: number) => ({
            listingId: id,
            url,
            sortOrder: i
          }));
          const { error: imgError } = await supabaseAdmin.from('ListingImage').insert(imageInserts);
          if (imgError) console.warn("Supabase fallback image update failed:", imgError);
        }
      }

      return NextResponse.json({ ok: true });

    } catch (fbError: any) {
      console.error("Supabase fallback failed:", fbError);
      return NextResponse.json({ error: "Database error", details: String(err?.message ?? err) }, { status: 500 });
    }
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
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
    
    let listing;
    try {
      listing = await Promise.race([
        withRetry(() => prisma.listing.findUnique({
          where: { id },
          include: { images: { orderBy: { sortOrder: "asc" } } }
        })),
        timeout(5000)
      ]) as any;
    } catch (dbError) {
      console.error("Prisma findUnique failed, attempting Supabase fallback:", dbError);
      // Supabase Fallback
      const { data, error } = await supabaseAdmin
        .from('Listing')
        .select('*, images:ListingImage(*)')
        .eq('id', id)
        .single();
      
      if (error || !data) {
        console.error("Supabase fallback failed or not found:", error);
        throw dbError; // Throw original error if fallback fails
      }
      
      listing = data;
      // Fix images sort
      if (listing.images && Array.isArray(listing.images)) {
        listing.images.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
      }
    }
    
    if (!listing || listing.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const images = await Promise.all(listing.images.map(async (img: any) => ({
      id: img.id,
      path: img.url,
      url: (await createSignedUrl(img.url)) ?? ""
    })));
    return NextResponse.json({ listing: { ...listing, images } });
  } catch (err: any) {
    console.error("GET Listing Error:", err);
    return NextResponse.json({ error: "Server error", details: String(err?.message ?? err) }, { status: 500 });
  }
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
    const listing = await withRetry(() => prisma.listing.findUnique({
      where: { id, userId },
      include: { images: true }
    }));

    if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Delete images from storage
    if (listing.images && listing.images.length > 0) {
      for (const img of listing.images) {
        const { bucketName, objectPath } = parseBucketSpec(img.url);
        if (bucketName && objectPath) {
          await supabaseAdmin.storage.from(bucketName).remove([objectPath]);
        }
      }
      // Delete images from DB
      await withRetry(() => prisma.listingImage.deleteMany({ where: { listingId: id } }));
    }

    await Promise.race([
      withRetry(() => prisma.listing.delete({ where: { id, userId } })),
      timeout(5000)
    ]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Database error", details: String(err?.message ?? err) }, { status: 500 });
  }
}
