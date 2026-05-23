import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Sign in · Budget",
};

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  return (
    <div className="flex-1 flex flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8">
          <div className="font-mono text-xs uppercase tracking-[4px] text-sage font-medium mb-2">
            Budget
          </div>
          <h1 className="text-2xl font-medium tracking-tight text-ink">
            Sign in
          </h1>
          <p className="text-sm text-muted mt-1">
            Use the account your admin set up for you.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
