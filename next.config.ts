import type { NextConfig } from "next";

// TODO: [Future Security Hardening — Epic 2+] Add Content-Security-Policy with nonce.
// CSP with nonce requires per-request generation coordinated with Next.js
// script loading (next/script). Defer to a dedicated security hardening story.
// Track as tech debt in Epic 2 security hardening or a standalone story.

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // NOTE: These static security headers apply to ALL routes including /api/v1/*.
        // This is intentional — the headers are universally safe. CORS is a separate
        // concern: when Epic 2 implements WordPress plugin → platform communication,
        // CORS headers (Access-Control-Allow-Origin, etc.) will be added via Route
        // Handler responses or a dedicated CORS middleware, NOT via this static config.
        // Static headers and dynamic CORS headers coexist without conflict.
        // TODO: [Epic 2, Story 2-1] Verify CORS compatibility with WordPress plugin requests.
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // NOTE: DENY blocks ALL iframe embedding. If OAuth providers (Google, GitHub)
          // need iframe-based flows in the future, consider excluding /api/auth/* routes
          // or switching to SAMEORIGIN. Current auth is credentials-only — DENY is correct.
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "0",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
