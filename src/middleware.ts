import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Lightweight Edge-compatible middleware for route protection.
 *
 * Middleware runs in Edge Runtime which cannot use Node.js built-ins
 * (node:path, node:url, etc.), so we CANNOT import the Prisma-backed
 * Auth.js config here. Instead we check for the session cookie as a
 * fast guard. Full session validation (DB lookup, tenant scoping)
 * happens server-side via Auth.js with PrismaAdapter.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect dashboard routes — redirect unauthenticated users to login.
  if (pathname.startsWith("/dashboard")) {
    const sessionToken =
      request.cookies.get("authjs.session-token")?.value ||
      request.cookies.get("__Secure-authjs.session-token")?.value;

    if (!sessionToken) {
      const loginUrl = new URL("/login", request.nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
