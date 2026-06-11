import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { MenuButton } from "@/components/layout/AppDrawer";
import { AddMenuButton } from "@/components/ui/AddMenuButton";

type AppBarProps = {
  /** Rendered to the left of the hamburger menu. */
  right?: ReactNode;
};

export function AppBar({ right }: AppBarProps) {
  return (
    <div className="flex items-center justify-between px-4 pb-3 mb-3.5 border-b border-sage-soft">
      <Link href="/dashboard" aria-label="Go to dashboard">
        <Image
          src="/icon.svg"
          alt="Budget logo"
          width={40}
          height={40}
          className="w-10 h-10 rounded-xl shadow-sm"
        />
      </Link>
      <div className="flex items-center gap-3">
        {right}
        <AddMenuButton />
        <MenuButton />
      </div>
    </div>
  );
}
