'use client';

import { signOut } from '@/actions/auth';
import { Button } from '@/components/ui/Button';

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="secondary">
        Sign out
      </Button>
    </form>
  );
}
