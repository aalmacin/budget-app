import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreateHouseholdForm } from "./CreateHouseholdForm";

export const metadata = {
  title: "Create your household · Budget",
};

export default async function CreateHouseholdPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // If the user already belongs to a household, skip onboarding.
  const { data: membership } = await supabase
    .from("household_member")
    .select("household_id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (membership) {
    redirect("/dashboard");
  }

  return (
    <div className="flex-1 flex flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8">
          <div className="font-mono text-xs uppercase tracking-[4px] text-sage font-medium mb-2">
            Step 1 of 1
          </div>
          <h1 className="text-2xl font-medium tracking-tight text-ink">
            Create your household
          </h1>
          <p className="text-sm text-muted mt-1">
            Give it a name your family will recognize. You can add the second
            adult and kids next.
          </p>
        </div>
        <CreateHouseholdForm />
      </div>
    </div>
  );
}
