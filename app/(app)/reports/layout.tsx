import type { ReactNode } from "react";
import { AppBar } from "@/components/ui/AppBar";
import { MenuButton } from "@/components/layout/AppDrawer";
import { PageTitle } from "@/components/ui/PageTitle";
import { ReportsNav } from "@/components/reports/ReportsNav";

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="pt-3 pb-16">
      <AppBar left={<MenuButton />} />
      <PageTitle title="Reports" />
      <ReportsNav />
      {children}
    </div>
  );
}
