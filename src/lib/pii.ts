/**
 * PII (Personally Identifiable Information) masking utilities.
 *
 * Used throughout server actions and background functions to ensure
 * raw PII is never written to logs or error tracking.
 */

/**
 * Mask an email address for logging (PII protection).
 * Shows first character + "***" + domain. E.g., "j***@example.com"
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***";
  // For single-char local parts (e.g., "a@example.com"), don't reveal the full local part
  return local.length === 1 ? `***@${domain}` : `${local[0]}***@${domain}`;
}

/**
 * Mask an IP address for logging (PII protection under GDPR).
 * IPv4: shows first two octets — "203.0.***"
 * IPv6: shows first two groups — "2001:db8:***"
 * IPv6 localhost (::1): returns "localhost:***"
 * Unknown/invalid: returns "***"
 *
 * Note on compressed IPv6: Addresses using :: compression (e.g., ::1, ::ffff:x.x.x.x)
 * split on ":" producing empty-string groups. The ::1 (localhost) case is special-cased
 * below. Other compressed forms show the first two groups as-is, which may include
 * empty strings — this is acceptable for log readability since these addresses are
 * uncommon in production (Vercel always provides full IPv4 via x-forwarded-for).
 *
 * Note: IPv4-mapped IPv6 (::ffff:x.x.x.x) is normalized to plain IPv4 by
 * `normaliseIp()` in `getClientIp()` before reaching this function, so the
 * ::ffff: prefix is never seen here in the standard auth action flow.
 */
export function maskIp(ip: string): string {
  if (ip === "unknown") return "***";

  // IPv6 localhost special case — produces clearer log output than "::***"
  if (ip === "::1") return "localhost:***";

  // IPv4: x.x.x.x → first two octets
  if (ip.includes(".") && !ip.includes(":")) {
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***`;
    }
  }

  // IPv6: x:x:x:x:x:x:x:x → first two groups
  if (ip.includes(":")) {
    const parts = ip.split(":");
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}:***`;
    }
  }

  return "***";
}
