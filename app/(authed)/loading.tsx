export default function AuthedLoading() {
  return (
    <section className="max-w-3xl mx-auto px-6 py-16" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-4 h-4 w-72 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
    </section>
  );
}
