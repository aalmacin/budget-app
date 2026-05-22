type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "h-4 w-full rounded-md" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`bg-surface-soft animate-pulse ${className}`}
    />
  );
}
