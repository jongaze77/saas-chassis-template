"use client";

/**
 * A client-side "Try again" button that reloads the current page.
 * Used in Server Components where `onClick` handlers are unavailable.
 * Renders a semantic `<button>` instead of `<a href="">` (WCAG 2.1 AA 4.1.2).
 */
export function ErrorRetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
    >
      Try again
    </button>
  );
}
