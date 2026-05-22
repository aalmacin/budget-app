import type { ReactNode } from "react";

/**
 * Minimal shell for unauthenticated routes (sign-in, onboarding). No drawer,
 * no realtime subscription, no Redux Provider — pages here are fully static
 * server components and never need client state.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-svh bg-bg flex flex-col">{children}</div>;
}
