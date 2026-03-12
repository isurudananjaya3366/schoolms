import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number | null;
  subtitle?: string;
  icon?: LucideIcon;
  isLoading?: boolean;
  isError?: boolean;
}

export default function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  isLoading = false,
  isError = false,
}: KpiCardProps) {
  return (
    <Card>
      <CardContent className="relative p-6">
        {Icon && (
          <Icon className="absolute right-4 top-4 h-6 w-6 text-muted-foreground" />
        )}
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        {isLoading ? (
          <div className="mt-2 space-y-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : isError ? (
          <div className="mt-2">
            <p className="text-3xl font-bold">—</p>
            <p className="text-sm text-muted-foreground">Data unavailable</p>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-3xl font-bold">{value ?? "—"}</p>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
