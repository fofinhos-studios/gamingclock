import { cx } from "./utils";

interface RuleProps {
  class?: string;
}

export function Rule({ class: className }: RuleProps) {
  return <div aria-hidden="true" class={cx("section-rule", className)} />;
}
