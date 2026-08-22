import { LiquidGlass } from "@ybouane/liquidglass";
import { useEffect, useRef } from "preact/hooks";

const WORDMARK_TEXT = "Gaming Clock";

const glassConfig = {
  blurAmount: 0.1,
  refraction: 0.38,
  chromAberration: 0,
  edgeHighlight: 0.2,
  specular: 0.45,
  fresnel: 0.68,
  distortion: 0,
  cornerRadius: 14,
  zRadius: 14,
  opacity: 0.82,
  saturation: -0.16,
  tintStrength: 0,
  brightness: 0.06,
  shadowOpacity: 0.14,
  shadowSpread: 5,
  shadowOffsetY: 1,
  floating: false,
  button: false,
  bevelMode: 1,
};

export function SurfaceWordmark({ text = WORDMARK_TEXT }: { text?: string }) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const glassRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const glass = glassRef.current;
    if (!root || !glass) {
      return;
    }

    let isActive = true;
    let glassInstance: { destroy(): void } | undefined;

    void LiquidGlass.init({
      root,
      glassElements: [glass],
      defaults: glassConfig,
    })
      .then((instance) => {
        if (!isActive) {
          instance.destroy();
          return;
        }
        glassInstance = instance;
      })
      .catch(() => {
        // The styled text remains a readable fallback when WebGL is unavailable.
      });

    return () => {
      isActive = false;
      glassInstance?.destroy();
    };
  }, []);

  return (
    <span class="planner-identity" ref={rootRef} role="img" aria-label={text}>
      <span class="planner-identity__backdrop" aria-hidden="true" />
      <span class="planner-identity__glass" ref={glassRef} aria-hidden="true">
        {text}
      </span>
    </span>
  );
}
