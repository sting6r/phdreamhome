import { NextResponse } from "next/server";
import { supabaseAdmin, safeUrl, anon } from "@lib/supabase";
import { createServerSideClient } from "@lib/supabase-server";
import { prisma, withRetry } from "@lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  // Default to /dashboard if next is missing or is just the root, to ensure we land on the correct path
  let next = url.searchParams.get("next") || "/dashboard";
  if (next === "/") next = "/dashboard";

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
  
  // Create the redirect URL
  let origin = url.origin;
  const host = req.headers.get("host") || "";
  
  // Force production domain in production environment or if accessing via the domain
  if (process.env.NODE_ENV === "production" || host.includes("phdreamhome.com")) {
    origin = "https://www.phdreamhome.com";
  }
  
  const redirectTo = next.startsWith('http') ? next : `${origin}${next}`;
  
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
      console.log("Successfully synced OAuth user to Railway DB:", user.id);
    }
  } catch (syncError) {
    console.error("Failed to sync OAuth user to Railway DB after retries:", syncError);
  }

  const res = NextResponse.redirect(redirectTo);
  
  // Note: createServerSideClient already handles setting cookies on the cookie store.
  // We don't need to manually set sb-access-token and sb-refresh-token here
  // as they are not the standard Supabase SSR cookies anyway.
  
  return res;
}
