"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGraph } from "@/hooks/use-api";
import { ACTION_COLOR } from "@/lib/entity-graph";
import { formatPct, topSignal } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import type { GraphCluster, PolicyAction } from "@/types/api";

const GROUPS: { action: PolicyAction; title: string }[] = [
  { action: "priority_review", title: "Priority review" },
  { action: "queue_for_review", title: "Standard review" },
  { action: "no_action", title: "Cleared" },
];

function CaseRow({ c }: { c: GraphCluster }) {
  const color = ACTION_COLOR[c.action];
  return (
    <Link
      href={`/case/${c.cluster_id}`}
      data-case-row
      className="grid grid-cols-[1fr_90px_90px_1fr_120px] items-center gap-4 px-4 py-3 text-[13px] hover:bg-secondary/50 transition-colors border-b border-border last:border-0"
    >
      <span className="font-mono text-[12.5px] text-foreground truncate">{c.cluster_id}</span>
      <span className="tabular-nums font-medium" style={{ color }}>{formatPct(c.abuse_score, 1)}</span>
      <span className="tabular-nums text-muted-foreground">{c.size}</span>
      <span className="text-muted-foreground truncate">{topSignal(c)}</span>
      <span className="font-mono text-[11px] text-muted-foreground">{c.action}</span>
    </Link>
  );
}

export default function InvestigationsPage() {
  const [split, setSplit] = useState<"test" | "all">("test");
  const { data, loading, error } = useGraph(split, 300);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data || !listRef.current) return;
    const rows = listRef.current.querySelectorAll("[data-case-row]");
    gsap.fromTo(rows, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out", stagger: 0.02 });
  }, [data, split]);

  const grouped = GROUPS.map((g) => ({
    ...g,
    cases: (data?.clusters ?? []).filter((c) => c.action === g.action).sort((a, b) => b.abuse_score - a.abuse_score),
  }));

  return (
    <div className="relative mx-auto w-full max-w-[1100px] px-6 py-10 overflow-hidden">
      <div className="page-glow" aria-hidden />
      <div className="relative flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-[1.6rem] font-medium tracking-tight">Cases</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {data ? `${data.clusters.length} clusters scored on the ${split === "test" ? "held-out test" : "full"} split.` : "Loading…"}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          {(["test", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSplit(s)}
              className={`rounded px-2.5 py-1 text-[12px] font-medium transition-colors ${split === s ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
            >
              {s === "test" ? "Held-out test" : "All splits"}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>}
      {error && <p className="text-destructive text-sm">{error}</p>}

      {data && (
        <div ref={listRef} className="space-y-8">
          {grouped.map((g) => (
            <section key={g.action}>
              <div className="flex items-center gap-2 mb-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: ACTION_COLOR[g.action] }} />
                <h2 className="text-[13px] font-semibold">{g.title}</h2>
                <span className="text-[12px] text-muted-foreground">({g.cases.length})</span>
              </div>
              {g.cases.length === 0 ? (
                <p className="text-[12.5px] text-muted-foreground pl-4 py-3 border border-dashed border-border rounded-lg">
                  No clusters in this state.
                </p>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="grid grid-cols-[1fr_90px_90px_1fr_120px] gap-4 px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30 border-b border-border">
                    <span>Case</span><span>Risk</span><span>Accounts</span><span>Strongest signal</span><span>Action</span>
                  </div>
                  {g.cases.map((c) => <CaseRow key={c.cluster_id} c={c} />)}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
