import { redirect } from "next/navigation";

// Pencil icon on Quick-Add's recurring row navigates here. v1 simply funnels the
// user back to the Recurring Transactions page where they can pause / resume / adjust.
export default async function EditRecurringTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  await params;
  redirect("/recurring-transactions");
}
