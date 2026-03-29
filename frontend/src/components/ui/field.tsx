import type { ComponentChildren } from "preact";

import { cx } from "./utils";

interface FieldProps {
  label: string;
  hint?: string;
  controlId?: string;
  children: ComponentChildren;
  class?: string;
}

export function Field({
  label,
  hint,
  controlId,
  children,
  class: className,
}: FieldProps) {
  return (
    <label htmlFor={controlId} class={cx("ui-field", className)}>
      <span class="ui-label">{label}</span>
      {hint && <span class="ui-hint">{hint}</span>}
      {children}
    </label>
  );
}
