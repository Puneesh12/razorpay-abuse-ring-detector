"use client";

import { useEffect, useRef, useState } from "react";

interface Step {
  eyebrow: string;
  headline: string;
  body: string;
  fact: string;
}

const CURVE_PATH = "M 5 2 C 5 14, 95 14, 95 26 S 5 38, 5 51 S 95 63, 95 76 S 95 88, 95 99";

/**
 * A scrolling "decision loop" for the four real pipeline stages, styled
 * after a reference the user pointed to (their own Paytm Mitra project):
 * a snaking path behind alternating left/right steps, revealed by plain
 * scroll position (no ScrollTrigger pin -- a raw scroll listener is more
 * robust and doesn't depend on the animation ticker running).
 */
export function DecisionLoop({ steps }: { steps: Step[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const stepEls = Array.from(stepsRef.current?.querySelectorAll<HTMLElement>("[data-loop-step]") ?? []);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(Number((visible.target as HTMLElement).dataset.loopStep));
      },
      { rootMargin: "-28% 0px -48%", threshold: [0.1, 0.35, 0.65] }
    );
    stepEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = stepsRef.current;
    const path = pathRef.current;
    if (!container || !path) return;

    let frame = 0;
    const update = () => {
      const rect = container.getBoundingClientRect();
      const startAt = window.innerHeight * 0.75;
      const travel = Math.max(rect.height - window.innerHeight * 0.3, 1);
      const progress = Math.min(1, Math.max(0, (startAt - rect.top) / travel));
      path.style.strokeDashoffset = String(1 - progress);
      frame = 0;
    };
    const request = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    return () => {
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section ref={sectionRef} id="how-it-works" className="scroll-mt-20 border-b border-border">
      <div className="mx-auto max-w-[1440px] px-6 py-20 md:py-28 grid lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.2fr)] gap-12 lg:gap-20">
        <div className="lg:sticky lg:top-24 self-start">
          <p className="text-[11px] font-semibold tracking-widest text-brand uppercase mb-4">The decision loop</p>
          <h2 className="font-heading text-3xl md:text-4xl font-medium text-foreground leading-[1.15]">
            Every case follows the same four stages.
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground max-w-sm">
            Each stage passes evidence to the next. Nothing is hidden behind a single score, and a human keeps the
            final say.
          </p>
          <ol className="mt-10 hidden lg:grid gap-0">
            {steps.map((s, i) => (
              <li
                key={s.eyebrow}
                className={`flex items-center gap-3 min-h-[2.6rem] border-t border-border text-[11px] font-semibold uppercase tracking-wider transition-colors last:border-b ${
                  i === active ? "text-foreground pl-2" : "text-muted-foreground"
                }`}
              >
                <span className={`font-mono text-[10px] ${i === active ? "text-brand" : "text-muted-foreground/60"}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.eyebrow}
              </li>
            ))}
          </ol>
        </div>

        <div ref={stepsRef} className="relative isolate">
          <svg
            className="absolute inset-0 -z-10 h-full w-full overflow-visible pointer-events-none hidden md:block"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path d={CURVE_PATH} fill="none" stroke="currentColor" strokeWidth="1" className="text-border" vectorEffect="non-scaling-stroke" />
            <path
              ref={pathRef}
              d={CURVE_PATH}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="2"
              strokeLinecap="round"
              pathLength={1}
              style={{ strokeDasharray: 1, strokeDashoffset: 1, filter: "drop-shadow(0 0 4px oklch(0.62 0.19 255 / 45%))" }}
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {steps.map((s, i) => {
            const even = i % 2 === 1;
            return (
              <article
                key={s.eyebrow}
                data-loop-step={i}
                className={`relative z-10 flex min-h-[38vh] flex-col justify-center w-full md:w-[88%] ${
                  even ? "items-end text-right ml-auto pr-14 md:pr-20" : "items-start pl-14 md:pl-20"
                }`}
              >
                <span
                  className={`absolute top-1/2 -translate-y-1/2 flex size-10 items-center justify-center rounded-full border font-mono text-[12px] transition-colors ${
                    even ? "right-0" : "left-0"
                  } ${i === active ? "border-brand bg-brand text-brand-foreground" : "border-border bg-background text-muted-foreground"}`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-brand mb-2">{s.eyebrow}</p>
                <h3 className="font-heading text-3xl md:text-5xl font-medium text-foreground leading-[1.05] max-w-md">
                  {s.headline}
                </h3>
                <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground max-w-md">{s.body}</p>
                <span className="mt-6 inline-block border-t border-brand/30 pt-2 font-mono text-[11px] text-muted-foreground">
                  {s.fact}
                </span>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
