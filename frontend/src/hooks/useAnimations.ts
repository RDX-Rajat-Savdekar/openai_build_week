import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, active: boolean, decimals = 0, duration = 1200) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.max(0, Math.min(1, (now - start) / duration));
      const eased = 1 - (1 - p) ** 3;
      setValue(Number((target * eased).toFixed(decimals)));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, active, decimals, duration]);

  return value;
}

export function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setInView(true);
      },
      { threshold },
    );
    obs.observe(el);
    const t = setTimeout(() => setInView(true), 1800);
    return () => {
      obs.disconnect();
      clearTimeout(t);
    };
  }, [threshold]);

  return { ref, inView };
}
