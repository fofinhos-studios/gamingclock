import type { ComponentChildren } from "preact";

import { cx } from "./utils";

type CardTone = "default" | "muted" | "inverted";

interface CardProps {
  children: ComponentChildren;
  tone?: CardTone;
  interactive?: boolean;
  class?: string;
}

const toneClasses: Record<CardTone, string> = {
  default: "surface-card",
  muted: "surface-card surface-card--muted",
  inverted: "surface-card surface-card--inverted",
};

export function Card({
  children,
  tone = "default",
  interactive = false,
  class: className,
}: CardProps) {
  return (
    <div
      class={cx(
        toneClasses[tone],
        interactive && "surface-card--interactive",
        className,
      )}
    >
      {children}
    </div>
  );
}
