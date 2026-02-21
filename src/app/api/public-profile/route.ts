import { NextResponse } from "next/server";
import { prisma, withRetry } from "@lib/prisma";
import { createSignedUrl, supabaseAdmin } from "@lib/supabase";

export const runtime = "nodejs";
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const emailParam = (url.searchParams.get("email") || "").trim();
    
    let user: any = null;
    let totalListings = 0;

    // console.log("[public-profile] Starting request processing...");

    try {
      const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));
      
      // If email query provided, fetch that specific user; otherwise pick a representative user
      try {
        // console.log("[public-profile] Attempting Prisma user fetch...");
        if (emailParam) {
          user = await Promise.race([
            (async () => {
              return await withRetry(() => prisma.user.findUnique({ 
                where: { email: emailParam },
                select: {
                  id: true, name: true, username: true, email: true, address: true, 
                  phone: true, image: true, emailVerified: true, role: true, 
                  licenseNo: true, dhsudAccredNo: true, youtube: true
                }
              }), 3, 1000);
            })(),
            timeout(15000)
          ]) as any;
        } else {
          user = await Promise.race([
            (async () => {
              // Prioritize users with both email and image (likely the main agent profile)
              // If none, fallback to any user
              let foundUser = await withRetry(() => prisma.user.findFirst({ 
                where: {
                  AND: [
                    { email: { not: null } },
                    { email: { not: '' } },
                    { image: { not: null } },
                    { image: { not: '' } }
                  ]
                },
                orderBy: { createdAt: 'desc' },
                select: {
                  id: true, name: true, username: true, email: true, address: true, 
                  phone: true, image: true, emailVerified: true, role: true, 
                  licenseNo: true, dhsudAccredNo: true, youtube: true
                }
              }), 3, 1000);

              if (!foundUser) {
                foundUser = await withRetry(() => prisma.user.findFirst({ 
                  orderBy: { createdAt: 'desc' },
                  select: {
                    id: true, name: true, username: true, email: true, address: true, 
                    phone: true, image: true, emailVerified: true, role: true, 
                    licenseNo: true, dhsudAccredNo: true, youtube: true
                  }
                }), 3, 1000);
              }
              return foundUser;
            })(),
            timeout(15000)
          ]) as any;
        }
        // console.log("[public-profile] Prisma user fetch result:", user ? "Found" : "Null");

        if (user) {
          try {
            // console.log("[public-profile] Attempting Prisma listings count...");
            totalListings = await Promise.race([
              withRetry(() => prisma.listing.count({ where: { userId: user.id } }), 1, 0),
              timeout(5000)
            ]) as number;
            // console.log("[public-profile] Prisma listings count:", totalListings);
          } catch (countErr) {
            console.warn("Prisma count failed in public-profile:", countErr);
            // Non-critical, just keep totalListings as 0 or try Supabase for count only
          }
        }
      } catch (userErr) {
        console.warn("Prisma user fetch failed in public-profile:", userErr);
        throw userErr; // Trigger Supabase fallback
      }
    } catch (dbError) {
      console.error("Prisma failed in public-profile, attempting Supabase fallback:", dbError);
      
      let userData, error;
      if (emailParam) {
        const res = await supabaseAdmin
          .from('User')
          .select('*')
          .eq('email', emailParam)
          .maybeSingle();
        userData = res.data;
        error = res.error;
      } else {
        const res = await supabaseAdmin
          .from('User')
          .select('*')
          .limit(1)
          .single();
        userData = res.data;
        error = res.error;
      }
        
      if (error) {
        console.error("Supabase fallback failed:", error);
      } else {
        user = userData;
        // Count listings
        const { count, error: countError } = await supabaseAdmin
          .from('Listing')
          .select('*', { count: 'exact', head: true })
          .eq('userId', user.id);
          
        if (!countError) {
          totalListings = count || 0;
        }
      }
    }

    if (!user) return NextResponse.json({ profile: null });
    
    const signed = user.image ? await createSignedUrl(user.image) : null;

    return NextResponse.json({
      id: user.id,
      name: user.name ?? "",
      username: user.username ?? "",
      email: user.email ?? "",
      address: user.address ?? "",
      phone: user.phone ?? "",
      image: user.image ?? "",
      imageUrl: signed ?? null,
      verified: Boolean(user.emailVerified ?? null),
      totalListings,
      role: user.role ?? "",
      licenseNo: user.licenseNo ?? "",
      dhsudAccredNo: user.dhsudAccredNo ?? "",
      youtube: user.youtube ?? ""
    }, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      }
    });
  } catch (error: any) {
    console.error("CRITICAL Error in public-profile API:", {
      message: error.message,
      stack: error.stack,
      cause: error.cause
    });
    return NextResponse.json({ error: `Failed to fetch profile: ${error.message}` }, { status: 500 });
  }
}
