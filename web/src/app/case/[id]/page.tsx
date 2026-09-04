"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, ScanSearch, FileText, Gavel } from "lucide-react";
import { useCluster, useMetrics } from "@/hooks/use-api";
import { ACTION_COLOR } from "@/lib/entity-graph";
import { ACTION_LABEL, FEATURE_LABEL, formatPct, formatHours } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

const AUDIT_STAGES = [
  { icon: ScanSearch, label: "Detection", body: "Accounts connected via a shared device, IP, payout instrument, or address were grouped into this cluster by deterministic graph traversal." },
  { icon: FileText, label: "Scoring", body: "A classifier trained on held-out-evaluated data scored the cluster's behaviour — not the graph structure alone." },
  { icon: FileText, label: "Evidence generation", body: "A case-file generator turned the structured evidence into the summary and reasoning below." },
  { icon: Gavel, label: "Policy decision", body: "A deterministic, non-ML policy converted the score into one of three allowed actions. This step cannot be overridden by the model." },
];

export default function CaseFilePage() {
  const params = useParams<{ id: string }>();
  const clusterId = params.id;
  const { data, loading, error } = useCluster(clusterId);
  const { data: metrics } = useMetrics();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link href="/investigations" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="size-3.5" /> Back to cases
      </Link>

      {loading && <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-32 w-full" /></div>}
      {error && <p className="text-destructive text-sm">Couldn&apos;t load this case: {error}</p>}

      {data && (
        <>
          <div className="flex items-start justify-between gap-4 mb-1">
            <h1 className="text-2xl font-semibold tracking-tight">Case #{data.cluster_id}</h1>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold shrink-0"
              style={{ backgroundColor: `${ACTION_COLOR[data.action]}22`, color: ACTION_COLOR[data.action] }}
            >
              <span className="size-1.5 rounded-full" style={{ backgroundColor: ACTION_COLOR[data.action] }} />
              {ACTION_LABEL[data.action]}
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground mb-8">
            {data.features.cluster_size} linked accounts · Risk score{" "}
            <span className="font-semibold text-foreground tabular-nums">{formatPct(data.abuse_score)}</span>
          </p>

          <section className="mb-8">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Summary</h2>
            <p className="text-[14px] leading-relaxed text-foreground/90 rounded-lg border border-border bg-muted/30 p-4">
              {data.case_file}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Evidence</h2>
            <div className="rounded-lg border border-border divide-y divide-border">
              {Object.entries({
                "Linked accounts": String(data.features.cluster_size),
                "Shared signals": data.shared_attributes.join(", "),
                "Signup window": formatHours(data.features.registration_burstiness_hours),
                "Average refund rate": formatPct(data.features.mean_refund_rate),
                "Device reuse": formatPct(data.features.device_reuse_ratio, 0),
                "Payout reuse": formatPct(data.features.payout_reuse_ratio, 0),
                "KYC-verified share": formatPct(data.features.kyc_verified_ratio, 0),
              }).map(([k, v]) => (
                <div key={k} className="flex justify-between px-4 py-2.5 text-[13px]">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Policy decision</h2>
            <div className="rounded-lg border border-border p-4">
              <span className="font-mono text-[13px] font-semibold" style={{ color: ACTION_COLOR[data.action] }}>{data.action}</span>
              <p className="text-[13px] text-muted-foreground mt-1.5">{data.reason}</p>
            </div>
          </section>

          <section className="mb-8">
            <div className="rounded-lg border border-border bg-muted/20 p-4 flex gap-3">
              <ShieldCheck className="size-4 shrink-0 text-brand mt-0.5" />
              <p className="text-[12.5px] text-foreground/90 leading-relaxed">
                <span className="font-semibold">Safety.</span> Ring cannot ban, freeze, suspend, or take a financial
                action. This case file only ever produces a review-queue recommendation — a human always makes the
                final decision.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Audit trail</h2>
            <ol className="space-y-4">
              {AUDIT_STAGES.map((s) => (
                <li key={s.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="flex size-6 items-center justify-center rounded-full bg-secondary shrink-0">
                      <s.icon className="size-3.5 text-foreground" />
                    </div>
                    <div className="w-px flex-1 bg-border mt-1" />
                  </div>
                  <div className="pb-2">
                    <div className="text-[13px] font-medium text-foreground">{s.label}</div>
                    <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            {metrics && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Model run generated at {new Date(metrics.generated_at).toLocaleString()}.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
