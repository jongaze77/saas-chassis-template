import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for the dashboard page. Displayed by Next.js Suspense
 * while the Server Component (page.tsx) resolves its async data (auth()).
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Heading skeleton */}
      <Skeleton className="h-8 w-64" />
      {/* Card grid skeleton — matches responsive grid from page.tsx */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
