import { cx } from "./utils";

interface StatProps {
  label: string;
  value: string;
  detail?: string;
  inverted?: boolean;
  class?: string;
}

export function Stat({
  label,
  value,
  detail,
  inverted = false,
  class: className,
}: StatProps) {
  return (
    <div class={cx("stat-card", inverted && "stat-card--inverted", className)}>
      <dt class="stat-label">{label}</dt>
      <dd class="stat-value">{value}</dd>
      {detail && <p class="stat-detail">{detail}</p>}
    </div>
  );
}
