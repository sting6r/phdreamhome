import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { safeUrl, anon } from "@lib/supabase";
import { prisma, withRetry } from "@lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  // Default to /dashboard if next is missing or is just the root, to ensure we land on the correct path
  let next = url.searchParams.get("next") || "/dashboard";
  if (next === "/") next = "/dashboard";

  if (!code) return NextResponse.redirect(new URL("/4120626", req.url));

  const cookieStore = await cookies();
  
  // Create the redirect URL
  let origin = url.origin;
  const host = req.headers.get("host") || "";
  
  // Force production domain in production environment or if accessing via the domain
  if (process.env.NODE_ENV === "production" || host.includes("phdreamhome.com")) {
    origin = "https://www.phdreamhome.com";
  }
  
  const redirectTo = next.startsWith('http') ? next : `${origin}${next}`;
  const response = NextResponse.redirect(redirectTo);

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
  
  // Log configuration (masked) to debug "Invalid API key" error
  /* console.log("Supabase Auth Config Check:", {
    url: safeUrl,
    hasAnonKey: !!anon,
    anonKeyPrefix: anon ? `${anon.slice(0, 10)}...` : "MISSING",
    isFallback: anon?.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXRzbWltYWVobG1ydmhyYmRh")
  }); */

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  
  if (error || !data.session) {
    console.error("OAuth exchange error:", error?.message || "No session found");
    return NextResponse.redirect(new URL(`/4120626?error=${encodeURIComponent(error?.message || "Auth failed")}`, req.url));
  }

  // Sync user with Railway database (Prisma)
  try {
    const user = data.session.user;
    if (user && user.email) {
      await withRetry(() => 
        prisma.user.upsert({
          where: { id: user.id },
          update: {
            email: user.email,
            name: user.user_metadata?.full_name || user.user_metadata?.name || undefined,
          },
          create: {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.user_metadata?.name || undefined,
          }
        })
      );
    }
  } catch (syncError) {
    console.error("Failed to sync OAuth user to Railway DB after retries:", syncError);
  }

  // Set the custom cookies used by the rest of the application (Legacy Support)
  const isProd = process.env.NODE_ENV === "production";
  response.cookies.set("sb-access-token", data.session.access_token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 604800,
    secure: isProd
  });
  
  if (data.session.refresh_token) {
    response.cookies.set("sb-refresh-token", data.session.refresh_token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 604800,
      secure: isProd
    });
  }
  
  return response;
}
