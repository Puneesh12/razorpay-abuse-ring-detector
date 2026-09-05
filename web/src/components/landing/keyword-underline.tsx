"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/** A single hand-drawn stroke under one word, drawn on scroll-into-view -- not
 *  a straight rule: a slightly uneven path so it reads as marked by hand,
 *  not a CSS border. */
function HandDrawnUnderline() {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const length = path.getTotalLength();
    gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
    const tween = gsap.to(path, {
      strokeDashoffset: 0,
      duration: 0.7,
      delay: 0.15,
      ease: "power2.inOut",
      scrollTrigger: {
        trigger: path.closest("[data-underline-trigger]") ?? path,
        start: "top 80%",
        toggleActions: "play none none none",
      },
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, []);

  return (
    <svg
      className="pointer-events-none absolute left-[-2%] top-full w-[104%] h-[0.3em] -translate-y-[35%]"
      viewBox="0 0 200 16"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        ref={pathRef}
        d="M2,10 C 45,4 70,15 100,9 C 130,3 165,13 198,7"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Standalone statement making the same "evidence, not a verdict" claim as
 * the rest of the page, with a hand-drawn underline on "evidence" that
 * draws itself in when the line scrolls into view.
 */
export function KeywordUnderline() {
  return (
    <section id="evidence" data-underline-trigger className="scroll-mt-20">
      <div className="mx-auto max-w-[1440px] px-6 py-24 md:py-32">
        <p className="font-heading text-3xl md:text-5xl font-medium leading-[1.3] max-w-3xl">
          <span className="text-muted-foreground">Ring doesn&apos;t hand you a verdict. It hands you the</span>{" "}
          <span className="relative inline-block text-brand">
            evidence
            <HandDrawnUnderline />
          </span>
          <span className="text-muted-foreground">.</span>
        </p>
      </div>
    </section>
  );
}
