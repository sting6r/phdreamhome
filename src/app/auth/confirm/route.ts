import { NextResponse } from "next/server";
import { createServerSideClient } from "@lib/supabase-server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp = url.searchParams;
  const token_hash = sp.get("token_hash");
  const type = sp.get("type") as any || undefined;
  const next = sp.get("next");
  const nextPath = next && next.startsWith("/") ? next : "/update-password";

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL("/4120626", req.url));
  }

  const supabase = await createServerSideClient();
  const { data } = await supabase.auth.verifyOtp({ type, token_hash });

  const res = NextResponse.redirect(new URL(nextPath, req.url));
  if (data?.session) {
    res.cookies.set("sb-access-token", data.session.access_token, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    res.cookies.set("sb-refresh-token", data.session.refresh_token, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  }
  return res;
}
