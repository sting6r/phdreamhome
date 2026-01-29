import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("sb-access-token")?.value;
  const { pathname } = req.nextUrl;

  const isAuthenticated = !!token;

  const isProtectedRoute = pathname.startsWith("/dashboard");
  

  if (isProtectedRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL("/4120626", req.url));
  }

  

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
