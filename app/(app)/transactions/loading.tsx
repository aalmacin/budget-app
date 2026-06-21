import { Skeleton } from "@/components/ui/Skeleton";

export default function TransactionsLoading() {
  return (
    <div className="pt-3 pb-32 px-4 space-y-3">
      <Skeleton className="h-8 w-40 rounded-lg" />
      <Skeleton className="h-10 w-full rounded-full" />
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-2xl" />
      ))}
    </div>
  );
}
