"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Inspector } from "@/components/investigation/inspector";
import { RunAnalysis } from "@/components/investigation/run-analysis";
import type { GraphSnapshot } from "@/types/api";

// Sigma.js requires WebGL, which doesn't exist during server prerendering —
// load it client-only.
const RingGraph = dynamic(() => import("@/components/graph/ring-graph").then((m) => m.RingGraph), {
  ssr: false,
  loading: () => <div className="h-[480px] rounded-lg border border-border bg-black animate-pulse" />,
});

export default function InvestigatePage() {
  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);

  const selectedClusterId = useMemo(() => {
    if (!selectedAccountId || !snapshot) return null;
    return snapshot.nodes.find((n) => n.id === selectedAccountId)?.cluster_id ?? null;
  }, [selectedAccountId, snapshot]);

  const relationships = snapshot ? snapshot.edges.length : 0;
  const flaggedClusters = snapshot ? snapshot.clusters.filter((c) => c.action !== "no_action").length : 0;

  return (
    <div className="flex-1 flex flex-col">
      <div className="relative border-b border-border overflow-hidden">
        <div className="page-glow" aria-hidden />
        <div className="relative mx-auto max-w-[1600px] px-6 py-7 flex flex-wrap items-center gap-x-8 gap-y-4">
          <div>
            <h1 className="font-heading text-[26px] md:text-[28px] font-medium text-foreground tracking-tight leading-none">
              Network investigation
            </h1>
            <p className="text-[12.5px] text-muted-foreground mt-2">
              {lastRunAt ? `Last analysis ${lastRunAt.toLocaleTimeString()}` : "No analysis run yet — click Run analysis to load real data"}
            </p>
          </div>
          <div className="flex items-center gap-3 text-[12.5px]">
            <div className="rounded-lg border border-border bg-surface-raised/60 px-3.5 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Accounts</div>
              <div className="font-semibold tabular-nums text-[15px]">{snapshot?.nodes.length ?? "—"}</div>
            </div>
            <div className="rounded-lg border border-border bg-surface-raised/60 px-3.5 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Relationships</div>
              <div className="font-semibold tabular-nums text-[15px]">{relationships}</div>
            </div>
            <div className="rounded-lg border border-border bg-surface-raised/60 px-3.5 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Flagged clusters</div>
              <div className="font-semibold tabular-nums text-[15px] text-risk-priority">{flaggedClusters}</div>
            </div>
          </div>
          <div className="ml-auto">
            <RunAnalysis
              onComplete={(data) => {
                setSnapshot(data);
                setLastRunAt(new Date());
              }}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 flex-1">
        <RingGraph
          accounts={snapshot?.nodes ?? []}
          selectedId={selectedAccountId}
          onSelectAccount={setSelectedAccountId}
        />
        <aside className="lg:border-l lg:border-border lg:pl-6">
          <Inspector clusterId={selectedClusterId} />
        </aside>
      </div>
    </div>
  );
}
