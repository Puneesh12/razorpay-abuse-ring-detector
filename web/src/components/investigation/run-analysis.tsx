"use client";

import { useState, useCallback } from "react";
import { Loader2, Play } from "lucide-react";
import { api } from "@/lib/api";
import type { GraphSnapshot } from "@/types/api";

// These stages are the real backend pipeline (build_graph -> find_clusters ->
// build_cluster_table -> score_clusters -> policy.decide), which all execute
// within the one /api/graph round trip. A minimum per-stage display time is
// applied purely for legibility -- nothing here is fake work, it's real work
// that happens too fast on a small dataset to see otherwise.
const STAGES = [
  "Loading account graph",
  "Resolving shared entities",
  "Detecting communities",
  "Scoring clusters",
  "Applying policy",
  "Generating case files",
];

interface RunAnalysisProps {
  onComplete: (data: GraphSnapshot) => void;
}

export function RunAnalysis({ onComplete }: RunAnalysisProps) {
  const [running, setRunning] = useState(false);
  const [stageIndex, setStageIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    setStageIndex(0);

    const fetchPromise = api.graph("test", 60);
    const minStageMs = 260;

    // advance through visual stages while the real request is in flight
    for (let i = 0; i < STAGES.length - 2; i++) {
      await new Promise((r) => setTimeout(r, minStageMs));
      setStageIndex(i + 1);
    }

    try {
      const data = await fetchPromise;
      setStageIndex(STAGES.length - 2);
      await new Promise((r) => setTimeout(r, minStageMs));
      setStageIndex(STAGES.length - 1);
      await new Promise((r) => setTimeout(r, minStageMs));
      onComplete(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
      setStageIndex(-1);
    }
  }, [onComplete]);

  if (running) {
    return (
      <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted/40 px-3.5 py-2">
        <Loader2 className="size-3.5 animate-spin text-brand" />
        <span className="text-[12.5px] font-medium text-foreground">{STAGES[stageIndex]}…</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={run}
        className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold text-brand-foreground transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]"
        style={{
          background: "linear-gradient(135deg, var(--brand) 0%, color-mix(in oklch, var(--brand) 75%, black) 100%)",
          boxShadow: "0 4px 20px color-mix(in oklch, var(--brand) 32%, transparent)",
        }}
      >
        <Play className="size-3.5" />
        Run analysis
      </button>
      {error && <span className="text-[12px] text-destructive">{error}</span>}
    </div>
  );
}
