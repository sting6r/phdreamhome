import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { safeUrl, anon } from '@/lib/supabase'

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const { pathname, search } = request.nextUrl;

  // Skip middleware for static assets and public files to avoid net::ERR_ABORTED
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') || // matches images, icons, manifests, etc.
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Force www for consistency to prevent OAuth state mismatch in production
  if ((process.env.NODE_ENV === "production" || host.includes("phdreamhome.com")) && 
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

  try {
    const supabase = createServerClient(
      safeUrl,
      anon,
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
        cookieOptions: {
          name: 'sb-phdreamhome-auth-token',
        },
      }
    )

    // This refreshes the session if it's expired
    const { data: { user } } = await supabase.auth.getUser()

    // Protect /dashboard and its subroutes
    if (pathname.startsWith('/dashboard')) {
      if (!user) {
        const redirectResponse = NextResponse.redirect(new URL('/4120626', request.url))
        // Copy all cookies from the updated response object to the redirect response
        // This ensures that any session refresh cookies are preserved
        response.cookies.getAll().forEach(cookie => {
          redirectResponse.cookies.set(cookie)
        })
        return redirectResponse
      }
    }
  } catch (error) {
    // If Supabase initialization or getUser fails, we log it but don't crash the whole site
    console.error("Middleware Supabase Error:", error);
    if (pathname.startsWith('/dashboard')) {
      const redirectResponse = NextResponse.redirect(new URL('/4120626', request.url))
      // Even on error, try to preserve whatever cookies we might have
      response.cookies.getAll().forEach(cookie => {
        redirectResponse.cookies.set(cookie)
      })
      return redirectResponse
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
