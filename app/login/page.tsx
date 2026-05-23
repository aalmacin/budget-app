import { signIn } from '@/actions/auth';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-8">
          Sign in
        </h1>
        {error && (
          <p
            role="alert"
            className="mb-4 text-sm text-red-600 dark:text-red-400"
            data-testid="login-error"
          >
            {error}
          </p>
        )}
        <form action={signIn} className="flex flex-col gap-4">
          <TextInput
            id="email"
            name="email"
            type="email"
            label="Email"
            required
            autoComplete="email"
          />
          <TextInput
            id="password"
            name="password"
            type="password"
            label="Password"
            required
            autoComplete="current-password"
          />
          <Button type="submit" variant="primary" className="mt-2">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
