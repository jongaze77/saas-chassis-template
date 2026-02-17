import { describe, it, expect } from "vitest";

import { DashboardBreadcrumb } from "@/components/shared/DashboardBreadcrumb";
import { resolveRouteLabel, routeLabels } from "@/lib/navigation";

describe("DashboardBreadcrumb", () => {
  it("exports a function component", () => {
    expect(typeof DashboardBreadcrumb).toBe("function");
  });

  it("has the correct display name", () => {
    expect(DashboardBreadcrumb.name).toBe("DashboardBreadcrumb");
  });

  describe("route label mapping (shared from @/lib/navigation)", () => {
    it("maps all known dashboard routes to display labels", () => {
      expect(Object.keys(routeLabels)).toHaveLength(6);
    });

    it("/dashboard maps to 'Dashboard'", () => {
      expect(routeLabels["/dashboard"]).toBe("Dashboard");
    });

    it("/triage maps to 'Triage'", () => {
      expect(routeLabels["/triage"]).toBe("Triage");
    });

    it("/sites maps to 'Sites'", () => {
      expect(routeLabels["/sites"]).toBe("Sites");
    });

    it("/activity maps to 'Activity'", () => {
      expect(routeLabels["/activity"]).toBe("Activity");
    });

    it("/settings maps to 'Settings'", () => {
      expect(routeLabels["/settings"]).toBe("Settings");
    });

    it("/assignments maps to 'Assignments'", () => {
      expect(routeLabels["/assignments"]).toBe("Assignments");
    });
  });

  describe("resolveRouteLabel — sub-route matching", () => {
    it("exact match returns correct label", () => {
      expect(resolveRouteLabel("/settings")).toBe("Settings");
    });

    it("sub-route /settings/profile matches parent /settings → 'Settings'", () => {
      expect(resolveRouteLabel("/settings/profile")).toBe("Settings");
    });

    it("sub-route /dashboard/overview matches parent /dashboard → 'Dashboard'", () => {
      expect(resolveRouteLabel("/dashboard/overview")).toBe("Dashboard");
    });

    it("sub-route /sites/123/edit matches parent /sites → 'Sites'", () => {
      expect(resolveRouteLabel("/sites/123/edit")).toBe("Sites");
    });

    it("unknown route falls back to capitalised first segment", () => {
      expect(resolveRouteLabel("/reports/monthly")).toBe("Reports");
    });

    it("root path / falls back to 'Dashboard'", () => {
      expect(resolveRouteLabel("/")).toBe("Dashboard");
    });
  });
});
