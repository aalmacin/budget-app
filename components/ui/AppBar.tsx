import type { ReactNode } from "react";
import Image from "next/image";

type AppBarProps = {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
};

export function AppBar({ left, center, right }: AppBarProps) {
  return (
    <div className="flex items-center justify-between px-4 mb-3.5">
      <div>{left}</div>
      <div>{center}</div>
      <div>
        {right ?? (
          <Image
            src="/icon.svg"
            alt="Budget logo"
            width={40}
            height={40}
            className="w-10 h-10 rounded-xl shadow-sm"
          />
        )}
      </div>
    </div>
  );
}
