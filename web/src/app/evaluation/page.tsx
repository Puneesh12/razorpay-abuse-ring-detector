"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useMetrics } from "@/hooks/use-api";
import { formatInr, formatPct } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { TriangleAlert } from "lucide-react";

function Bar({ label, baseline, ring, format }: { label: string; baseline: number; ring: number; format: (n: number) => string }) {
  const max = Math.max(baseline, ring, 0.0001);
  const baselineRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (baselineRef.current) {
      gsap.fromTo(baselineRef.current, { width: "0%" }, { width: `${(baseline / max) * 100}%`, duration: 0.7, ease: "power3.out" });
    }
    if (ringRef.current) {
      gsap.fromTo(ringRef.current, { width: "0%" }, { width: `${(ring / max) * 100}%`, duration: 0.7, delay: 0.1, ease: "power3.out" });
    }
  }, [baseline, ring, max]);

  return (
    <div className="mb-4 last:mb-0">
      <div className="flex justify-between text-[12px] mb-1.5">
        <span className="text-muted-foreground">{label}</span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-14 text-[10.5px] text-muted-foreground shrink-0">Baseline</span>
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div ref={baselineRef} className="h-full rounded-full bg-muted-foreground/50" />
          </div>
          <span className="w-16 text-[11px] tabular-nums text-right shrink-0">{format(baseline)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-14 text-[10.5px] text-foreground shrink-0">Ring</span>
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div ref={ringRef} className="h-full rounded-full bg-brand" />
          </div>
          <span className="w-16 text-[11px] tabular-nums text-right font-medium shrink-0">{format(ring)}</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tag }: { label: string; value: string; tag?: "measured" | "estimate" }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</span>
        {tag && (
          <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${tag === "measured" ? "bg-risk-cleared/15 text-risk-cleared" : "bg-risk-review/15 text-risk-review"}`}>
            {tag}
          </span>
        )}
      </div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export default function EvaluationPage() {
  const { data: m, loading, error } = useMetrics();

  if (loading) return <div className="mx-auto max-w-4xl px-6 py-10"><Skeleton className="h-8 w-48 mb-6" /><Skeleton className="h-64 w-full" /></div>;
  if (error || !m) return <div className="mx-auto max-w-4xl px-6 py-10 text-destructive text-sm">{error ?? "No evaluation available."}</div>;

  const d = m.detector_metrics.held_out_test;
  const val = m.detector_metrics.validation;
  const b = m.baseline_graph_only_test_split;
  const p = m.policy_run_test_split;
  const trainClusters = Math.max(0, m.dataset.n_clusters_found - val.n_clusters - d.n_clusters);
  const nPositives = d.true_positive_clusters + d.false_negative_clusters;
  const smallN = nPositives < 30;

  return (
    <div className="relative mx-auto w-full max-w-4xl px-6 py-10 overflow-hidden">
      <div className="page-glow" aria-hidden />
      <h1 className="relative font-heading text-[1.6rem] font-medium tracking-tight mb-1">Model evaluation</h1>
      <p className="text-[13px] text-muted-foreground mb-8">
        Every number on this page is measured against the held-out test split — data the model never trained on. Run
        generated {new Date(m.generated_at).toLocaleString()}.
      </p>

      {smallN && (
        <div className="mb-8 rounded-lg border border-risk-review/30 bg-risk-review/5 p-4 flex gap-3">
          <TriangleAlert className="size-4 shrink-0 text-risk-review mt-0.5" />
          <p className="text-[12.5px] text-foreground/90 leading-relaxed">
            <span className="font-semibold">Limitation, stated plainly:</span> the held-out test split contains only{" "}
            {nPositives} ground-truth ring cluster{nPositives === 1 ? "" : "s"}. The results below are directionally
            strong but not yet statistically robust at this sample size — treat this as an early signal, not a proven
            production result.
          </p>
        </div>
      )}

      <section className="mb-10">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Dataset</h2>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Train clusters (derived)" value={trainClusters.toLocaleString("en-IN")} />
          <Stat label="Validation clusters" value={val.n_clusters.toLocaleString("en-IN")} />
          <Stat label="Held-out test clusters" value={d.n_clusters.toLocaleString("en-IN")} tag="measured" />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Held-out precision &amp; recall</h2>
        <div className="grid grid-cols-4 gap-3">
          <Stat label="Precision" value={formatPct(d.cluster_precision)} tag="measured" />
          <Stat label="Recall" value={formatPct(d.cluster_recall)} tag="measured" />
          <Stat label="F1" value={formatPct(d.cluster_f1)} tag="measured" />
          <Stat label="False positives" value={String(d.false_positive_clusters)} tag="measured" />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">Ring vs. naive baseline</h2>
        <p className="text-[12px] text-muted-foreground mb-4">
          The baseline flags every cluster with any shared attribute — the naive approach Ring is measured against on
          the identical held-out batch.
        </p>
        <div className="rounded-lg border border-border p-5">
          <Bar label="Clusters flagged" baseline={b.n_clusters_flagged} ring={p.n_flagged} format={(n) => n.toFixed(0)} />
          <Bar label="Accounts wrongly flagged" baseline={b.n_accounts_wrongly_flagged} ring={p.n_accounts_wrongly_flagged} format={(n) => n.toFixed(0)} />
          <Bar label="False-positive cost" baseline={b.false_positive_cost_inr} ring={p.false_positive_cost_inr} format={formatInr} />
          <Bar label="At-risk ₹ caught (estimate)" baseline={b.estimated_loss_caught_inr} ring={p.estimated_loss_caught_inr} format={formatInr} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          &ldquo;At-risk ₹ caught&rdquo; is an <span className="font-medium text-risk-review">estimate</span> (refund count × average order value for flagged accounts), not a measured recovery figure.
        </p>
      </section>

      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">What this run actually did</h2>
        <div className="rounded-lg border border-border divide-y divide-border text-[13px]">
          {[
            ["Clusters evaluated", p.n_clusters_evaluated],
            ["Flagged for priority review", p.n_priority_review],
            ["Flagged for standard review", p.n_standard_review],
            ["Accounts correctly flagged", p.n_accounts_correctly_flagged],
            ["Accounts wrongly flagged", p.n_accounts_wrongly_flagged],
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between px-4 py-2.5">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium tabular-nums">{v}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
