import { Skeleton } from "@/components/ui/Skeleton";

export default function BudgetLoading() {
  return (
    <div className="pt-3 pb-16 px-4 space-y-3">
      <Skeleton className="h-8 w-32 rounded-lg" />
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-2xl" />
      ))}
    </div>
  );
}
