import type { ReactNode } from "react";
import { AppBar } from "@/components/ui/AppBar";
import { PageTitle } from "@/components/ui/PageTitle";
import { ReportsNav } from "@/components/reports/ReportsNav";

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="pt-3 pb-32">
      <AppBar />
      <PageTitle title="Reports" />
      <ReportsNav />
      {children}
    </div>
  );
}
