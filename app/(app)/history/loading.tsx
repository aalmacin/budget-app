import { Skeleton } from "@/components/ui/Skeleton";

export default function HistoryLoading() {
  return (
    <div className="pt-3 pb-32 px-4 space-y-3">
      <Skeleton className="h-8 w-32 rounded-lg" />
      <Skeleton className="h-64 w-full rounded-3xl" />
    </div>
  );
}
