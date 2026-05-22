import type { ReactNode } from "react";

type ChipsRowProps = {
  children: ReactNode;
  /** Whether to allow horizontal scrolling if chips overflow. */
  scroll?: boolean;
};

export function ChipsRow({ children, scroll = true }: ChipsRowProps) {
  return (
    <div
      className={`flex gap-2 ${scroll ? "overflow-x-auto py-1" : "flex-wrap"}`}
    >
      {children}
    </div>
  );
}
