"use client";

import { Button } from "@/components/ui/button";

/**
 * Next.js error boundary for the (dashboard) route group.
 * Catches runtime errors in dashboard pages (children of the layout).
 * The layout itself is protected by SidebarErrorBoundary for sidebar errors
 * and a try-catch for auth errors.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log error for production debugging. The digest (if present) is a
  // server-side error hash that can be correlated with server logs.
  console.error("[DashboardError]", error.message, error.digest ?? "");
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-center space-y-4">
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="text-muted-foreground">
          An error occurred while loading this page. Please try again.
        </p>
        <Button type="button" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
