import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma, withRetry } from "@lib/prisma";
import { supabaseAdmin } from "@lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getUserId(req: Request) {
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
  const mode = url.searchParams.get("mode") || "orphans";
  const confirm = url.searchParams.get("confirm") === "1";

  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (mode !== "orphans") {
    return NextResponse.json({ error: "Unsupported mode" }, { status: 400 });
  }

  // Preview count
  try {
    const count = await withRetry(() => prisma.listing.count({ where: { userId: null as any } })) as number;
    if (!confirm) {
      return NextResponse.json({ mode, preview: true, count });
    }
    const res = await withRetry(() => prisma.listing.updateMany({
      where: { userId: null as any },
      data: { userId }
    })) as any;
    const migrated = res?.count ?? 0;
    return NextResponse.json({ mode, migrated });
  } catch (err: any) {
    // Fallback to Supabase
    try {
      const { count, error: cErr } = await supabaseAdmin
        .from("Listing")
        .select("id", { count: "exact", head: true })
        .is("userId", null);
      if (cErr) throw cErr;
      if (!confirm) {
        return NextResponse.json({ mode, preview: true, count: count || 0 });
      }
      const { data, error } = await supabaseAdmin
        .from("Listing")
        .update({ userId })
        .is("userId", null)
        .select("id");
      if (error) throw error;
      return NextResponse.json({ mode, migrated: data?.length || 0 });
    } catch (e: any) {
      return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
    }
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const mode = body?.mode || "orphans";
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (mode !== "orphans") {
    return NextResponse.json({ error: "Unsupported mode" }, { status: 400 });
  }

  try {
    const res = await withRetry(() => prisma.listing.updateMany({
      where: { userId: null as any },
      data: { userId }
    })) as any;
    const migrated = res?.count ?? 0;
    return NextResponse.json({ mode, migrated });
  } catch (err: any) {
    try {
      const { data, error } = await supabaseAdmin
        .from("Listing")
        .update({ userId })
        .is("userId", null)
        .select("id");
      if (error) throw error;
      return NextResponse.json({ mode, migrated: data?.length || 0 });
    } catch (e: any) {
      return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
    }
  }
}
