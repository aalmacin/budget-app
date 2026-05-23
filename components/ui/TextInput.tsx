import type { InputHTMLAttributes } from 'react';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function TextInput({
  id,
  label,
  className,
  ...rest
}: TextInputProps) {
  const inputClasses = [
    'rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-sm text-zinc-600 dark:text-zinc-400"
      >
        {label}
      </label>
      <input id={id} className={inputClasses} {...rest} />
    </div>
  );
}
