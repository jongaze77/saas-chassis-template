import { NextRequest } from "next/server";
import { describe, it, expect } from "vitest";

import { middleware } from "@/middleware";

/**
 * Middleware regression tests for AC3 (Dashboard Route Protection).
 *
 * Verifies that unauthenticated users are redirected from /dashboard/* routes
 * to /login, and that authenticated users (with session cookie) pass through.
 * Non-dashboard routes should always pass through regardless of auth state.
 */

function makeNextRequest(
  pathname: string,
  cookies?: Record<string, string>,
): NextRequest {
  const url = `http://localhost:3001${pathname}`;
  const req = new NextRequest(url);
  if (cookies) {
    for (const [name, value] of Object.entries(cookies)) {
      req.cookies.set(name, value);
    }
  }
  return req;
}

describe("middleware — dashboard route protection (AC3)", () => {
  describe("unauthenticated access to /dashboard", () => {
    it("redirects to /login when no session cookie is present", () => {
      const req = makeNextRequest("/dashboard");
      const res = middleware(req);

      expect(res.status).toBe(307);
      const location = new URL(res.headers.get("location")!);
      expect(location.pathname).toBe("/login");
    });

    it("sets callbackUrl query parameter to the original path", () => {
      const req = makeNextRequest("/dashboard/settings");
      const res = middleware(req);

      const location = new URL(res.headers.get("location")!);
      expect(location.searchParams.get("callbackUrl")).toBe("/dashboard/settings");
    });

    it("redirects from nested dashboard routes", () => {
      const req = makeNextRequest("/dashboard/sites/123");
      const res = middleware(req);

      expect(res.status).toBe(307);
      const location = new URL(res.headers.get("location")!);
      expect(location.pathname).toBe("/login");
      expect(location.searchParams.get("callbackUrl")).toBe("/dashboard/sites/123");
    });
  });

  describe("authenticated access to /dashboard", () => {
    it("allows through when authjs.session-token cookie is present", () => {
      const req = makeNextRequest("/dashboard", {
        "authjs.session-token": "valid-session-token",
      });
      const res = middleware(req);

      // NextResponse.next() returns 200 status
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });

    it("allows through when __Secure-authjs.session-token cookie is present", () => {
      const req = makeNextRequest("/dashboard", {
        "__Secure-authjs.session-token": "valid-session-token",
      });
      const res = middleware(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });
  });

  describe("non-dashboard routes", () => {
    it("passes through /login without redirect", () => {
      const req = makeNextRequest("/login");
      const res = middleware(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });

    it("passes through /register without redirect", () => {
      const req = makeNextRequest("/register");
      const res = middleware(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });

    it("passes through / (home) without redirect", () => {
      const req = makeNextRequest("/");
      const res = middleware(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });
  });
});
