import { NextResponse } from "next/server";
import { prisma } from "@lib/prisma";
import { cookies } from "next/headers";
import { supabaseAdmin, createSignedUrl } from "@lib/supabase";
export const runtime = "nodejs";

export async function PUT(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("sb-access-token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await supabaseAdmin.auth.getUser(token);
  const userId = data.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (body.username) {
    const exists = await prisma.user.findFirst({
      where: { username: body.username, NOT: { id: userId } }
    });
    if (exists) return NextResponse.json({ error: "Username taken" }, { status: 409 });
  }
  await prisma.user.update({
    where: { id: userId },
    data: { name: body.name ?? undefined, username: body.username ?? undefined, image: body.image ?? undefined, address: body.address ?? undefined, phone: body.phone ?? undefined, role: body.role ?? undefined, licenseNo: body.licenseNo ?? undefined, dhsudAccredNo: body.dhsudAccredNo ?? undefined, facebook: body.facebook ?? undefined, whatsapp: body.whatsapp ?? undefined, viber: body.viber ?? undefined, instagram: body.instagram ?? undefined, telegram: body.telegram ?? undefined, youtube: body.youtube ?? undefined, twitter: body.twitter ?? undefined }
  });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("sb-access-token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await supabaseAdmin.auth.getUser(token);
  const userId = data.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const totalListings = await prisma.listing.count({ where: { userId } });
  const signed = user?.image ? await createSignedUrl(user.image) : null;
  return NextResponse.json({
    id: user?.id ?? null,
    name: user?.name ?? "",
    username: user?.username ?? "",
    email: user?.email ?? (data.user?.email ?? ""),
    address: user?.address ?? "",
    phone: user?.phone ?? "",
    image: user?.image ?? "",
    imageUrl: signed ?? null,
    verified: Boolean(user?.emailVerified ?? null),
    totalListings,
    role: user?.role ?? "",
    licenseNo: user?.licenseNo ?? "",
    dhsudAccredNo: user?.dhsudAccredNo ?? "",
    facebook: user?.facebook ?? "",
    whatsapp: user?.whatsapp ?? "",
    viber: user?.viber ?? "",
    instagram: user?.instagram ?? "",
    telegram: user?.telegram ?? "",
    youtube: user?.youtube ?? "",
    twitter: user?.twitter ?? ""
  });
}
