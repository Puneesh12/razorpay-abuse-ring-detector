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
        <div className="relative mx-auto max-w-[1600px] px-6 py-5 flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <h1 className="font-heading text-[17px] font-medium text-foreground">Network investigation</h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {lastRunAt ? `Last analysis ${lastRunAt.toLocaleTimeString()}` : "No analysis run yet"}
            </p>
          </div>
          <div className="flex items-center gap-6 text-[12.5px]">
            <div>
              <span className="text-muted-foreground">Accounts </span>
              <span className="font-semibold tabular-nums">{snapshot?.nodes.length ?? "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Relationships </span>
              <span className="font-semibold tabular-nums">{relationships}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Flagged clusters </span>
              <span className="font-semibold tabular-nums">{flaggedClusters}</span>
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
