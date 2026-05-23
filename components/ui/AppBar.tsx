import type { ReactNode } from "react";

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
      <div>{right}</div>
    </div>
  );
}
