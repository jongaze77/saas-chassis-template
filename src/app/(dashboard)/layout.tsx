import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/shared/AppSidebar";
import { DashboardBreadcrumb } from "@/components/shared/DashboardBreadcrumb";
import { ErrorRetryButton } from "@/components/shared/ErrorRetryButton";
import { SidebarErrorBoundary } from "@/components/shared/SidebarErrorBoundary";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { featureFlags } from "@/lib/featureFlags";
import { logger } from "@/lib/logger";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await auth();
  } catch (error) {
    // If auth() throws (e.g., database connection failure), do NOT redirect to login.
    // Redirecting would create an infinite loop: middleware sees cookie → allows access →
    // layout calls auth() → throws → redirect → middleware sees cookie → ...
    // Instead, show an error state and let the user retry or the issue resolve itself.
    logger.error("Dashboard auth check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    // Render error state instead of redirecting to avoid infinite redirect loop.
    // ErrorRetryButton is a Client Component that uses window.location.reload()
    // for semantic HTML (WCAG 2.1 AA 4.1.2: button for actions, not anchor).
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground">
            Unable to verify your session. Please try refreshing the page.
          </p>
          <ErrorRetryButton />
        </div>
      </div>
    );
  }

  // NextAuth v5 auth() has two failure modes:
  // 1. Throws an error → caught by try-catch above (e.g., DB connection failure)
  // 2. Returns null → session expired or invalid (handled below)
  // This two-phase check ensures both paths have appropriate UX:
  // throws → error state with retry, null → redirect to login with expired flag.
  // Middleware already catches missing cookies — this catches expired DB sessions.
  if (!session) {
    redirect("/login?expired=true");
  }

  // Read sidebar cookie for default open state (cookie-based persistence).
  // When no cookie exists (first visit), default to expanded for desktop (>=1024px)
  // but collapsed for tablet (768-1023px) per AC3. Since Server Components cannot
  // detect viewport, we pass hasCookiePreference to let the client handle tablet default.
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get("sidebar_state");
  const hasCookiePreference = sidebarCookie !== undefined;
  const defaultOpen = sidebarCookie ? sidebarCookie.value === "true" : true;

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      {/* Skip to main content link — before sidebar in DOM order (AC5) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground focus:underline"
      >
        Skip to main content
      </a>
      <SidebarErrorBoundary>
        <AppSidebar
          userName={session.user.name}
          userEmail={session.user.email}
          showAssignments={featureFlags.FEATURE_ASSIGNMENTS}
          hasCookiePreference={hasCookiePreference}
        />
      </SidebarErrorBoundary>
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 !h-4" />
          <DashboardBreadcrumb />
        </header>
        <div id="main-content" className="flex-1 p-6">
          <div className="mx-auto max-w-[1200px]">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
