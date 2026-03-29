import type { JSX } from "preact";

import { cx } from "./utils";

type ButtonVariant = "primary" | "outline" | "ghost";
type ButtonSize = "sm" | "md";

interface ButtonProps extends JSX.HTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-2 border-black bg-black text-white hover:bg-white hover:text-black",
  outline:
    "border-2 border-black bg-white text-black hover:bg-black hover:text-white",
  ghost:
    "border-b border-transparent bg-transparent px-0 py-1 text-black hover:border-black",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-11 px-4 py-2 text-[0.7rem] tracking-[0.24em]",
  md: "min-h-12 px-6 py-3 text-[0.72rem] tracking-[0.28em]",
};

export function Button({
  variant = "outline",
  size = "md",
  block = false,
  class: className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      class={cx(
        "inline-flex items-center justify-center gap-2 font-[var(--font-mono)] uppercase transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-40",
        sizeClasses[size],
        variantClasses[variant],
        block && "w-full",
        className,
      )}
      {...props}
    />
  );
}
