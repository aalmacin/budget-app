import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { getCurrentUser } from '@/lib/auth';

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The middleware already redirects anonymous visitors. This is the typed
  // fallback so `user` is non-null for downstream Server Components.
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader user={user} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
