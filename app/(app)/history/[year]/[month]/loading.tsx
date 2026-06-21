import { Skeleton } from "@/components/ui/Skeleton";

export default function HistoryMonthLoading() {
  return (
    <div className="pt-3 pb-32 px-4 space-y-3">
      <Skeleton className="h-28 w-full rounded-3xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-3xl" />
        <Skeleton className="h-20 rounded-3xl" />
      </div>
      <Skeleton className="h-32 w-full rounded-3xl" />
      <Skeleton className="h-48 w-full rounded-3xl" />
    </div>
  );
}
