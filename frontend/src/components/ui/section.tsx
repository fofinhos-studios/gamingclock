import type { ComponentChildren } from "preact";

import { cx } from "./utils";

type SectionTexture = "none" | "grid" | "diagonal" | "vertical";

interface SectionProps {
  id?: string;
  label?: string;
  title?: ComponentChildren;
  description?: ComponentChildren;
  children: ComponentChildren;
  inverted?: boolean;
  texture?: SectionTexture;
  compact?: boolean;
  class?: string;
  contentClass?: string;
}

const textureClasses: Record<SectionTexture, string> = {
  none: "",
  grid: "texture-grid",
  diagonal: "texture-diagonal",
  vertical: "texture-vertical",
};

export function Section({
  id,
  label,
  title,
  description,
  children,
  inverted = false,
  texture = "none",
  compact = false,
  class: className,
  contentClass,
}: SectionProps) {
  return (
    <section
      id={id}
      class={cx(
        "section-shell",
        compact && "section-shell--compact",
        inverted && "section-shell--inverted",
        textureClasses[texture],
        className,
      )}
    >
      <div class="page-container">
        {(label || title || description) && (
          <header class="mb-12 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-end">
            <div>
              {label && <p class="section-eyebrow">{label}</p>}
              {title && <h2 class="section-title mt-4">{title}</h2>}
            </div>
            {description && <p class="section-copy">{description}</p>}
          </header>
        )}
        <div class={contentClass}>{children}</div>
      </div>
    </section>
  );
}
