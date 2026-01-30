import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const { pathname, search } = req.nextUrl;

  // Optional: Redirect www to non-www for SEO and consistency
  if (host.startsWith("www.")) {
    const newHost = host.replace("www.", "");
    return NextResponse.redirect(`https://${newHost}${pathname}${search}`, 301);
  }

  const token = req.cookies.get("sb-access-token")?.value;

  const isAuthenticated = !!token;

  const isProtectedRoute = pathname.startsWith("/dashboard");
  

  if (isProtectedRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL("/4120626", req.url));
  }

  

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
