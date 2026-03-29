import type { JSX } from "preact";

import { cx } from "./utils";

interface InputProps extends JSX.HTMLAttributes<HTMLInputElement> {}

export function Input({ class: className, ...props }: InputProps) {
  return <input class={cx("ui-input", className)} {...props} />;
}
