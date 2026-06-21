import { Skeleton } from "@/components/ui/Skeleton";

export default function QuickAddLoading() {
  return (
    <div className="pt-3 pb-16 px-4 space-y-3">
      <Skeleton className="h-8 w-28 rounded-lg" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
