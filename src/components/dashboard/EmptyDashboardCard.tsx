import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface EmptyDashboardCardProps {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  icon: LucideIcon;
}

export function EmptyDashboardCard({
  title,
  description,
  actionLabel,
  actionHref,
  icon: Icon,
}: EmptyDashboardCardProps) {
  // Generate a sanitized kebab-case test ID from the title for E2E test targeting.
  // Strips all non-alphanumeric characters to ensure valid test IDs even if
  // titles contain punctuation (e.g., "Priority Actions (New!)" → "empty-card-priority-actions-new-").
  const testId = `empty-card-${title.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`;

  return (
    <Card data-testid={testId}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
      <CardFooter>
        <Button asChild variant="default">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
