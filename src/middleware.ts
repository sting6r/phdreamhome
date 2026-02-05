import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const { pathname, search } = request.nextUrl;

  // Force www for consistency to prevent OAuth state mismatch in production
  if (process.env.NODE_ENV === "production" && 
      !host.startsWith("www.") && 
      !host.includes("localhost") && 
      !host.includes("railway.app") &&
      !host.includes("vercel.app")) {
    return NextResponse.redirect(`https://www.phdreamhome.com${pathname}${search}`, 301);
  }

  // Create an initial response
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Safe Supabase credentials with fallbacks (matching src/lib/supabase.ts)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hcytsmimaehlmrvhrbda.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXRzbWltYWVobG1ydmhyYmRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNjQ2NjAsImV4cCI6MjA3NTg0MDY2MH0.T8IJpPvv8n5j9kcRSsC9EnpxrEuAW3E1TNJUdn250Kc";

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value,
              ...options,
            })
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value: '',
              ...options,
            })
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
            response.cookies.set({
              name,
              value: '',
              ...options,
            })
          },
        },
      }
    )

    // This refreshes the session if it's expired
    const { data: { user } } = await supabase.auth.getUser()

    // Protect /dashboard and its subroutes
    if (pathname.startsWith('/dashboard')) {
      if (!user) {
        return NextResponse.redirect(new URL('/4120626', request.url))
      }
    }
  } catch (error) {
    // If Supabase initialization or getUser fails, we log it but don't crash the whole site
    console.error("Middleware Supabase Error:", error);
    if (pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/4120626', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Any file with an extension (to avoid running middleware on images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)',
  ],
}
