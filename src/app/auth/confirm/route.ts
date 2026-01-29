import { NextResponse } from "next/server";
import { supabasePublic } from "@lib/supabase";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp = url.searchParams;
  const token_hash = sp.get("token_hash");
  const type = sp.get("type") || undefined;
  const next = sp.get("next");
  const nextPath = next && next.startsWith("/") ? next : "/update-password";

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL("/4120626", req.url));
  }

  const { data } = await (supabasePublic.auth as any).verifyOtp({ type, token_hash });

  const res = NextResponse.redirect(new URL(nextPath, req.url));
  if (data?.session) {
    res.cookies.set("sb-access-token", data.session.access_token, { path: "/", httpOnly: true });
    res.cookies.set("sb-refresh-token", data.session.refresh_token, { path: "/", httpOnly: true });
  }
  return res;
}
