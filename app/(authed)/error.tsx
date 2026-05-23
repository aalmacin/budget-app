'use client';

import { useEffect } from 'react';

export default function AuthedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for ops; never include user-supplied data here.
    console.error('AuthedError boundary caught:', error);
  }, [error]);

  return (
    <section className="max-w-xl mx-auto px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Something went wrong
      </h1>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        We couldn&apos;t load this page. Try again, or sign out and back in if the
        problem persists.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-md bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
      >
        Try again
      </button>
    </section>
  );
}
