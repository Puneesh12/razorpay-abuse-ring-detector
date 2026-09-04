"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink } from "lucide-react";
import { useCluster } from "@/hooks/use-api";
import { ACTION_COLOR } from "@/lib/entity-graph";
import { ACTION_LABEL, ACTION_DESCRIPTION, FEATURE_LABEL, formatPct, formatHours } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface InspectorProps {
  clusterId: string | null;
}

function EvidenceItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-border/60 last:border-0">
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      <span className="text-[12.5px] font-medium text-foreground tabular-nums">{value}</span>
    </div>
  );
}

function strongestEvidence(f: NonNullable<ReturnType<typeof useCluster>["data"]>["features"]): string[] {
  const items: { text: string; weight: number }[] = [];
  if (f.registration_burstiness_hours < 96 && f.cluster_size >= 3) {
    items.push({ text: `All ${f.cluster_size} accounts registered within ${formatHours(f.registration_burstiness_hours)} of each other — consistent with bulk creation, not organic signups`, weight: 3 });
  }
  if (f.device_reuse_ratio > 0.3) items.push({ text: `${formatPct(f.device_reuse_ratio, 0)} of accounts reuse a device`, weight: 2 });
  if (f.payout_reuse_ratio > 0.3) items.push({ text: `${formatPct(f.payout_reuse_ratio, 0)} of accounts reuse a payout destination`, weight: 2 });
  if (f.mean_refund_rate > 0.25) items.push({ text: `Average refund rate of ${formatPct(f.mean_refund_rate, 0)}, well above typical`, weight: 1.5 });
  if (f.kyc_verified_ratio < 0.5) items.push({ text: `Only ${formatPct(f.kyc_verified_ratio, 0)} of accounts are KYC-verified`, weight: 1 });
  if (f.addr_reuse_ratio > 0.3) items.push({ text: `${formatPct(f.addr_reuse_ratio, 0)} of accounts reuse a shipping address`, weight: 1 });
  items.sort((a, b) => b.weight - a.weight);
  return items.slice(0, 5).map((i) => i.text);
}

export function Inspector({ clusterId }: InspectorProps) {
  const { data, loading, error } = useCluster(clusterId);
  const [showTechnical, setShowTechnical] = useState(false);

  if (!clusterId) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center rounded-lg border border-dashed border-border p-6 text-center">
        <p className="text-[13px] text-muted-foreground max-w-xs">
          Select an account in the graph, or a case in the list, to inspect the evidence behind its score.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-[13px] text-destructive">Couldn&apos;t load this case: {error}</p>;
  }

  const color = ACTION_COLOR[data.action];
  const evidence = strongestEvidence(data.features);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[12px] text-muted-foreground">{data.cluster_id}</span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            style={{ backgroundColor: `${color}22`, color }}
          >
            <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
            {ACTION_LABEL[data.action]}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums tracking-tight">{formatPct(data.abuse_score, 1)}</span>
          <span className="text-[12px] text-muted-foreground">risk score</span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-foreground/90">{ACTION_DESCRIPTION[data.action]}</p>
      </div>

      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Evidence</h3>
        <EvidenceItem label="Linked accounts" value={String(data.features.cluster_size)} />
        <EvidenceItem label="Shared signals" value={data.shared_attributes.length.toString()} />
        <EvidenceItem label="Signup window" value={formatHours(data.features.registration_burstiness_hours)} />
        <EvidenceItem label="Avg. refund rate" value={formatPct(data.features.mean_refund_rate)} />
        <EvidenceItem label="Device reuse" value={formatPct(data.features.device_reuse_ratio, 0)} />
        <EvidenceItem label="KYC verified" value={formatPct(data.features.kyc_verified_ratio, 0)} />
      </div>

      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Why this was flagged</h3>
        <ul className="space-y-1.5">
          {evidence.length ? evidence.map((e, i) => (
            <li key={i} className="text-[12.5px] text-foreground/90 leading-relaxed flex gap-2">
              <span className="text-muted-foreground shrink-0">·</span>{e}
            </li>
          )) : <li className="text-[12.5px] text-muted-foreground">No individually strong signal — score reflects the combination.</li>}
        </ul>
      </div>

      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Recommended action</h3>
        <div className="rounded-md border border-border px-3 py-2.5">
          <span className="font-mono text-[12px] font-semibold" style={{ color }}>{data.action}</span>
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Why this action</h3>
        <p className="text-[12.5px] text-muted-foreground leading-relaxed">{data.reason}</p>
      </div>

      <Collapsible open={showTechnical} onOpenChange={setShowTechnical}>
        <CollapsibleTrigger className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
          Technical model details
          <ChevronDown className={`size-3.5 transition-transform ${showTechnical ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-1 font-mono text-[11px] text-muted-foreground">
          {Object.entries(data.features).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span>{FEATURE_LABEL[k] ?? k}</span>
              <span className="text-foreground/70">{typeof v === "number" ? v.toFixed(4) : String(v)}</span>
            </div>
          ))}
          <div className="pt-2 mt-2 border-t border-border/60 text-[11px]">
            Case-file mode: <span className="text-foreground/70">{data.case_file_mode}</span>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Link
        href={`/case/${data.cluster_id}`}
        className="flex items-center justify-center gap-1.5 rounded-md border border-border py-2 text-[12.5px] font-medium text-foreground hover:bg-secondary transition-colors"
      >
        Open full case file
        <ExternalLink className="size-3.5" />
      </Link>
    </div>
  );
}
