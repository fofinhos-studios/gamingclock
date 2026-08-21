import type { JSX } from "preact";

import { cx } from "./utils";

type ButtonVariant = "primary" | "outline" | "ghost";
type ButtonSize = "sm" | "md";

interface ButtonProps extends JSX.HTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  feedbackState?: "idle" | "loading" | "success";
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)] hover:bg-[var(--muted-foreground)] hover:text-[var(--surface)]",
  outline:
    "border border-[var(--foreground)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
  ghost:
    "border border-transparent bg-transparent px-0 py-1 text-[var(--foreground)] hover:bg-[var(--muted)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-11 px-3 py-1.5 text-[0.68rem] tracking-[0.16em]",
  md: "min-h-11 px-4 py-2 text-[0.7rem] tracking-[0.18em]",
};

export function Button({
  variant = "outline",
  size = "md",
  block = false,
  feedbackState = "idle",
  class: className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-feedback={feedbackState}
      class={cx(
        "ui-button inline-flex items-center justify-center gap-2 whitespace-nowrap font-[var(--font-mono)] uppercase transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-40",
        sizeClasses[size],
        variantClasses[variant],
        block && "w-full",
        className,
      )}
      {...props}
    />
  );
}
