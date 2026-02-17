import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";

import { withoutTenantScope } from "@/lib/db";
import "@/lib/env"; // Ensure env validation runs at startup
import { logger } from "@/lib/logger";

// Extend Auth.js types to include accountId in session
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      accountId: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

const prisma = withoutTenantScope();

const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
    maxAge: 24 * 60 * 60, // 24 hours inactivity expiry (NFR12)
    // updateAge controls how often auth() extends the session expiry.
    // Default equals maxAge (24h), meaning sessions are never extended before expiry.
    // Setting to 1 hour means: if user is active, session expiry resets to NOW+24h
    // every hour. Session only expires after 24h of TRUE inactivity (AC5).
    updateAge: 60 * 60, // 1 hour — extend session expiry on activity
  },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;

        // Fetch accountId for tenant isolation in middleware and API routes.
        // If accountId cannot be resolved, the session is invalidated to
        // prevent broken tenant-scoped operations downstream.
        let accountId: string | null = null;

        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { accountId: true },
          });

          accountId = dbUser?.accountId ?? null;
        } catch (error) {
          logger.error("Failed to fetch accountId in session callback", {
            userId: user.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        if (!accountId) {
          // accountId is required for tenant isolation. Without it, all
          // tenant-scoped DB queries will fail. Invalidate the session by
          // clearing user data — this forces the user to re-authenticate.
          logger.warn("Session invalidated: accountId not found for user", {
            userId: user.id,
          });
          session.user = null as unknown as typeof session.user;
          return session;
        }

        session.user.accountId = accountId;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
