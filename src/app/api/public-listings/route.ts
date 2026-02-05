import { NextResponse } from "next/server";
import { prisma, withRetry } from "@lib/prisma";
import { supabaseAdmin } from "@lib/supabase";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const cityParam = url.searchParams.get("city");
    const minPriceParam = url.searchParams.get("minPrice");
    const maxPriceParam = url.searchParams.get("maxPrice");
    const bedroomsParam = url.searchParams.get("bedrooms");
    const featuredParam = url.searchParams.get("featured");
    const searchStatus = statusParam === "RFO" ? "Ready for Occupancy" : statusParam || undefined;
    const minPrice = minPriceParam ? Number(minPriceParam) : undefined;
    const maxPrice = maxPriceParam ? Number(maxPriceParam) : undefined;
    const bedrooms = bedroomsParam ? Number(bedroomsParam) : undefined;
    const featured = featuredParam !== null ? featuredParam === "true" : undefined;

    let listings;
    try {
      const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));
      listings = await Promise.race([
        withRetry(() => prisma.listing.findMany({
          where: { 
            published: true,
            featured: featured !== undefined ? featured : undefined,
            status: searchStatus ? { equals: searchStatus, mode: "insensitive" } : undefined,
            city: cityParam ? { contains: cityParam, mode: "insensitive" } : undefined,
            price: minPrice !== undefined || maxPrice !== undefined ? {
              gte: minPrice !== undefined ? minPrice : undefined,
              lte: maxPrice !== undefined ? maxPrice : undefined
            } : undefined,
            bedrooms: bedrooms !== undefined ? { gte: bedrooms } : undefined
          },
          include: { images: { orderBy: { sortOrder: "asc" } } },
          orderBy: { createdAt: "desc" }
        }), 1, 0),
        timeout(3000)
      ]);
    } catch (dbError) {
      console.error("Prisma failed in public-listings, attempting Supabase fallback:", dbError);
      
      let query = supabaseAdmin
        .from('Listing')
        .select('*, images:ListingImage(*)')
        .eq('published', true)
        .order('createdAt', { ascending: false });

      if (featured !== undefined) {
        query = query.eq('featured', featured);
      }
      if (searchStatus) {
        // approximate insensitive exact match
        query = query.ilike('status', searchStatus);
      }
      if (cityParam) {
        query = query.ilike('city', `%${cityParam}%`);
      }
      if (minPrice !== undefined) {
        query = query.gte('price', minPrice);
      }
      if (maxPrice !== undefined) {
        query = query.lte('price', maxPrice);
      }
      if (bedrooms !== undefined) {
        query = query.gte('bedrooms', bedrooms);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error("Supabase fallback failed:", error);
        throw error;
      }
      
      listings = data || [];
      // Sort images manually since Supabase join order isn't guaranteed
      listings.forEach((l: any) => {
        if (l.images && Array.isArray(l.images)) {
          l.images.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
        }
      });
    }

    const { createSignedUrls } = await import("@lib/supabase");
    
    // Process images in bulk to ensure we have signed URLs efficiently
    if (listings && Array.isArray(listings)) {
      const allImages: { listingIndex: number; imageIndex: number; url: string }[] = [];
      
      listings.forEach((l: any, lIdx: number) => {
        if (l.images && Array.isArray(l.images)) {
          l.images.forEach((img: any, iIdx: number) => {
            if (img.url && !img.url.startsWith("http")) {
              allImages.push({ listingIndex: lIdx, imageIndex: iIdx, url: img.url });
            }
          });
        }
      });

      if (allImages.length > 0) {
        const paths = allImages.map(img => img.url);
        const signedUrls = await createSignedUrls(paths);
        
        allImages.forEach((imgInfo, i) => {
          if (signedUrls[i]) {
            listings[imgInfo.listingIndex].images[imgInfo.imageIndex].url = signedUrls[i];
          }
        });
      }
    }

    const headers = new Headers();
    headers.set("Cache-Control", "public, max-age=60");
    return new NextResponse(JSON.stringify({ listings: listings || [] }), { headers });
  } catch (error: any) {
    console.error("Error in public-listings API:", error);
    return NextResponse.json({ listings: [], error: "Failed to fetch listings" }, { status: 500 });
  }
}
