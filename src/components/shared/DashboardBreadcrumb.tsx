"use client";

import { usePathname } from "next/navigation";

import { resolveRouteLabel } from "@/lib/navigation";

/**
 * Dynamic breadcrumb for the dashboard layout header.
 * Uses shared route labels from `@/lib/navigation` to stay synchronized
 * with AppSidebar navigation items. Supports sub-route matching
 * (e.g., "/settings/profile" shows "Settings").
 *
 * Defensive: catches any errors from pathname resolution and falls back
 * to "Dashboard" to prevent the layout header from crashing (R3-H3).
 */
export function DashboardBreadcrumb() {
  const pathname = usePathname();

  let label: string;
  try {
    label = resolveRouteLabel(pathname);
  } catch (error) {
    // Fallback if pathname parsing fails unexpectedly. This prevents
    // the layout header from crashing and taking down the entire dashboard.
    console.error("[DashboardBreadcrumb] pathname resolution failed", {
      pathname,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    label = "Dashboard";
  }

  return <span className="text-sm font-medium">{label}</span>;
}
