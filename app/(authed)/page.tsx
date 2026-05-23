import { getCurrentUser } from '@/lib/auth';

export default async function AuthedHome() {
  const user = await getCurrentUser();

  return (
    <section className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Signed in
      </h1>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">
        Welcome, <span className="font-medium">{user?.email}</span>. Your budget
        workspace will live here.
      </p>
    </section>
  );
}
