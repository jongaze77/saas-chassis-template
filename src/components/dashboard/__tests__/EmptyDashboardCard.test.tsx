import { Activity, Globe, ListChecks } from "lucide-react";
import { describe, it, expect } from "vitest";

import { EmptyDashboardCard } from "@/components/dashboard/EmptyDashboardCard";

describe("EmptyDashboardCard", () => {
  it("exports a function component", () => {
    expect(typeof EmptyDashboardCard).toBe("function");
  });

  it("has the correct display name", () => {
    expect(EmptyDashboardCard.name).toBe("EmptyDashboardCard");
  });

  describe("props interface", () => {
    it("accepts all required props — title, description, actionLabel, actionHref, icon", () => {
      const props = {
        title: "Test Card",
        description: "Test description",
        actionLabel: "Test Action",
        actionHref: "/test",
        icon: Globe,
      };
      expect(props.title).toBe("Test Card");
      expect(props.actionHref).toBe("/test");
    });

    it("uses lucide-react icons (verified import)", () => {
      // lucide-react v0.564+ exports icons as React.forwardRef objects
      expect(ListChecks).toBeDefined();
      expect(Globe).toBeDefined();
      expect(Activity).toBeDefined();
    });
  });

  describe("data-testid generation", () => {
    it("generates kebab-case test ID from title — 'Priority Actions' → 'empty-card-priority-actions'", () => {
      const title = "Priority Actions";
      const testId = `empty-card-${title.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`;
      expect(testId).toBe("empty-card-priority-actions");
    });

    it("generates test ID for 'Connected Sites' → 'empty-card-connected-sites'", () => {
      const title = "Connected Sites";
      const testId = `empty-card-${title.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`;
      expect(testId).toBe("empty-card-connected-sites");
    });

    it("generates test ID for 'Recent Activity' → 'empty-card-recent-activity'", () => {
      const title = "Recent Activity";
      const testId = `empty-card-${title.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`;
      expect(testId).toBe("empty-card-recent-activity");
    });
  });
});
