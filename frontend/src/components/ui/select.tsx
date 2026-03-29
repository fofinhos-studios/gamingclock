import type { JSX } from "preact";

import { cx } from "./utils";

interface SelectProps extends JSX.HTMLAttributes<HTMLSelectElement> {}

export function Select({ class: className, ...props }: SelectProps) {
  return <select class={cx("ui-select", className)} {...props} />;
}
