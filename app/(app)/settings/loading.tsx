import { Skeleton } from "@/components/ui/Skeleton";

export default function SettingsLoading() {
  return (
    <div className="pt-3 pb-16 px-4 space-y-4">
      <Skeleton className="h-8 w-28 rounded-lg" />
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-2xl" />
      ))}
    </div>
  );
}
