/**
 * Shared navigation constants used by AppSidebar and DashboardBreadcrumb.
 * Single source of truth for route paths and display labels to prevent drift.
 */

/** Route-to-label mapping for all known dashboard routes. */
export const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/settings": "Settings",
};

/**
 * Route keys pre-sorted by length descending at module init.
 * Ensures longest prefixes match first (e.g., "/settings/profile" before "/settings")
 * without re-sorting on every resolveRouteLabel call.
 */
const sortedRouteKeys = Object.keys(routeLabels).sort(
  (a, b) => b.length - a.length,
);

/**
 * Resolve the display label for a given pathname.
 * Tries exact match first, then checks if the pathname starts with a known route
 * (e.g., "/settings/profile" matches "/settings" and returns "Settings").
 * Falls back to capitalised first path segment for truly unknown routes.
 */
export function resolveRouteLabel(pathname: string): string {
  // Exact match first
  if (routeLabels[pathname]) {
    return routeLabels[pathname];
  }

  // Find the longest matching route prefix for sub-routes
  const matchingRoute = sortedRouteKeys.find(
    (route) =>
      pathname.startsWith(route + "/") || pathname === route,
  );

  if (matchingRoute) {
    return routeLabels[matchingRoute];
  }

  // Fallback: capitalise first path segment
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return firstSegment
    ? firstSegment.replace(/^./, (c) => c.toUpperCase())
    : "Dashboard";
}
