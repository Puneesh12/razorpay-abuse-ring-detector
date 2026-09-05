"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import gsap from "gsap";
import { ArrowLeft, ShieldCheck, ScanSearch, FileText, Gavel, Users, Link2, Clock, RotateCcw, Smartphone, Wallet, BadgeCheck, Check } from "lucide-react";
import { useCluster, useMetrics } from "@/hooks/use-api";
import { ACTION_COLOR, attributeLabel } from "@/lib/entity-graph";
import { ACTION_LABEL, formatPct, formatHours } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { InvestigationAssistant } from "@/components/investigation/investigation-assistant";

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
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data || !contentRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        contentRef.current!.querySelectorAll("[data-reveal]"),
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.08 }
      );
    });
    return () => ctx.revert();
  }, [data]);

  return (
    <div className="relative mx-auto w-full max-w-3xl px-6 py-10 overflow-hidden">
      <div className="page-glow" aria-hidden />
      <Link href="/investigations" className="relative inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="size-3.5" /> Back to cases
      </Link>

      {loading && <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-32 w-full" /></div>}
      {error && <p className="text-destructive text-sm">Couldn&apos;t load this case: {error}</p>}

      {data && (
        <div ref={contentRef}>
          <div data-reveal className="flex items-start justify-between gap-4 mb-1">
            <h1 className="font-heading text-[1.75rem] font-medium tracking-tight">Case #{data.cluster_id}</h1>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold shrink-0"
              style={{ backgroundColor: `${ACTION_COLOR[data.action]}22`, color: ACTION_COLOR[data.action] }}
            >
              <span className="size-1.5 rounded-full" style={{ backgroundColor: ACTION_COLOR[data.action] }} />
              {ACTION_LABEL[data.action]}
            </span>
          </div>
          <p data-reveal className="text-[13px] text-muted-foreground mb-8">
            {data.features.cluster_size} linked accounts · Risk score{" "}
            <span className="font-semibold text-foreground tabular-nums">{formatPct(data.abuse_score)}</span>
          </p>

          <section data-reveal className="mb-8">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Summary</h2>
            <p className="text-[14px] leading-relaxed text-neutral-800 rounded-xl border border-neutral-200 bg-white shadow-sm p-4">
              {data.case_file}
            </p>
          </section>

          <section data-reveal className="mb-8">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Evidence</h2>
            {/* White key-value panel, matching the /investigate inspector --
                a real structured record, not a wall of cards or prose. */}
            <div className="rounded-xl border border-neutral-200 bg-white text-neutral-900 shadow-sm overflow-hidden px-4">
              {[
                { icon: Users, label: "Linked accounts", value: String(data.features.cluster_size) },
                // Raw field names like "shipping_address_hash" are exactly the
                // kind of ML-internal detail that belongs in the collapsed
                // technical section elsewhere, not the primary evidence --
                // attributeLabel() is the same humanizer the graph legend uses.
                { icon: Link2, label: "Shared signals", value: data.shared_attributes.map(attributeLabel).join(", ") },
                { icon: Clock, label: "Signup window", value: formatHours(data.features.registration_burstiness_hours) },
                { icon: RotateCcw, label: "Avg. refund rate", value: formatPct(data.features.mean_refund_rate) },
                { icon: Smartphone, label: "Device reuse", value: formatPct(data.features.device_reuse_ratio, 0) },
                { icon: Wallet, label: "Payout reuse", value: formatPct(data.features.payout_reuse_ratio, 0) },
                { icon: BadgeCheck, label: "KYC-verified", value: formatPct(data.features.kyc_verified_ratio, 0) },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center justify-between gap-4 py-3 border-b border-neutral-100 last:border-0">
                  <span className="text-[13px] text-neutral-500">{label}</span>
                  <span className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-900 text-right">
                    <Icon className="size-3.5 text-neutral-400 shrink-0" />
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section data-reveal className="mb-8">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Policy decision</h2>
            <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-4">
              <span className="font-mono text-[13px] font-semibold" style={{ color: ACTION_COLOR[data.action] }}>{data.action}</span>
              <p className="text-[13px] text-neutral-500 mt-1.5">{data.reason}</p>
            </div>
          </section>

          <section data-reveal className="mb-8">
            <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-4 flex gap-3">
              <ShieldCheck className="size-4 shrink-0 text-brand mt-0.5" />
              <p className="text-[12.5px] text-neutral-700 leading-relaxed">
                <span className="font-semibold text-neutral-900">Safety.</span> Ring cannot ban, freeze, suspend, or take a financial
                action. This case file only ever produces a review-queue recommendation — a human always makes the
                final decision.
              </p>
            </div>
          </section>

          <section data-reveal>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Audit trail</h2>
            <div className="rounded-xl border border-neutral-200 bg-white text-neutral-900 shadow-sm p-5">
              <ol>
                {AUDIT_STAGES.map((s, i) => (
                  <li key={s.label} className="relative flex gap-4 pb-7 last:pb-0">
                    {i < AUDIT_STAGES.length - 1 && (
                      <span
                        className="absolute left-5 top-10 bottom-0 w-px"
                        style={{ background: "linear-gradient(to bottom, color-mix(in oklch, var(--brand) 45%, transparent), var(--color-neutral-200, #e5e5e5))" }}
                        aria-hidden
                      />
                    )}
                    <div className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-brand/25 bg-brand/10 text-brand">
                      <s.icon className="size-[18px]" />
                      <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border-2 border-white bg-emerald-500">
                        <Check className="size-2.5 text-white" strokeWidth={3} />
                      </span>
                    </div>
                    <div className="pt-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-brand">Step {i + 1}</span>
                      <div className="text-[14px] font-semibold text-neutral-900 mt-0.5">{s.label}</div>
                      <p className="text-[12.5px] text-neutral-500 mt-1 leading-relaxed max-w-md">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              {metrics && (
                <p className="text-[11px] text-neutral-400 pt-3 border-t border-neutral-100 mt-1">
                  Model run generated at {new Date(metrics.generated_at).toLocaleString()}.
                </p>
              )}
            </div>
          </section>

          <div className="mt-8">
            <InvestigationAssistant clusterId={data.cluster_id} />
          </div>
        </div>
      )}
    </div>
  );
}
