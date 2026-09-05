"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

/** Animates a displayed number from 0 up to `value` whenever it changes. Returns the in-flight number — format it yourself (percent, locale, etc). */
export function useCountUp(value: number | null, duration = 0.9) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    if (value == null) return;
    const obj = { n: prev.current };
    const tween = gsap.to(obj, {
      n: value,
      duration,
      ease: "power2.out",
      onUpdate: () => setDisplay(obj.n),
      onComplete: () => {
        prev.current = value;
      },
    });
    return () => {
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return value == null ? 0 : display;
}
