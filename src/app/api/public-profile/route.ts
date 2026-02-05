import { NextResponse } from "next/server";
import { prisma, withRetry } from "@lib/prisma";
import { createSignedUrl, supabaseAdmin } from "@lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  try {
    let user: any = null;
    let totalListings = 0;

    try {
      const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));
      
      // Simpler Prisma query: just get the first user with an image if possible, or any user
      user = await Promise.race([
        (async () => {
          return await withRetry(() => prisma.user.findFirst({ 
            select: {
              id: true, name: true, username: true, email: true, address: true, 
              phone: true, image: true, emailVerified: true, role: true, 
              licenseNo: true, dhsudAccredNo: true, youtube: true
            }
          }), 1, 0);
        })(),
        timeout(4000)
      ]) as any;

      if (user) {
        totalListings = await Promise.race([
          withRetry(() => prisma.listing.count({ where: { userId: user.id } }), 1, 0),
          timeout(2000)
        ]) as number;
      }
    } catch (dbError) {
      console.error("Prisma failed in public-profile, attempting Supabase fallback:", dbError);
      
      // Try to find a user with listings first
      // Note: Supabase join filtering is a bit complex, simplest is to fetch user and check
      // But we can just fetch the first user for now to be safe as the Prisma query does fallback
      
      const { data: userData, error } = await supabaseAdmin
        .from('User')
        .select('*')
        .limit(1)
        .single();
        
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
    });
  } catch (error: any) {
    console.error("Error in public-profile API:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}
