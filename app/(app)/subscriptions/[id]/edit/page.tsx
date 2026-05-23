import { redirect } from "next/navigation";

// Pencil icon on Quick-Add's Subs row navigates here. v1 simply funnels the
// user back to the Subscriptions page where they can pause / resume / adjust.
export default async function EditSubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  await params;
  redirect("/subscriptions");
}
