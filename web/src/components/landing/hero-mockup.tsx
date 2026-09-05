"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { useGraph } from "@/hooks/use-api";

// Sigma needs WebGL, unavailable during server prerendering.
const RingGraph = dynamic(() => import("@/components/graph/ring-graph").then((m) => m.RingGraph), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted/20" />,
});

/**
 * A tilted "product shot" for the hero -- real, live graph data rendered
 * inside a browser-chrome frame, not a fabricated dashboard image. Numbers
 * and clustering are whatever the held-out test split actually contains.
 */
export function HeroMockup() {
  // Fewer clusters than the full workspace -- this card is ~280px tall, and
  // cramming the same 25+ clusters in that space is what was overlapping
  // into solid blobs regardless of how well-spaced the layout is at full
  // workspace size.
  const { data } = useGraph("test", 7);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cardRef.current) return;
    const float = gsap.to(cardRef.current, {
      y: -10,
      duration: 3.2,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
    return () => {
      float.kill();
    };
  }, []);

  const flagged = data ? data.clusters.filter((c) => c.action !== "no_action").length : null;

  return (
    <div className="[perspective:1800px]">
      <div
        ref={cardRef}
        className="w-full rounded-2xl border border-border bg-card shadow-[0_50px_140px_-20px_oklch(0.62_0.19_255_/_30%),0_25px_70px_-15px_rgba(0,0,0,0.75)]"
        style={{ transform: "rotateX(10deg) rotateY(-20deg) rotateZ(2deg) scale(1.04)" }}
      >
        <div className="flex items-center gap-1.5 rounded-t-2xl border-b border-border bg-muted/30 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-risk-priority/60" />
          <span className="size-2.5 rounded-full bg-risk-review/60" />
          <span className="size-2.5 rounded-full bg-risk-cleared/60" />
          <span className="ml-3 rounded bg-background/60 px-2.5 py-0.5 text-[10.5px] text-muted-foreground font-mono">
            ring.app/investigate
          </span>
        </div>

        <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-border/60">
          <span className="text-[11.5px] font-semibold text-foreground">Network investigation</span>
          <div className="flex items-center gap-3 text-[10.5px] text-muted-foreground">
            <span>Accounts <span className="font-semibold text-foreground">{data?.nodes.length ?? "—"}</span></span>
            <span>Flagged <span className="font-semibold text-foreground">{flagged ?? "—"}</span></span>
          </div>
        </div>

        <div className="p-3">
          <RingGraph
            accounts={data?.nodes ?? []}
            selectedId={null}
            onSelectAccount={() => {}}
            minimal
            height={280}
            initialRatio={0.75}
            className="pointer-events-none"
          />
        </div>
      </div>
    </div>
  );
}
