import { NextResponse } from "next/server";
import { prisma } from "@lib/prisma";
import { createSignedUrl } from "@lib/supabase";
export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await prisma.user.findFirst({ where: { listings: { some: {} } } }) || await prisma.user.findFirst();
    if (!user) return NextResponse.json({ profile: null });
    const totalListings = await prisma.listing.count({ where: { userId: user.id } });
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
