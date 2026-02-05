import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma, withRetry } from "@lib/prisma";
import { supabaseAdmin, parseBucketSpec } from "@lib/supabase";
export const runtime = "nodejs";

const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));

export async function POST(req: Request) {
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
  const { path, imageId, listingId } = body as { path: string; imageId?: string; listingId?: string };
  if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 });
  try {
    if (imageId) {
      const img = await prisma.listingImage.findUnique({ where: { id: imageId }, include: { listing: true } });
      if (!img || img.listing.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    } else if (listingId) {
      const lst = await prisma.listing.findUnique({ where: { id: listingId } });
      if (!lst || lst.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { bucketName, objectPath } = parseBucketSpec(path);
    await supabaseAdmin.storage.from(bucketName).remove([objectPath]);
    if (imageId) {
      await Promise.race([
        withRetry(() => prisma.listingImage.delete({ where: { id: imageId } })),
        timeout(5000)
      ]);
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
