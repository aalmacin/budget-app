import type { ReactNode } from "react";

type MerchantIconProps = {
  /** Pre-rendered SVG icon at the right size. */
  icon: ReactNode;
  /** Pixel size of the rounded tile. Defaults to 36. */
  size?: number;
};

/**
 * Square rounded tile used to host a category/merchant glyph in transaction
 * rows and Quick Add tiles.
 */
export function MerchantIcon({ icon, size = 36 }: MerchantIconProps) {
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-xl bg-surface-soft text-sage flex items-center justify-center flex-shrink-0"
    >
      {icon}
    </div>
  );
}
