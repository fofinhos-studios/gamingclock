import { useEffect, useRef, useState } from "preact/hooks";

export function useTransientFeedback<T>(duration = 1600) {
  const [active, setActive] = useState<T | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const clear = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setActive(null);
  };

  const trigger = (value: T, nextDuration = duration) => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    setActive(value);
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      setActive(null);
    }, nextDuration);
  };

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  return { active, trigger, clear };
}
