import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** The icon, typically an inline <svg>. */
  icon: ReactNode;
  /** Required for accessibility — there is no visible label. */
  "aria-label": string;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ icon, className = "", ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={`w-10 h-10 rounded-xl bg-surface text-ink flex items-center justify-center shadow-sm hover:bg-surface-soft transition-colors ${className}`}
        {...rest}
      >
        {icon}
      </button>
    );
  },
);
