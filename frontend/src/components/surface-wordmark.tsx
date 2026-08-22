const WORDMARK_TEXT = "Gaming Clock";

export function SurfaceWordmark({ text = WORDMARK_TEXT }: { text?: string }) {
  return (
    <span class="planner-identity" role="img" aria-label={text}>
      <span class="planner-identity__label" aria-hidden="true">
        {text}
      </span>
    </span>
  );
}
