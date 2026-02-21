import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma, withRetry } from "@lib/prisma";
import { supabaseAdmin } from "@lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function currentUserId(req: Request) {
  const cookieStore = await cookies();
  let token = cookieStore.get("sb-access-token")?.value;
  if (!token) {
    const h = req.headers.get("authorization") || "";
    const m = h.match(/^Bearer\\s+(.+)$/i);
    token = m?.[1];
  }
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user?.id || null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || "";
  const confirm = url.searchParams.get("confirm") === "1";
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const userId = await currentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only allow this in non-production environments for safety
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not allowed in production" }, { status: 403 });
  }

  try {
    let listing: any = await withRetry(() => prisma.listing.findFirst({ where: { slug } })) as any;
    if (!listing) {
      // Try Supabase fallback
      const { data, error } = await supabaseAdmin
        .from("Listing")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      listing = data || null;
    }
    if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!confirm) {
      return NextResponse.json({ preview: true, listing: { id: listing.id, userId: listing.userId ?? null } });
    }

    if (listing.userId === userId) {
      return NextResponse.json({ ok: true, message: "Already assigned to you" });
    }

    // If it belongs to someone else, allow reassignment only in dev
    let updated = 0;
    try {
      const res = await withRetry(() => prisma.listing.updateMany({
        where: { id: listing.id },
        data: { userId }
      })) as any;
      updated = res?.count ?? 0;
    } catch {
      const { data, error } = await supabaseAdmin
        .from("Listing")
        .update({ userId })
        .eq("id", listing.id)
        .select("id");
      if (error) throw error;
      updated = data?.length || 0;
    }
    return NextResponse.json({ ok: true, updated });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
