import { forwardRef, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ invalid = false, className = "", ...rest }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={`w-full h-12 px-4 rounded-2xl bg-surface text-ink shadow-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-sage/40 ${invalid ? "ring-2 ring-brick/60" : ""} ${className}`}
        {...rest}
      />
    );
  },
);
