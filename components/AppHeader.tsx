import type { User } from '@supabase/supabase-js';
import { SignOutButton } from '@/components/SignOutButton';

export function AppHeader({ user }: { user: User }) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black px-6 py-3">
      <nav className="flex items-center gap-4">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Budget
        </span>
      </nav>
      <div className="flex items-center gap-4">
        <span
          className="text-sm text-zinc-600 dark:text-zinc-400"
          data-testid="current-user-email"
        >
          {user.email}
        </span>
        <SignOutButton />
      </div>
    </header>
  );
}
