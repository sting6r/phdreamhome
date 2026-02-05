import { NextResponse } from "next/server";
import { supabaseAdmin, safeUrl, anon } from "@lib/supabase";
import { createServerSideClient } from "@lib/supabase-server";
import { prisma, withRetry } from "@lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/dashboard";
  if (!code) return NextResponse.redirect(new URL("/4120626", req.url));

  const supabase = await createServerSideClient();
  
  // Log configuration (masked) to debug "Invalid API key" error
  console.log("Supabase Auth Config Check:", {
    url: safeUrl,
    hasAnonKey: !!anon,
    anonKeyPrefix: anon ? `${anon.slice(0, 10)}...` : "MISSING",
    isFallback: anon?.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXRzbWltYWVobG1ydmhyYmRh")
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const redirect = new URL(next, req.url);
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
            image: user.user_metadata?.avatar_url || undefined,
          },
          create: {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.user_metadata?.name || undefined,
            image: user.user_metadata?.avatar_url || undefined,
          }
        })
      );
      console.log("Successfully synced OAuth user to Railway DB:", user.id);
    }
  } catch (syncError) {
    console.error("Failed to sync OAuth user to Railway DB after retries:", syncError);
    // We don't block the login if sync fails, but we log it.
  }

  const res = NextResponse.redirect(redirect);
  res.cookies.set("sb-access-token", data.session.access_token, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  res.cookies.set("sb-refresh-token", data.session.refresh_token, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return res;
}
