import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for the dashboard page. Displayed by Next.js Suspense
 * while the Server Component (page.tsx) resolves its async data (auth()).
 * Uses the same Card structure as EmptyDashboardCard to prevent layout shift
 * when loading completes (Card components have built-in padding/spacing).
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Heading skeleton */}
      <Skeleton className="h-8 w-64" />
      {/* Card grid skeleton — matches responsive grid and Card structure from page.tsx */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Skeleton className="size-4" />
                <Skeleton className="h-5 w-32" />
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-3/4" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-9 w-28" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
