/**
 * Default locale for date formatting. Extracted as a constant for
 * future internationalisation — swap to env-based config when i18n is added.
 */
export const DEFAULT_LOCALE = "en-GB";

/**
 * Format a date as a human-readable long date string (e.g., "16 February 2026").
 * Uses DEFAULT_LOCALE for consistent formatting across the application.
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString(DEFAULT_LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Format a date as a human-readable relative time string.
 *
 * - < 1 minute: "Just now"
 * - < 60 minutes: "X minutes ago"
 * - < 24 hours: "X hours ago"
 * - < 7 days: "X days ago"
 * - >= 7 days: formatted date (e.g., "Feb 10, 2026")
 * - null: "Never"
 */
export function formatRelativeTime(date: Date | null): string {
  if (!date) return "Never";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Future dates — format as absolute date to expose data bugs
  // (e.g., lastSeenAt accidentally set to a future timestamp)
  if (diffMs < 0) {
    return date.toLocaleDateString(DEFAULT_LOCALE, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Use < 1 (not <= 0) because Math.floor can produce 0 for timestamps
  // 1–59 seconds in the past. "Just now" is the correct UX for sub-minute diffs.
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  return date.toLocaleDateString(DEFAULT_LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
