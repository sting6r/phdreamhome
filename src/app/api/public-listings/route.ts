import { NextResponse } from "next/server";
import { prisma } from "@lib/prisma";
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
    const listings = await prisma.listing.findMany({
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
    });
    const { createSignedUrl } = await import("@lib/supabase");
    const signedListings = await Promise.all(listings.map(async (l) => {
      const first = l.images[0];
      const images = first ? [{ ...first, url: (await createSignedUrl(first.url)) ?? "" }] : [];
      return { ...l, images };
    }));
    const headers = new Headers();
    headers.set("Cache-Control", "public, max-age=60");
    return new NextResponse(JSON.stringify({ listings: signedListings }), { headers });
  } catch (error: any) {
    console.error("Error in public-listings API:", error);
    return NextResponse.json({ listings: [], error: "Failed to fetch listings" }, { status: 500 });
  }
}
