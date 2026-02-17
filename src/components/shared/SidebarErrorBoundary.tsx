"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";

interface SidebarErrorBoundaryProps {
  children: React.ReactNode;
}

interface SidebarErrorBoundaryState {
  hasError: boolean;
}

/**
 * Error boundary that wraps the sidebar to prevent the entire dashboard from
 * crashing if AppSidebar or UserNav throw during render (e.g., corrupted
 * session data, missing required props). Shows a minimal fallback UI.
 */
export class SidebarErrorBoundary extends React.Component<
  SidebarErrorBoundaryProps,
  SidebarErrorBoundaryState
> {
  constructor(props: SidebarErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): SidebarErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log for production debugging and error monitoring integration.
    // Error boundaries silently swallow errors without this lifecycle method.
    console.error("[SidebarErrorBoundary]", error.message, {
      componentStack: errorInfo.componentStack,
    });
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-16 flex-col items-center justify-center border-r bg-sidebar p-2">
          <p className="text-xs text-muted-foreground text-center">
            Navigation unavailable
          </p>
          <Button
            variant="link"
            size="xs"
            className="mt-2"
            onClick={() => this.setState({ hasError: false })}
          >
            Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
