import { NextResponse } from "next/server";
import { supabasePublic } from "@lib/supabase";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/dashboard";
  if (!code) return NextResponse.redirect(new URL("/4120626", req.url));
  const { data, error } = await supabasePublic.auth.exchangeCodeForSession(code);
  const redirect = new URL(next, req.url);
  if (error || !data.session) return NextResponse.redirect(redirect);
  const res = NextResponse.redirect(redirect);
  res.cookies.set("sb-access-token", data.session.access_token, { path: "/", httpOnly: true });
  res.cookies.set("sb-refresh-token", data.session.refresh_token, { path: "/", httpOnly: true });
  return res;
}
