import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { safeUrl, anon } from "@lib/supabase";

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

  const cookieStore = await cookies();
  const response = NextResponse.redirect(new URL(nextPath, req.url));

  const supabase = createServerClient(
    safeUrl,
    anon,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
      cookieOptions: {
        name: 'sb-phdreamhome-auth-token',
      },
    }
  );

  const { data } = await supabase.auth.verifyOtp({ type, token_hash });

  if (data?.session) {
    response.cookies.set("sb-access-token", data.session.access_token, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    response.cookies.set("sb-refresh-token", data.session.refresh_token, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  }
  return response;
}
