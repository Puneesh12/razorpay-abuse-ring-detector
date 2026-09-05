"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import {
  Boxes,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  Gauge,
  Users,
  Link2,
  Clock,
  RefreshCcw,
  Smartphone,
  Wallet,
  BadgeCheck,
} from "lucide-react";
import { useCluster } from "@/hooks/use-api";
import { ACTION_COLOR, attributeLabel } from "@/lib/entity-graph";
import { ACTION_LABEL, FEATURE_LABEL, formatPct, formatHours } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface InspectorProps {
  clusterId: string | null;
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

function Row({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-neutral-100 last:border-0">
      <span className="text-[12.5px] text-neutral-500">{label}</span>
      <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-neutral-900 text-right tabular-nums">
        <Icon className="size-3.5 text-neutral-400 shrink-0" />
        {value}
      </span>
    </div>
  );
}

export function Inspector({ clusterId }: InspectorProps) {
  const { data, loading, error } = useCluster(clusterId);
  const [copied, setCopied] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(true);
  const [showTechnical, setShowTechnical] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data || !bodyRef.current) return;
    gsap.fromTo(
      bodyRef.current,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }
    );
  }, [data]);

  const copyId = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.cluster_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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
      <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
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
    <div ref={bodyRef} className="rounded-xl border border-neutral-200 bg-white text-neutral-900 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
        <span className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
          <Boxes className="size-4" />
          Cluster
        </span>
        <Link href={`/case/${data.cluster_id}`} className="text-neutral-400 hover:text-neutral-700 transition-colors">
          <ExternalLink className="size-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 pt-4">
        <button
          onClick={copyId}
          className="flex flex-col items-center justify-center gap-1 rounded-lg border border-neutral-200 py-2.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
        >
          {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy ID"}
        </button>
        <Link
          href={`/case/${data.cluster_id}`}
          className="flex flex-col items-center justify-center gap-1 rounded-lg border border-neutral-200 py-2.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
        >
          <ExternalLink className="size-4" />
          Full case file
        </Link>
      </div>

      <div className="flex flex-col items-center text-center px-4 pt-5 pb-4">
        <span
          className="flex size-14 items-center justify-center rounded-full mb-3"
          style={{ backgroundColor: `${color}18`, color }}
        >
          <Boxes className="size-6" />
        </span>
        <h3 className="font-mono text-[13.5px] font-semibold text-neutral-900">{data.cluster_id}</h3>
        <span
          className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ backgroundColor: `${color}18`, color }}
        >
          <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
          {ACTION_LABEL[data.action]}
        </span>
      </div>

      <div className="px-4 py-1 border-t border-neutral-100">
        <Row icon={Gauge} label="Risk score" value={formatPct(data.abuse_score, 1)} />
        <Row icon={Users} label="Linked accounts" value={String(data.features.cluster_size)} />
        <Row icon={Link2} label="Shared signals" value={data.shared_attributes.map(attributeLabel).join(", ")} />
        <Row icon={Clock} label="Signup window" value={formatHours(data.features.registration_burstiness_hours)} />
        <Row icon={RefreshCcw} label="Avg. refund rate" value={formatPct(data.features.mean_refund_rate)} />
        <Row icon={Smartphone} label="Device reuse" value={formatPct(data.features.device_reuse_ratio, 0)} />
        <Row icon={Wallet} label="Payout reuse" value={formatPct(data.features.payout_reuse_ratio, 0)} />
        <Row icon={BadgeCheck} label="KYC verified" value={formatPct(data.features.kyc_verified_ratio, 0)} />
      </div>

      <div className="border-t border-neutral-100 px-4 py-3">
        <button
          onClick={() => setEvidenceOpen((o) => !o)}
          className="flex w-full items-center justify-between text-[12px] font-semibold text-neutral-400"
        >
          <span className="flex items-center gap-1.5 uppercase tracking-wide">
            <ChevronDown className={`size-3.5 transition-transform ${evidenceOpen ? "" : "-rotate-90"}`} />
            {data.action === "no_action" ? "Signals considered" : "Why this was flagged"}
          </span>
          <span className="text-neutral-400 tabular-nums">{evidence.length || "—"}</span>
        </button>
        {evidenceOpen && (
          <ul className="mt-2.5 space-y-2 pl-5">
            {evidence.length ? (
              evidence.map((e, i) => (
                <li key={i} className="text-[12.5px] text-neutral-600 leading-relaxed list-disc">
                  {e}
                </li>
              ))
            ) : (
              <li className="text-[12.5px] text-neutral-400 list-disc">No individually strong signal — score reflects the combination.</li>
            )}
          </ul>
        )}
      </div>

      <div className="border-t border-neutral-100 px-4 py-3">
        <div className="text-[12px] font-semibold uppercase tracking-wide text-neutral-400 mb-1.5">Policy decision</div>
        <span className="font-mono text-[11.5px] font-semibold" style={{ color }}>{data.action}</span>
        <p className="text-[12.5px] text-neutral-600 leading-relaxed mt-1">{data.reason}</p>
      </div>

      <Collapsible open={showTechnical} onOpenChange={setShowTechnical} className="border-t border-neutral-100 px-4 py-3">
        <CollapsibleTrigger className="flex w-full items-center justify-between text-[12px] font-semibold uppercase tracking-wide text-neutral-400 hover:text-neutral-700">
          Technical model details
          <ChevronDown className={`size-3.5 transition-transform ${showTechnical ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-1 font-mono text-[11px] text-neutral-500">
          {Object.entries(data.features).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span>{FEATURE_LABEL[k] ?? k}</span>
              <span className="text-neutral-700">{typeof v === "number" ? v.toFixed(4) : String(v)}</span>
            </div>
          ))}
          <div className="pt-2 mt-2 border-t border-neutral-100 text-[11px]">
            Case-file mode: <span className="text-neutral-700">{data.case_file_mode}</span>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
