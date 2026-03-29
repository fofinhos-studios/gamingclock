import type { ComponentChildren } from "preact";

import { cx } from "./utils";

type StackGap = "sm" | "md" | "lg";

interface StackProps {
  children: ComponentChildren;
  gap?: StackGap;
  class?: string;
}

const gapClasses: Record<StackGap, string> = {
  sm: "gap-4",
  md: "gap-6",
  lg: "gap-8",
};

export function Stack({ children, gap = "md", class: className }: StackProps) {
  return (
    <div class={cx("flex flex-col", gapClasses[gap], className)}>
      {children}
    </div>
  );
}
